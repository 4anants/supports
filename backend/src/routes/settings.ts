import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';
import { hashPassword, comparePassword } from '../lib/auth';
import { performBackup, scheduleBackups } from '../lib/backup';
import path from 'path';
import fs from 'fs';
import { BACKUP_DIR } from '../lib/backup';
import { verifyPin } from '../middleware/pin';

const router = Router();



router.get('/', async (req, res) => {
    try {
        const settings = await prisma.settings.findMany();

        // SECURITY FIX: Only return non-sensitive branding info to Public
        const publicKeys = ['company_name', 'logo_url', 'background_url'];

        const settingsMap = settings
            .filter(s => publicKeys.includes(s.key))
            .reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
        res.json(settingsMap);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Admin Route: Get ALL settings for the dashboard
router.get('/all', requireAdmin, async (req, res) => {
    try {
        const settings = await prisma.settings.findMany();
        // Still hide hashed PIN for extra safety (only verify it)
        const settingsMap = settings
            .filter(s => s.key !== 'security_pin')
            .reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
        res.json(settingsMap);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Check if PIN is set (boolean only)
router.get('/pin-status', requireAdmin, async (req, res) => {
    try {
        const pin = await prisma.settings.findUnique({ where: { key: 'security_pin' } });
        res.json({ isSet: !!pin?.value });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Set PIN
router.post('/pin/set', requireAdmin, async (req, res) => {
    try {
        const { pin } = req.body;
        if (!pin) return res.status(400).json({ error: 'PIN is required' });

        // Hash the PIN before storing
        const hashedPin = await hashPassword(pin);

        await prisma.settings.upsert({
            where: { key: 'security_pin' },
            create: { key: 'security_pin', value: hashedPin },
            update: { value: hashedPin }
        });
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Verify PIN (New Endpoint)
router.post('/pin/verify', requireAdmin, async (req, res) => {
    try {
        const { pin } = req.body;
        const storedPin = await prisma.settings.findUnique({ where: { key: 'security_pin' } });

        if (!storedPin || !storedPin.value) {
            return res.status(400).json({ valid: false, error: 'No PIN set' });
        }

        const isValid = await comparePassword(pin, storedPin.value);

        if (isValid) {
            res.json({ valid: true });
        } else {
            res.status(403).json({ valid: false, error: 'Invalid PIN' });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Reset PIN (No old PIN requirement per user request)
router.post('/pin/reset', requireAdmin, async (req, res) => {
    try {
        await prisma.settings.deleteMany({ where: { key: 'security_pin' } });
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

import { firewall } from '../lib/firewall';

// Firewall Status
router.get('/firewall', requireAdmin, async (req, res) => {
    try {
        res.json({
            recent_blocks: firewall.getRecentBlocks(),
            allowed_ips: firewall.getAllowed(),
            blocked_ips: firewall.getBlocked()
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Save Settings - Protected by PIN
router.post('/', requireAdmin, verifyPin, async (req: AuthRequest, res) => {
    try {
        const { key, value } = req.body;
        const setting = await prisma.settings.upsert({
            where: { key },
            update: { value },
            create: { key, value }
        });

        // Refresh firewall settings if relevant keys changed
        if (key === 'allowed_ips' || key === 'blocked_ips') {
            await firewall.loadSettings();
        }

        res.json(setting);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// Trigger Backup - Protected by PIN
router.post('/backup', requireAdmin, verifyPin, async (req: AuthRequest, res) => {
    try {
        const result = await performBackup();
        // Re-read schedule in case settings changed
        await scheduleBackups();
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/backups', requireAdmin, async (req, res) => {
    try {
        // Fetch from DB Log
        const backups = await prisma.backupLog.findMany({
            orderBy: { timestamp: 'desc' },
            take: 50
        });

        const mappedBackups = backups.map(b => ({
            name: b.id,
            created: b.timestamp,
            status: b.status,
            type: b.type,
            details: b.details
        }));

        res.json(mappedBackups);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Reset Data (Tickets & Inventory Stock only)
router.post('/reset/data', requireAdmin, verifyPin, async (req: AuthRequest, res) => {
    try {
        await prisma.$transaction(async (tx) => {
            // 1. Clear Inventory Logs (History)
            await tx.inventoryLog.deleteMany({});

            // 2. Delete all Tickets
            await tx.ticket.deleteMany({});

            // 3. Reset Inventory Stock to 0 (keep items)
            await tx.inventory.updateMany({
                data: { quantity: 0 }
            });
        });

        // Clear Ticket Attachments from Disk
        const uploadDir = path.join(__dirname, '../../uploads');
        if (fs.existsSync(uploadDir)) {
            const files = await fs.promises.readdir(uploadDir);
            for (const file of files) {
                if (file.startsWith('tkt_')) {
                    await fs.promises.unlink(path.join(uploadDir, file)).catch(error => console.error(`Failed to delete ${file}:`, error));
                }
            }
        }

        res.json({ success: true, message: 'Data reset successfully' });
    } catch (error: any) {
        console.error("Reset Data Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Factory Reset (Site Reset)
router.post('/reset/site', requireAdmin, verifyPin, async (req: AuthRequest, res) => {
    try {
        await prisma.$transaction(async (tx) => {
            // Priority: Delete child/dependent records first to avoids FK issues (even if not enforced by SQLite sometimes)

            // 1. Logs
            await tx.inventoryLog.deleteMany({});
            await tx.backupLog.deleteMany({});

            // 2. Tickets
            await tx.ticket.deleteMany({});

            // 3. Inventory & Master Data
            await tx.inventory.deleteMany({});
            await tx.office.deleteMany({});
            await tx.department.deleteMany({});

            // 4. Settings
            await tx.settings.deleteMany({});
        });

        // Wipe ALL Uploads (Attachments + Logos)
        const uploadDir = path.join(__dirname, '../../uploads');
        if (fs.existsSync(uploadDir)) {
            const files = await fs.promises.readdir(uploadDir);
            for (const file of files) {
                if (file === '.gitkeep') continue;
                await fs.promises.unlink(path.join(uploadDir, file)).catch(error => console.error(`Failed to delete ${file}:`, error));
            }
        }

        res.json({ success: true, message: 'Factory reset completed' });
    } catch (error: any) {
        console.error("Factory Reset Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// OneDrive Token Exchange
router.post('/onedrive/authorize', requireAdmin, async (req, res) => {
    try {
        const { code, client_id, client_secret, redirect_uri } = req.body;
        if (!code || !client_id || !client_secret || !redirect_uri) {
            return res.status(400).json({ error: 'Missing parameters' });
        }

        const params = new URLSearchParams();
        params.append('client_id', client_id);
        params.append('scope', 'Files.ReadWrite.All offline_access');
        params.append('code', code);
        params.append('redirect_uri', redirect_uri);
        params.append('grant_type', 'authorization_code');
        params.append('client_secret', client_secret);

        const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        const data: any = await tokenResponse.json();

        if (!tokenResponse.ok) {
            return res.status(400).json({ error: data.error_description || data.error || 'Failed to authorize' });
        }

        if (!data.refresh_token) {
            return res.status(400).json({ error: 'No refresh_token returned. Make sure "offline_access" scope is enabled.' });
        }

        res.json({ refresh_token: data.refresh_token });

    } catch (error: any) {
        console.error("OneDrive Auth Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Cleanup Unused Storage (Garbage Collection)
router.post('/cleanup', requireAdmin, verifyPin, async (req: AuthRequest, res) => {
    try {
        // 1. Collect all used filenames
        const usedFiles = new Set<string>();
        const extractFilename = (str: string | null) => {
            if (!str) return;
            // Matches filename at end of path/url
            const match = str.match(/[^\\/]+$/);
            if (match) usedFiles.add(match[0]);
        };

        const users = await prisma.user.findMany({ select: { avatar: true } });
        users.forEach(u => extractFilename(u.avatar));

        const tickets = await prisma.ticket.findMany({ select: { attachment_path: true } });
        tickets.forEach(t => extractFilename(t.attachment_path));

        const settings = await prisma.settings.findMany({ where: { key: { in: ['logo_url', 'background_url'] } } });
        settings.forEach(s => extractFilename(s.value));

        // 2. Scan Uploads Directory
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
            return res.json({ success: true, count: 0, message: 'Uploads directory not found' });
        }

        const files = await fs.promises.readdir(uploadDir);
        let deletedCount = 0;
        const keptCount = 0;

        for (const file of files) {
            if (file === '.gitkeep') continue;
            // If file is NOT in used list, delete it
            if (!usedFiles.has(file)) {
                await fs.promises.unlink(path.join(uploadDir, file)).catch(e => console.error(`Failed to delete ${file}`, e));
                deletedCount++;
            }
        }

        res.json({ success: true, count: deletedCount, total_scanned: files.length, message: `Cleaned up ${deletedCount} unused files.` });

    } catch (error: any) {
        console.error("Cleanup Error:", error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
