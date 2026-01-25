"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleBackups = exports.performBackup = exports.UPLOADS_DIR = exports.BACKUP_DIR = void 0;
// @ts-nocheck
const node_cron_1 = __importDefault(require("node-cron"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const archiver_1 = __importDefault(require("archiver"));
const prisma_1 = __importDefault(require("./prisma"));
const email_1 = __importDefault(require("./email"));
const google_1 = require("./providers/google");
const onedrive_1 = require("./providers/onedrive");
// Define paths
exports.BACKUP_DIR = path_1.default.join(__dirname, '../../backups');
exports.UPLOADS_DIR = path_1.default.join(__dirname, '../../uploads');
const DB_PATH_PROD = path_1.default.join(__dirname, '../../prisma/prod.db');
const DB_PATH_DEV = path_1.default.join(__dirname, '../../prisma/dev.db');
const DB_PATH = fs_extra_1.default.existsSync(DB_PATH_PROD) ? DB_PATH_PROD : DB_PATH_DEV;
const performBackup = async (externalPath) => {
    await fs_extra_1.default.ensureDir(exports.BACKUP_DIR);
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const backupName = `ITSupports_${dateStr}_${timeStr}`;
    const localBackupPath = path_1.default.join(exports.BACKUP_DIR, backupName);
    await fs_extra_1.default.ensureDir(localBackupPath);
    const log = [];
    let status = 'SUCCESS';
    let type = 'LOCAL';
    try {
        log.push(`[${new Date().toISOString()}] Starting backup: ${backupName}`);
        // 1. Backup Database
        const dbBackupPath = path_1.default.join(localBackupPath, 'dev.db');
        try {
            await fs_extra_1.default.copy(DB_PATH, dbBackupPath);
            log.push(`Database backed up to ${dbBackupPath}`);
        }
        catch (dbErr) {
            log.push(`Database backup failed: ${dbErr.message}`);
            throw dbErr;
        }
        // 2. Archive Uploads
        const uploadsZipPath = path_1.default.join(localBackupPath, 'uploads.zip');
        if (fs_extra_1.default.existsSync(exports.UPLOADS_DIR)) {
            await zipDirectory(exports.UPLOADS_DIR, uploadsZipPath);
            log.push(`Uploads archived to ${uploadsZipPath}`);
        }
        else {
            log.push('No uploads directory found to backup.');
        }
        // 3. Cloud / External Checks
        let isCloudSuccess = false;
        let isCopiedExternally = false;
        // 3a. Local Sync Folder (External Path)
        let finalExternalPath = externalPath;
        if (!finalExternalPath) {
            const settings = await prisma_1.default.settings.findUnique({ where: { key: 'backup_path' } });
            finalExternalPath = settings?.value;
        }
        if (finalExternalPath && fs_extra_1.default.existsSync(finalExternalPath)) {
            const destPath = path_1.default.join(finalExternalPath, backupName);
            await fs_extra_1.default.copy(localBackupPath, destPath);
            log.push(`Backup successfully copied to external path: ${destPath}`);
            type = 'HYBRID';
            isCopiedExternally = true;
        }
        // 3b. Cloud API Uploads (Google / OneDrive)
        // Check settings for enabled providers
        const settings = await prisma_1.default.settings.findMany({
            where: {
                key: { in: ['onedrive_enabled', 'onedrive_client_id', 'onedrive_client_secret', 'gdrive_enabled', 'gdrive_client_id', 'gdrive_client_secret'] }
            }
        });
        const config = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
        const zipName = `${backupName}.zip`;
        const finalZipPath = path_1.default.join(exports.BACKUP_DIR, zipName);
        await zipDirectory(localBackupPath, finalZipPath); // Compress entire backup folder
        // OneDrive API
        if (config.onedrive_enabled === 'true' && config.onedrive_client_id && config.onedrive_client_secret) {
            try {
                log.push("Starting OneDrive API Upload...");
                const provider = new onedrive_1.OneDriveProvider(config.onedrive_client_id, config.onedrive_client_secret);
                await provider.uploadFile(finalZipPath, zipName);
                log.push("OneDrive Upload Success.");
                isCloudSuccess = true;
            }
            catch (e) {
                log.push(`OneDrive Upload Failed: ${e.message}`);
                console.error(e);
            }
        }
        // Google Drive API
        if (config.gdrive_enabled === 'true' && config.gdrive_client_id && config.gdrive_client_secret) {
            try {
                log.push("Starting Google Drive API Upload...");
                const provider = new google_1.GoogleDriveProvider(config.gdrive_client_id, config.gdrive_client_secret);
                await provider.uploadFile(finalZipPath, zipName);
                log.push("Google Drive Upload Success.");
                isCloudSuccess = true;
            }
            catch (e) {
                log.push(`Google Drive Upload Failed: ${e.message}`);
                console.error(e);
            }
        }
        // Cleanup Temp Zip
        if (fs_extra_1.default.existsSync(finalZipPath))
            fs_extra_1.default.unlinkSync(finalZipPath);
        if (isCloudSuccess)
            type = 'CLOUD';
        // Cleanup Local if successfully stored off-site (Cloud or Sync Folder)
        // Keep at least one local copy usually, but logic here removes it if success
        if (isCloudSuccess || isCopiedExternally) {
            if (fs_extra_1.default.existsSync(localBackupPath)) {
                await fs_extra_1.default.remove(localBackupPath);
                log.push(`Local backup folder cleaned up (Off-site success).`);
            }
        }
        await rotateBackups(3, log); // Logic remains same
        // Log Success
        log.push(`[${new Date().toISOString()}] Backup completed successfully.`);
        await prisma_1.default.backupLog.create({
            data: {
                status, type, details: log.join('\n'), path: finalExternalPath || 'Local'
            }
        });
        // Notify
        await sendBackupNotification({ success: true, location: type, timestamp: new Date(), backupName, details: log.join('\n') });
        return { success: true, log, location: type };
    }
    catch (error) {
        log.push(`[${new Date().toISOString()}] Backup FAILED: ${error.message}`);
        console.error('Backup Error:', error);
        await prisma_1.default.backupLog.create({
            data: { status: 'FAILED', type: 'LOCAL', details: log.join('\n'), path: localBackupPath }
        });
        await sendBackupNotification({ success: false, error: error.message, location: 'FAILED', timestamp: new Date(), backupName: 'N/A', details: log.join('\n') });
        return { success: false, log, error: error.message };
    }
};
exports.performBackup = performBackup;
const zipDirectory = (source, out) => {
    const archive = (0, archiver_1.default)('zip', { zlib: { level: 9 } });
    const stream = fs_extra_1.default.createWriteStream(out);
    return new Promise((resolve, reject) => {
        archive.directory(source, false).on('error', err => reject(err)).pipe(stream);
        stream.on('close', () => resolve());
        archive.finalize();
    });
};
const rotateBackups = async (keepCount = 3, log) => {
    try {
        const files = await fs_extra_1.default.readdir(exports.BACKUP_DIR);
        const backupItems = files.filter(f => f.startsWith('ITSupports_') || f.startsWith('backup-') || f.endsWith('.zip'));
        if (backupItems.length <= keepCount)
            return;
        backupItems.sort().reverse();
        const toRemove = backupItems.slice(keepCount);
        for (const item of toRemove) {
            await fs_extra_1.default.remove(path_1.default.join(exports.BACKUP_DIR, item));
            if (log)
                log.push(`Cleanup: Removed old backup item ${item}`);
        }
    }
    catch (err) {
        console.error(err);
    }
};
// Scheduler Logic
let scheduledTask = null;
const scheduleBackups = async () => {
    if (scheduledTask) {
        scheduledTask.stop();
        scheduledTask = null;
    }
    const frequencySetting = await prisma_1.default.settings.findUnique({ where: { key: 'backup_frequency' } });
    const frequency = frequencySetting?.value || 'NEVER';
    if (frequency === 'NEVER')
        return;
    let cronExpression = '0 0 * * *';
    if (frequency === 'WEEKLY')
        cronExpression = '0 0 * * 0';
    console.log(`📅 Scheduling backups: ${frequency} (${cronExpression})`);
    scheduledTask = node_cron_1.default.schedule(cronExpression, async () => {
        console.log('⏰ Running scheduled backup...');
        await (0, exports.performBackup)();
    });
};
exports.scheduleBackups = scheduleBackups;
const sendBackupNotification = async (data) => {
    try {
        const emailSettings = await prisma_1.default.settings.findMany({ where: { key: { in: ['smtp_user', 'notification_email', 'company_name'] } } });
        const config = emailSettings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
        const adminEmail = config.notification_email || config.smtp_user;
        if (!adminEmail)
            return;
        const subject = data.success ? `✅ Backup Successful` : `❌ Backup Failed`;
        await email_1.default.sendGeneric(adminEmail, subject, `<pre>${data.details}</pre>`);
    }
    catch (e) {
        console.error("Email Error", e);
    }
};
//# sourceMappingURL=backup.js.map