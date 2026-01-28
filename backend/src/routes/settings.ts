import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';
import { hashPassword, comparePassword } from '../lib/auth';
import { performBackup, scheduleBackups } from '../lib/backup';
import path from 'path';
import fs from 'fs';
import { BACKUP_DIR } from '../lib/paths';
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

// Get Backups (Merged DB Logs + Physical Files)
router.get('/backups', requireAdmin, async (req, res) => {
    try {
        // 1. Fetch from DB Log
        const dbBackups = await prisma.backupLog.findMany({
            orderBy: { timestamp: 'desc' },
            take: 50
        });

        const mappedDbBackups = dbBackups.map(b => ({
            id: b.id,
            name: `Log #${b.id}`,
            created: b.timestamp,
            status: b.status,
            type: b.type,
            details: b.details,
            source: 'DB'
        }));

        // 2. Fetch Physical Files
        let physicalFiles: any[] = [];
        try {
            if (fs.existsSync(BACKUP_DIR)) {
                const files = await fs.promises.readdir(BACKUP_DIR);
                physicalFiles = await Promise.all(files
                    .filter(f => f.startsWith('ITSupports_') || f.endsWith('.zip'))
                    .map(async f => {
                        let timestamp = new Date();
                        try {
                            // Try parsing string: ITSupports_2026-01-13_00-00-00
                            const parts = f.replace('ITSupports_', '').replace('.zip', '').split('_');
                            if (parts.length >= 2) {
                                const datePart = parts[0];
                                const timePart = parts[1].replace(/-/g, ':');
                                timestamp = new Date(`${datePart}T${timePart}`);
                            } else {
                                const stats = await fs.promises.stat(path.join(BACKUP_DIR, f));
                                timestamp = stats.ctime;
                            }
                        } catch (e) {
                            const stats = await fs.promises.stat(path.join(BACKUP_DIR, f));
                            timestamp = stats.ctime;
                        }

                        return {
                            id: `file_${f}`,
                            name: f,
                            created: timestamp,
                            status: 'SUCCESS',
                            type: f.endsWith('.zip') ? 'ARCHIVE' : 'LOCAL',
                            details: 'Physical file found on disk',
                            source: 'DISK'
                        };
                    }));
            }
        } catch (e) {
            console.error("Error reading backup directory:", e);
        }

        // 3. Merge & Sort
        // We simply combine. Users can deduct duplicates if they see same time.
        // Ideally we could dedup based on timestamp proximity, but let's keep it simple and transparent.
        const allBackups = [...mappedDbBackups, ...physicalFiles];
        allBackups.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

        res.json(allBackups);
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

// Test FTP Connection
router.post('/test-ftp', requireAdmin, async (req, res) => {
    const { host, user, password, port } = req.body;
    if (!host || !user) return res.status(400).json({ error: 'Host and User required' });

    const ftp = new (require('basic-ftp').Client)();
    // ftp.ftp.verbose = true;
    try {
        await ftp.access({
            host,
            user,
            password,
            port: parseInt(port || '21'),
            secure: false
        });
        await ftp.list(); // Try listing as a test
        res.json({ success: true, message: 'FTP Connection Successful' });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    } finally {
        ftp.close();
    }
});

// Test Local/Network Path
router.post('/test-path', requireAdmin, async (req, res) => {
    let { path: testPath, user, password } = req.body;
    if (!testPath) return res.status(400).json({ error: 'Path required' });

    testPath = testPath.trim();
    // Remove trailing slash for UNC paths to avoid mkdir issues
    if (testPath.startsWith('\\\\') && testPath.endsWith('\\')) {
        testPath = testPath.slice(0, -1);
    }

    try {
        // Authenticate if it's a network path
        if (testPath.startsWith('\\\\')) {
            const { authenticateNetworkPath } = require('../lib/network');
            try {
                authenticateNetworkPath(testPath, user, password);
            } catch (authErr: any) {
                return res.status(401).json({ error: authErr.message });
            }
        }

        if (!fs.existsSync(testPath)) {
            await fs.promises.mkdir(testPath, { recursive: true });
        }

        // Test Write Permission
        const testFile = path.join(testPath, `.write_test_${Date.now()}`);
        await fs.promises.writeFile(testFile, 'test');
        await fs.promises.unlink(testFile);

        res.json({ success: true, message: 'Path is accessible and writable' });
    } catch (e: any) {
        console.error('Path Test Error:', e);
        res.status(400).json({ error: `Path Error: ${e.message}` });
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
        const fs = require('fs');
        const uploadDir = path.join(__dirname, '../../uploads');
        let deletedCount = 0;

        if (fs.existsSync(uploadDir)) {
            const files = await fs.promises.readdir(uploadDir);
            for (const file of files) {
                if (file === '.gitkeep') continue;
                if (!usedFiles.has(file)) {
                    // It's an orphan
                    await fs.promises.unlink(path.join(uploadDir, file)).catch((e: any) => console.error(e));
                    deletedCount++;
                }
            }
        }

        res.json({ success: true, count: deletedCount, message: `Cleaned up ${deletedCount} unused files.` });

    } catch (error: any) {
        console.error("Cleanup Error:", error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
