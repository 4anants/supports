// @ts-nocheck
import cron, { ScheduledTask } from 'node-cron';
import fs from 'fs-extra';
import path from 'path';
import archiver from 'archiver';
import prisma from './prisma';
import emailService from './email';


import { BACKUP_DIR, UPLOADS_DIR, DB_PATH } from './paths';

export const performBackup = async (overridePath?: string) => {
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

        // 3. Fetch All Backup Settings
        const allSettings = await prisma.settings.findMany({
            where: {
                key: {
                    in: [
                        'backup_local_enabled', 'backup_local_path',
                        'backup_network_enabled', 'backup_network_path', 'backup_network_user', 'backup_network_password',
                        'backup_ftp_enabled', 'ftp_host', 'ftp_user', 'ftp_password', 'ftp_port'
                    ]
                }
            }
        });
        const config = allSettings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {} as any);

        let externalSuccessCount = 0;
        let lastExternalPath = '';

        // 3a. Local / USB Backup
        const localEnabled = config.backup_local_enabled === 'true' || !!overridePath;
        const localPath = overridePath || config.backup_local_path;
        if (localEnabled && localPath) {
            try {
                if (!fs.existsSync(localPath)) await fs.ensureDir(localPath);
                const destPath = path.join(localPath, backupName);
                await fs.copy(localBackupPath, destPath);
                log.push(`✅ Local/USB: Successfully copied to ${destPath}`);
                externalSuccessCount++;
                lastExternalPath = destPath;
                type = 'HYBRID';
            } catch (err: any) {
                log.push(`❌ Local/USB Failed: ${err.message}`);
                status = 'WARNING';
            }
        }

        // 3b. Network Backup (UNC)
        if (config.backup_network_enabled === 'true' && config.backup_network_path) {
            const networkPath = config.backup_network_path;
            const user = config.backup_network_user;
            const pass = config.backup_network_password;

            try {
                // If credentials provided on Windows, try to authenticate
                if (process.platform === 'win32' && user && pass) {
                    const { authenticateNetworkPath } = require('./network');
                    log.push(`Authenticating network path: ${networkPath}`);
                    try {
                        authenticateNetworkPath(networkPath, user, pass);
                    } catch (netErr: any) {
                        log.push(`Network authentication warning: ${netErr.message}`);
                    }
                }

                if (!fs.existsSync(networkPath)) await fs.ensureDir(networkPath);
                const destPath = path.join(networkPath, backupName);
                await fs.copy(localBackupPath, destPath);
                log.push(`✅ Network: Successfully copied to ${destPath}`);
                externalSuccessCount++;
                lastExternalPath = destPath;
                type = 'NETWORK';
            } catch (err: any) {
                log.push(`❌ Network Backup Failed: ${err.message}`);
                status = 'WARNING';
            }
        }

        // 3c. FTP Backup
        if (config.backup_ftp_enabled === 'true' && config.ftp_host && config.ftp_user) {
            const zipName = `${backupName}.zip`;
            const finalZipPath = path.join(BACKUP_DIR, zipName);

            try {
                await zipDirectory(localBackupPath, finalZipPath);
                log.push(`Starting FTP Upload to ${config.ftp_host}...`);
                const ftp = new (require('basic-ftp').Client)();
                await ftp.access({
                    host: config.ftp_host,
                    user: config.ftp_user,
                    password: config.ftp_password,
                    port: parseInt(config.ftp_port || '21'),
                    secure: false
                });

                await ftp.uploadFrom(finalZipPath, zipName);
                log.push('✅ FTP: Upload Success.');
                ftp.close();
                externalSuccessCount++;
                type = 'FTP';
                if (fs.existsSync(finalZipPath)) fs.unlinkSync(finalZipPath);
            } catch (e: any) {
                log.push(`❌ FTP Upload Failed: ${e.message}`);
                status = 'WARNING';
            }
        }

        // Cleanup Internal local folder if at least one external location succeeded
        if (externalSuccessCount > 0) {
            if (fs.existsSync(localBackupPath)) {
                await fs.remove(localBackupPath);
                log.push(`Staging folder cleaned up.`);
            }
        }

        await rotateBackups(5, log);

        // Log Success
        log.push(`[${new Date().toISOString()}] Backup operation finished.`);
        await prisma.backupLog.create({
            data: {
                status,
                type: externalSuccessCount > 1 ? 'MULTI' : type,
                details: log.join('\n'),
                path: lastExternalPath || 'Local Storage'
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
