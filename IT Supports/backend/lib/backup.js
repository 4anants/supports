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
const axios_1 = __importDefault(require("axios"));
const email_1 = __importDefault(require("./email"));
// Define paths
exports.BACKUP_DIR = path_1.default.join(__dirname, '../../backups');
exports.UPLOADS_DIR = path_1.default.join(__dirname, '../../uploads');
const DB_PATH_PROD = path_1.default.join(__dirname, '../../prisma/prod.db');
const DB_PATH_DEV = path_1.default.join(__dirname, '../../prisma/dev.db');
const DB_PATH = fs_extra_1.default.existsSync(DB_PATH_PROD) ? DB_PATH_PROD : DB_PATH_DEV;
// Ensure local backup directory exists - MOVED TO FUNCTIONS
// fs.ensureDirSync(BACKUP_DIR); -- Removed to prevent startup crash
const performBackup = async (externalPath) => {
    // Ensure Directory Exists Here
    await fs_extra_1.default.ensureDir(exports.BACKUP_DIR);
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const backupName = `ITSupports_${dateStr}_${timeStr}`;
    const localBackupPath = path_1.default.join(exports.BACKUP_DIR, backupName);
    // Create specific folder for this backup
    await fs_extra_1.default.ensureDir(localBackupPath);
    const log = [];
    let status = 'SUCCESS';
    let type = 'LOCAL';
    try {
        log.push(`[${new Date().toISOString()}] Starting backup: ${backupName}`);
        // 1. Backup Database (SQLite Safe Copy)
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
        // 3. Copy to External Path (OneDrive) if configured/provided
        let finalExternalPath = externalPath;
        if (!finalExternalPath) {
            const settings = await prisma_1.default.settings.findUnique({ where: { key: 'backup_path' } });
            finalExternalPath = settings?.value;
        }
        let isCopiedExternally = false;
        if (finalExternalPath && fs_extra_1.default.existsSync(finalExternalPath)) {
            const destPath = path_1.default.join(finalExternalPath, backupName);
            await fs_extra_1.default.copy(localBackupPath, destPath);
            log.push(`Backup successfully copied to external path: ${destPath}`);
            type = 'HYBRID';
            isCopiedExternally = true;
        }
        // 4. Upload to OneDrive (Graph API - Cloud Direct)
        const oneDriveEnabled = await prisma_1.default.settings.findUnique({ where: { key: 'onedrive_enabled' } });
        let isCloudSuccess = false;
        if (oneDriveEnabled?.value === 'true') {
            try {
                log.push('Starting OneDrive Cloud Upload...');
                // Create a single zip of the entire backup folder for easier cloud storage
                const finalZipPath = path_1.default.join(exports.BACKUP_DIR, `${backupName}.zip`);
                await zipDirectory(localBackupPath, finalZipPath);
                await uploadToOneDrive(finalZipPath, `${backupName}.zip`, log);
                // Cleanup the temporary zip
                if (fs_extra_1.default.existsSync(finalZipPath)) {
                    fs_extra_1.default.unlinkSync(finalZipPath);
                }
                log.push('OneDrive Upload Complete.');
                type = 'CLOUD';
                isCloudSuccess = true;
            }
            catch (cloudErr) {
                log.push(`OneDrive Upload FAILED: ${cloudErr.message}`);
                console.error('OneDrive Error:', cloudErr);
                // Don't fail the whole backup just because cloud upload failed, but log it.
                status = 'PARTIAL_FAIL';
            }
        }
        // --- ENHANCED CLEANUP LOGIC ---
        // If it was successfully sent to Cloud or External Path, we can remove the local folder
        // unless it's strictly LOCAL mode.
        if (isCloudSuccess || isCopiedExternally) {
            if (fs_extra_1.default.existsSync(localBackupPath)) {
                await fs_extra_1.default.remove(localBackupPath);
                log.push(`Local backup folder cleaned up (${isCloudSuccess ? 'Cloud' : 'External'} successful).`);
            }
        }
        // General Rotation Cleanup (Keep only last 3 local backups to save space)
        await rotateBackups(3, log);
        log.push(`[${new Date().toISOString()}] Backup completed successfully.`);
        // Log to DB
        await prisma_1.default.backupLog.create({
            data: {
                status,
                type,
                details: log.join('\n'),
                path: isCloudSuccess ? 'OneDrive' : (isCopiedExternally ? finalExternalPath : localBackupPath)
            }
        });
        // Send Success Email
        try {
            await sendBackupNotification({
                success: true,
                location: isCloudSuccess ? 'OneDrive' : (isCopiedExternally ? finalExternalPath : 'Local'),
                timestamp: new Date(),
                backupName,
                type,
                details: log.join('\n')
            });
        }
        catch (emailErr) {
            console.error('Failed to send backup success email:', emailErr);
        }
        return { success: true, log, location: isCloudSuccess ? 'OneDrive' : localBackupPath };
    }
    catch (error) {
        log.push(`[${new Date().toISOString()}] Backup FAILED: ${error.message}`);
        console.error('Backup Error:', error);
        // Log Failure to DB
        await prisma_1.default.backupLog.create({
            data: {
                status: 'FAILED',
                type: 'LOCAL',
                details: log.join('\n'),
                path: localBackupPath
            }
        });
        // Send Failure Email
        try {
            await sendBackupNotification({
                success: false,
                location: 'Failed',
                timestamp: new Date(),
                backupName: 'N/A',
                type: 'FAILED',
                error: error.message,
                details: log.join('\n')
            });
        }
        catch (emailErr) {
            console.error('Failed to send backup failure email:', emailErr);
        }
        return { success: false, log, error: error.message };
    }
};
exports.performBackup = performBackup;
// --- OneDrive / Graph API Helper ---
const uploadToOneDrive = async (filePath, fileName, log) => {
    // 1. Get Settings
    const settings = await prisma_1.default.settings.findMany({
        where: { key: { in: ['onedrive_client_id', 'onedrive_client_secret', 'onedrive_refresh_token', 'onedrive_folder'] } }
    });
    const config = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value ? s.value.trim() : '' }), {});
    if (!config.onedrive_client_id || !config.onedrive_client_secret || !config.onedrive_refresh_token) {
        throw new Error('OneDrive credentials missing in settings.');
    }
    // 2. Refresh Token
    log.push('Refreshing OneDrive Access Token...');
    const tokenResponse = await axios_1.default.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', new URLSearchParams({
        client_id: config.onedrive_client_id,
        client_secret: config.onedrive_client_secret,
        refresh_token: config.onedrive_refresh_token,
        grant_type: 'refresh_token'
    }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    const accessToken = tokenResponse.data.access_token;
    // Optionally update refresh token if a new one is returned
    if (tokenResponse.data.refresh_token) {
        await prisma_1.default.settings.upsert({
            where: { key: 'onedrive_refresh_token' },
            create: { key: 'onedrive_refresh_token', value: tokenResponse.data.refresh_token },
            update: { value: tokenResponse.data.refresh_token }
        });
    }
    // 3. Upload File
    // Using Upload Session for large files (Backups can be >4MB)
    log.push(`Creating Upload Session for ${fileName}...`);
    const folder = config.onedrive_folder || 'Backups';
    const cleanFolder = folder.replace(/^\/|\/$/g, '');
    const sessionRes = await axios_1.default.post(`https://graph.microsoft.com/v1.0/me/drive/root:/${cleanFolder}/${fileName}:/createUploadSession`, {
        item: {
            "@microsoft.graph.conflictBehavior": "replace"
        }
    }, { headers: { Authorization: `Bearer ${accessToken}` } });
    const uploadUrl = sessionRes.data.uploadUrl;
    const fileStats = fs_extra_1.default.statSync(filePath);
    const fileSize = fileStats.size;
    // Stream upload in chunks (10MB chunks)
    const CHUNK_SIZE = 320 * 1024 * 32; // ~10MB (multiple of 320KiB)
    const buffer = Buffer.alloc(CHUNK_SIZE);
    const fd = fs_extra_1.default.openSync(filePath, 'r');
    let start = 0;
    while (start < fileSize) {
        const bytesRead = fs_extra_1.default.readSync(fd, buffer, 0, CHUNK_SIZE, start);
        const end = start + bytesRead - 1;
        // Retry logic for chunks could be added here
        await axios_1.default.put(uploadUrl, buffer.slice(0, bytesRead), {
            headers: {
                'Content-Length': bytesRead,
                'Content-Range': `bytes ${start}-${end}/${fileSize}`
            }
        });
        start += bytesRead;
    }
    fs_extra_1.default.closeSync(fd);
    log.push(`Successfully uploaded ${fileName} to OneDrive at /${cleanFolder}/`);
};
// Helper to zip directory
const zipDirectory = (source, out) => {
    const archive = (0, archiver_1.default)('zip', { zlib: { level: 9 } });
    const stream = fs_extra_1.default.createWriteStream(out);
    return new Promise((resolve, reject) => {
        archive
            .directory(source, false)
            .on('error', err => reject(err))
            .pipe(stream);
        stream.on('close', () => resolve());
        archive.finalize();
    });
};
// --- ROTATION / CLEANUP LOGIC ---
const rotateBackups = async (keepCount = 3, log) => {
    try {
        const files = await fs_extra_1.default.readdir(exports.BACKUP_DIR);
        // Identify backup folders/files (both old 'backup-' and new 'ITSupports_' naming)
        const backupItems = files.filter(f => f.startsWith('ITSupports_') || f.startsWith('backup-') || f.endsWith('.zip'));
        if (backupItems.length <= keepCount)
            return;
        // Sort by name (which contains date/time) desc - assumes standard naming
        backupItems.sort().reverse();
        // Items to remove
        const toRemove = backupItems.slice(keepCount);
        for (const item of toRemove) {
            const fullPath = path_1.default.join(exports.BACKUP_DIR, item);
            await fs_extra_1.default.remove(fullPath);
            const msg = `Cleanup: Removed old backup item ${item}`;
            if (log)
                log.push(msg);
            console.log(msg);
        }
    }
    catch (err) {
        console.error('Backup Rotation Error:', err);
    }
};
// Scheduling Service
// Valid schedules: 'DAILY' (0 0 * * *), 'WEEKLY' (0 0 * * 0)
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
    let cronExpression = '0 0 * * *'; // Default Daily
    if (frequency === 'WEEKLY')
        cronExpression = '0 0 * * 0'; // Sunday midnight
    console.log(`📅 Scheduling backups: ${frequency} (${cronExpression})`);
    scheduledTask = node_cron_1.default.schedule(cronExpression, async () => {
        console.log('⏰ Running scheduled backup...');
        await (0, exports.performBackup)();
    });
};
exports.scheduleBackups = scheduleBackups;
// Email Notification for Backup Status
const sendBackupNotification = async (data) => {
    // Get admin email from settings
    const emailSettings = await prisma_1.default.settings.findMany({
        where: { key: { in: ['smtp_user', 'company_name', 'notification_email'] } }
    });
    const config = emailSettings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
    const adminEmail = config.notification_email || config.smtp_user;
    if (!adminEmail) {
        console.log('[Backup] No admin email configured, skipping notification');
        return;
    }
    const companyName = config.company_name || 'IT Support System';
    const subject = data.success
        ? `✅ Backup Successful - ${companyName}`
        : `❌ Backup Failed - ${companyName}`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: ${data.success ? '#10B981' : '#EF4444'}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                <h2 style="margin: 0;">${data.success ? '✅ Backup Successful' : '❌ Backup Failed'}</h2>
            </div>
            <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                <p style="font-size: 14px; color: #6b7280; margin-bottom: 16px;">
                    This is an automated notification from your IT Support System backup service.
                </p>
                
                <div style="background: white; padding: 16px; border-radius: 6px; margin-bottom: 16px;">
                    <h3 style="font-size: 16px; margin: 0 0 12px 0; color: #111827;">Backup Details:</h3>
                    <table style="width: 100%; font-size: 14px;">
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Status:</td>
                            <td style="padding: 8px 0; color: ${data.success ? '#10B981' : '#EF4444'}; font-weight: bold;">
                                ${data.success ? 'SUCCESS' : 'FAILED'}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Timestamp:</td>
                            <td style="padding: 8px 0;">${new Date(data.timestamp).toLocaleString()}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Location:</td>
                            <td style="padding: 8px 0;">${data.location}</td>
                        </tr>
                        ${data.backupName !== 'N/A' ? `
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Backup Name:</td>
                            <td style="padding: 8px 0;">${data.backupName}</td>
                        </tr>
                        ` : ''}
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Type:</td>
                            <td style="padding: 8px 0;">${data.type}</td>
                        </tr>
                        ${data.error ? `
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Error:</td>
                            <td style="padding: 8px 0; color: #EF4444;">${data.error}</td>
                        </tr>
                        ` : ''}
                    </table>
                </div>
                
                ${data.details ? `
                <details style="background: white; padding: 12px; border-radius: 6px; cursor: pointer;">
                    <summary style="font-weight: bold; color: #374151; font-size: 14px;">View Full Log</summary>
                    <pre style="font-size: 11px; color: #6b7280; white-space: pre-wrap; margin-top: 12px; background: #f9fafb; padding: 12px; border-radius: 4px; overflow-x: auto;">${data.details}</pre>
                </details>
                ` : ''}
                
                <p style="font-size: 12px; color: #9ca3af; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
                    This is an automated message. Please do not reply to this email.
                </p>
            </div>
        </div>
    `;
    await email_1.default.sendGeneric(adminEmail, subject, html);
    console.log(`[Backup] Notification sent to ${adminEmail}`);
};
//# sourceMappingURL=backup.js.map