"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const auth_2 = require("../lib/auth");
const backup_1 = require("../lib/backup");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const pin_1 = require("../middleware/pin");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const settings = await prisma_1.default.settings.findMany();
        // SECURITY FIX: Only return non-sensitive branding info to Public
        const publicKeys = ['company_name', 'logo_url', 'background_url'];
        const settingsMap = settings
            .filter(s => publicKeys.includes(s.key))
            .reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
        res.json(settingsMap);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Admin Route: Get ALL settings for the dashboard
router.get('/all', auth_1.requireAdmin, async (req, res) => {
    try {
        const settings = await prisma_1.default.settings.findMany();
        // Still hide hashed PIN for extra safety (only verify it)
        const settingsMap = settings
            .filter(s => s.key !== 'security_pin')
            .reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
        res.json(settingsMap);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Check if PIN is set (boolean only)
router.get('/pin-status', auth_1.requireAdmin, async (req, res) => {
    try {
        const pin = await prisma_1.default.settings.findUnique({ where: { key: 'security_pin' } });
        res.json({ isSet: !!pin?.value });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Set PIN
router.post('/pin/set', auth_1.requireAdmin, async (req, res) => {
    try {
        const { pin } = req.body;
        if (!pin)
            return res.status(400).json({ error: 'PIN is required' });
        // Hash the PIN before storing
        const hashedPin = await (0, auth_2.hashPassword)(pin);
        await prisma_1.default.settings.upsert({
            where: { key: 'security_pin' },
            create: { key: 'security_pin', value: hashedPin },
            update: { value: hashedPin }
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Verify PIN (New Endpoint)
router.post('/pin/verify', auth_1.requireAdmin, async (req, res) => {
    try {
        const { pin } = req.body;
        const storedPin = await prisma_1.default.settings.findUnique({ where: { key: 'security_pin' } });
        if (!storedPin || !storedPin.value) {
            return res.status(400).json({ valid: false, error: 'No PIN set' });
        }
        const isValid = await (0, auth_2.comparePassword)(pin, storedPin.value);
        if (isValid) {
            res.json({ valid: true });
        }
        else {
            res.status(403).json({ valid: false, error: 'Invalid PIN' });
        }
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Reset PIN (No old PIN requirement per user request)
router.post('/pin/reset', auth_1.requireAdmin, async (req, res) => {
    try {
        await prisma_1.default.settings.deleteMany({ where: { key: 'security_pin' } });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
const firewall_1 = require("../lib/firewall");
// Firewall Status
router.get('/firewall', auth_1.requireAdmin, async (req, res) => {
    try {
        res.json({
            recent_blocks: firewall_1.firewall.getRecentBlocks(),
            allowed_ips: firewall_1.firewall.getAllowed(),
            blocked_ips: firewall_1.firewall.getBlocked()
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Save Settings - Protected by PIN
router.post('/', auth_1.requireAdmin, pin_1.verifyPin, async (req, res) => {
    try {
        const { key, value } = req.body;
        const setting = await prisma_1.default.settings.upsert({
            where: { key },
            update: { value },
            create: { key, value }
        });
        // Refresh firewall settings if relevant keys changed
        if (key === 'allowed_ips' || key === 'blocked_ips') {
            await firewall_1.firewall.loadSettings();
        }
        res.json(setting);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Trigger Backup - Protected by PIN
router.post('/backup', auth_1.requireAdmin, pin_1.verifyPin, async (req, res) => {
    try {
        const result = await (0, backup_1.performBackup)();
        // Re-read schedule in case settings changed
        await (0, backup_1.scheduleBackups)();
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/backups', auth_1.requireAdmin, async (req, res) => {
    try {
        // Fetch from DB Log
        const backups = await prisma_1.default.backupLog.findMany({
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Reset Data (Tickets & Inventory Stock only)
router.post('/reset/data', auth_1.requireAdmin, pin_1.verifyPin, async (req, res) => {
    try {
        await prisma_1.default.$transaction(async (tx) => {
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
        const uploadDir = path_1.default.join(__dirname, '../../uploads');
        if (fs_1.default.existsSync(uploadDir)) {
            const files = await fs_1.default.promises.readdir(uploadDir);
            for (const file of files) {
                if (file.startsWith('tkt_')) {
                    await fs_1.default.promises.unlink(path_1.default.join(uploadDir, file)).catch(error => console.error(`Failed to delete ${file}:`, error));
                }
            }
        }
        res.json({ success: true, message: 'Data reset successfully' });
    }
    catch (error) {
        console.error("Reset Data Error:", error);
        res.status(500).json({ error: error.message });
    }
});
// Factory Reset (Site Reset)
router.post('/reset/site', auth_1.requireAdmin, pin_1.verifyPin, async (req, res) => {
    try {
        await prisma_1.default.$transaction(async (tx) => {
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
        const uploadDir = path_1.default.join(__dirname, '../../uploads');
        if (fs_1.default.existsSync(uploadDir)) {
            const files = await fs_1.default.promises.readdir(uploadDir);
            for (const file of files) {
                if (file === '.gitkeep')
                    continue;
                await fs_1.default.promises.unlink(path_1.default.join(uploadDir, file)).catch(error => console.error(`Failed to delete ${file}:`, error));
            }
        }
        res.json({ success: true, message: 'Factory reset completed' });
    }
    catch (error) {
        console.error("Factory Reset Error:", error);
        res.status(500).json({ error: error.message });
    }
});
// OneDrive Token Exchange
router.post('/onedrive/authorize', auth_1.requireAdmin, async (req, res) => {
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
        const data = await tokenResponse.json();
        if (!tokenResponse.ok) {
            return res.status(400).json({ error: data.error_description || data.error || 'Failed to authorize' });
        }
        if (!data.refresh_token) {
            return res.status(400).json({ error: 'No refresh_token returned. Make sure "offline_access" scope is enabled.' });
        }
        res.json({ refresh_token: data.refresh_token });
    }
    catch (error) {
        console.error("OneDrive Auth Error:", error);
        res.status(500).json({ error: error.message });
    }
});
// Cleanup Unused Storage (Garbage Collection)
router.post('/cleanup', auth_1.requireAdmin, pin_1.verifyPin, async (req, res) => {
    try {
        // 1. Collect all used filenames
        const usedFiles = new Set();
        const extractFilename = (str) => {
            if (!str)
                return;
            // Matches filename at end of path/url
            const match = str.match(/[^\\/]+$/);
            if (match)
                usedFiles.add(match[0]);
        };
        const users = await prisma_1.default.user.findMany({ select: { avatar: true } });
        users.forEach(u => extractFilename(u.avatar));
        const tickets = await prisma_1.default.ticket.findMany({ select: { attachment_path: true } });
        tickets.forEach(t => extractFilename(t.attachment_path));
        const settings = await prisma_1.default.settings.findMany({ where: { key: { in: ['logo_url', 'background_url'] } } });
        settings.forEach(s => extractFilename(s.value));
        // Cleanup is handled by Cloudinary auto-purging or manual dashboard
        // Local upload directory is strictly temporary
        res.json({ success: true, count: 0, message: 'Storage is managed by Cloudinary. No local cleanup needed.' });
    }
    catch (error) {
        console.error("Cleanup Error:", error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=settings.js.map