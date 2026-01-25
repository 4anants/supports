// @ts-nocheck
import cron, { ScheduledTask } from 'node-cron';
import fs from 'fs-extra';
import path from 'path';
import archiver from 'archiver';
import prisma from './prisma';
import emailService from './email';
import { GoogleDriveProvider } from './providers/google';
import { OneDriveProvider } from './providers/onedrive';

// Define paths
export const BACKUP_DIR = path.join(__dirname, '../../backups');
export const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const DB_PATH_PROD = path.join(__dirname, '../../prisma/prod.db');
const DB_PATH_DEV = path.join(__dirname, '../../prisma/dev.db');
const DB_PATH = fs.existsSync(DB_PATH_PROD) ? DB_PATH_PROD : DB_PATH_DEV;

export const performBackup = async (externalPath?: string) => {
    await fs.ensureDir(BACKUP_DIR);

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const backupName = `ITSupports_${dateStr}_${timeStr}`;
    const localBackupPath = path.join(BACKUP_DIR, backupName);

    await fs.ensureDir(localBackupPath);

    const log: string[] = [];
    let status = 'SUCCESS';
    let type = 'LOCAL';

    try {
        log.push(`[${new Date().toISOString()}] Starting backup: ${backupName}`);

        // 1. Backup Database
        const dbBackupPath = path.join(localBackupPath, 'dev.db');
        try {
            await fs.copy(DB_PATH, dbBackupPath);
            log.push(`Database backed up to ${dbBackupPath}`);
        } catch (dbErr: any) {
            log.push(`Database backup failed: ${dbErr.message}`);
            throw dbErr;
        }

        // 2. Archive Uploads
        const uploadsZipPath = path.join(localBackupPath, 'uploads.zip');
        if (fs.existsSync(UPLOADS_DIR)) {
            await zipDirectory(UPLOADS_DIR, uploadsZipPath);
            log.push(`Uploads archived to ${uploadsZipPath}`);
        } else {
            log.push('No uploads directory found to backup.');
        }

        // 3. Cloud / External Checks
        let isCloudSuccess = false;
        let isCopiedExternally = false;

        // 3a. Local Sync Folder (External Path)
        let finalExternalPath = externalPath;
        if (!finalExternalPath) {
            const settings = await prisma.settings.findUnique({ where: { key: 'backup_path' } });
            finalExternalPath = settings?.value;
        }

        if (finalExternalPath && fs.existsSync(finalExternalPath)) {
            const destPath = path.join(finalExternalPath, backupName);
            await fs.copy(localBackupPath, destPath);
            log.push(`Backup successfully copied to external path: ${destPath}`);
            type = 'HYBRID';
            isCopiedExternally = true;
        }

        // 3b. Cloud API Uploads (Google / OneDrive)
        // Check settings for enabled providers
        const settings = await prisma.settings.findMany({
            where: {
                key: { in: ['onedrive_enabled', 'onedrive_client_id', 'onedrive_client_secret', 'gdrive_enabled', 'gdrive_client_id', 'gdrive_client_secret'] }
            }
        });
        const config = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {} as any);

        const zipName = `${backupName}.zip`;
        const finalZipPath = path.join(BACKUP_DIR, zipName);
        await zipDirectory(localBackupPath, finalZipPath); // Compress entire backup folder

        // OneDrive API
        if (config.onedrive_enabled === 'true' && config.onedrive_client_id && config.onedrive_client_secret) {
            try {
                log.push("Starting OneDrive API Upload...");
                const provider = new OneDriveProvider(config.onedrive_client_id, config.onedrive_client_secret);
                await provider.uploadFile(finalZipPath, zipName);
                log.push("OneDrive Upload Success.");
                isCloudSuccess = true;
            } catch (e: any) {
                log.push(`OneDrive Upload Failed: ${e.message}`);
                console.error(e);
            }
        }

        // Google Drive API
        if (config.gdrive_enabled === 'true' && config.gdrive_client_id && config.gdrive_client_secret) {
            try {
                log.push("Starting Google Drive API Upload...");
                const provider = new GoogleDriveProvider(config.gdrive_client_id, config.gdrive_client_secret);
                await provider.uploadFile(finalZipPath, zipName);
                log.push("Google Drive Upload Success.");
                isCloudSuccess = true;
            } catch (e: any) {
                log.push(`Google Drive Upload Failed: ${e.message}`);
                console.error(e);
            }
        }

        // Cleanup Temp Zip
        if (fs.existsSync(finalZipPath)) fs.unlinkSync(finalZipPath);

        if (isCloudSuccess) type = 'CLOUD';

        // Cleanup Local if successfully stored off-site (Cloud or Sync Folder)
        // Keep at least one local copy usually, but logic here removes it if success
        if (isCloudSuccess || isCopiedExternally) {
            if (fs.existsSync(localBackupPath)) {
                await fs.remove(localBackupPath);
                log.push(`Local backup folder cleaned up (Off-site success).`);
            }
        }

        await rotateBackups(3, log); // Logic remains same

        // Log Success
        log.push(`[${new Date().toISOString()}] Backup completed successfully.`);
        await prisma.backupLog.create({
            data: {
                status, type, details: log.join('\n'), path: finalExternalPath || 'Local'
            }
        });

        // Notify
        await sendBackupNotification({ success: true, location: type, timestamp: new Date(), backupName, details: log.join('\n') });

        return { success: true, log, location: type };

    } catch (error: any) {
        log.push(`[${new Date().toISOString()}] Backup FAILED: ${error.message}`);
        console.error('Backup Error:', error);
        await prisma.backupLog.create({
            data: { status: 'FAILED', type: 'LOCAL', details: log.join('\n'), path: localBackupPath }
        });
        await sendBackupNotification({ success: false, error: error.message, location: 'FAILED', timestamp: new Date(), backupName: 'N/A', details: log.join('\n') });
        return { success: false, log, error: error.message };
    }
};

const zipDirectory = (source: string, out: string) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = fs.createWriteStream(out);
    return new Promise<void>((resolve, reject) => {
        archive.directory(source, false).on('error', err => reject(err)).pipe(stream);
        stream.on('close', () => resolve());
        archive.finalize();
    });
};

const rotateBackups = async (keepCount = 3, log?: string[]) => {
    try {
        const files = await fs.readdir(BACKUP_DIR);
        const backupItems = files.filter(f => f.startsWith('ITSupports_') || f.startsWith('backup-') || f.endsWith('.zip'));
        if (backupItems.length <= keepCount) return;
        backupItems.sort().reverse();
        const toRemove = backupItems.slice(keepCount);
        for (const item of toRemove) {
            await fs.remove(path.join(BACKUP_DIR, item));
            if (log) log.push(`Cleanup: Removed old backup item ${item}`);
        }
    } catch (err) {
        console.error(err);
    }
};

// Scheduler Logic
let scheduledTask: ScheduledTask | null = null;
export const scheduleBackups = async () => {
    if (scheduledTask) {
        scheduledTask.stop();
        scheduledTask = null;
    }
    const frequencySetting = await prisma.settings.findUnique({ where: { key: 'backup_frequency' } });
    const frequency = frequencySetting?.value || 'NEVER';
    if (frequency === 'NEVER') return;

    let cronExpression = '0 0 * * *';
    if (frequency === 'WEEKLY') cronExpression = '0 0 * * 0';

    console.log(`📅 Scheduling backups: ${frequency} (${cronExpression})`);
    scheduledTask = cron.schedule(cronExpression, async () => {
        console.log('⏰ Running scheduled backup...');
        await performBackup();
    });
};

const sendBackupNotification = async (data: any) => {
    try {
        const emailSettings = await prisma.settings.findMany({ where: { key: { in: ['smtp_user', 'notification_email', 'company_name'] } } });
        const config = emailSettings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {} as any);
        const adminEmail = config.notification_email || config.smtp_user;
        if (!adminEmail) return;

        const subject = data.success ? `✅ Backup Successful` : `❌ Backup Failed`;
        await emailService.sendGeneric(adminEmail, subject, `<pre>${data.details}</pre>`);
    } catch (e) { console.error("Email Error", e); }
};
