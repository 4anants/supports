import cron, { ScheduledTask } from 'node-cron';
import fs from 'fs-extra';
import path from 'path';
import archiver from 'archiver';
import prisma from './prisma';
import axios from 'axios';

// Define paths
export const BACKUP_DIR = path.join(__dirname, '../../backups');
export const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const DB_PATH = path.join(__dirname, '../../prisma/dev.db'); // Assuming standard location

// Ensure local backup directory exists
fs.ensureDirSync(BACKUP_DIR);

export const performBackup = async (externalPath?: string) => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const backupName = `ITSupports_${dateStr}_${timeStr}`;
    const localBackupPath = path.join(BACKUP_DIR, backupName);

    // Create specific folder for this backup
    await fs.ensureDir(localBackupPath);

    const log: string[] = [];
    let status = 'SUCCESS';
    let type = 'LOCAL';

    try {
        log.push(`[${new Date().toISOString()}] Starting backup: ${backupName}`);

        // 1. Backup Database (SQLite Safe Copy)
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

        // 3. Copy to External Path (OneDrive) if configured/provided
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
        }

        // 4. Upload to OneDrive (Graph API - Cloud Direct)
        const oneDriveEnabled = await prisma.settings.findUnique({ where: { key: 'onedrive_enabled' } });
        if (oneDriveEnabled?.value === 'true') {
            try {
                log.push('Starting OneDrive Cloud Upload...');
                // Create a single zip of the entire backup folder for easier cloud storage
                const finalZipPath = path.join(BACKUP_DIR, `${backupName}.zip`);
                await zipDirectory(localBackupPath, finalZipPath);

                await uploadToOneDrive(finalZipPath, `${backupName}.zip`, log);

                // Cleanup the temporary zip
                fs.unlinkSync(finalZipPath);
                log.push('OneDrive Upload Complete.');
                type = 'CLOUD';

                // --- KEY CHANGE: CLEANUP LOCAL FILES IF CLOUD SUCCESSFUL ---
                // User requested: "remove if any local data is there"
                if (fs.existsSync(localBackupPath)) {
                    await fs.remove(localBackupPath);
                    log.push('Local backup files removed (Cloud Only Mode).');
                }

            } catch (cloudErr: any) {
                log.push(`OneDrive Upload FAILED: ${cloudErr.message}`);
                console.error('OneDrive Error:', cloudErr);
                // Don't fail the whole backup just because cloud upload failed, but log it.
                status = 'PARTIAL_FAIL';
            }
        }

        log.push(`[${new Date().toISOString()}] Backup completed successfully.`);

        // Log to DB
        await prisma.backupLog.create({
            data: {
                status,
                type,
                details: log.join('\n'),
                path: type === 'CLOUD' ? 'OneDrive' : localBackupPath
            }
        });

        return { success: true, log, location: localBackupPath };

    } catch (error: any) {
        log.push(`[${new Date().toISOString()}] Backup FAILED: ${error.message}`);
        console.error('Backup Error:', error);

        // Log Failure to DB
        await prisma.backupLog.create({
            data: {
                status: 'FAILED',
                type: 'LOCAL',
                details: log.join('\n'),
                path: localBackupPath
            }
        });

        return { success: false, log, error: error.message };
    }
};

// --- OneDrive / Graph API Helper ---
const uploadToOneDrive = async (filePath: string, fileName: string, log: string[]) => {
    // 1. Get Settings
    const settings = await prisma.settings.findMany({
        where: { key: { in: ['onedrive_client_id', 'onedrive_client_secret', 'onedrive_refresh_token', 'onedrive_folder'] } }
    });
    const config = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value ? s.value.trim() : '' }), {} as any);

    if (!config.onedrive_client_id || !config.onedrive_client_secret || !config.onedrive_refresh_token) {
        throw new Error('OneDrive credentials missing in settings.');
    }

    // 2. Refresh Token
    log.push('Refreshing OneDrive Access Token...');
    const tokenResponse = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token',
        new URLSearchParams({
            client_id: config.onedrive_client_id,
            client_secret: config.onedrive_client_secret,
            refresh_token: config.onedrive_refresh_token,
            grant_type: 'refresh_token'
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const accessToken = tokenResponse.data.access_token;
    // Optionally update refresh token if a new one is returned
    if (tokenResponse.data.refresh_token) {
        await prisma.settings.upsert({
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

    const sessionRes = await axios.post(
        `https://graph.microsoft.com/v1.0/me/drive/root:/${cleanFolder}/${fileName}:/createUploadSession`,
        {
            item: {
                "@microsoft.graph.conflictBehavior": "replace"
            }
        },
        { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const uploadUrl = sessionRes.data.uploadUrl;
    const fileStats = fs.statSync(filePath);
    const fileSize = fileStats.size;

    // Stream upload in chunks (10MB chunks)
    const CHUNK_SIZE = 320 * 1024 * 32; // ~10MB (multiple of 320KiB)
    const buffer = Buffer.alloc(CHUNK_SIZE);
    const fd = fs.openSync(filePath, 'r');

    let start = 0;
    while (start < fileSize) {
        const bytesRead = fs.readSync(fd, buffer, 0, CHUNK_SIZE, start);
        const end = start + bytesRead - 1;

        // Retry logic for chunks could be added here
        await axios.put(uploadUrl, buffer.slice(0, bytesRead), {
            headers: {
                'Content-Length': bytesRead,
                'Content-Range': `bytes ${start}-${end}/${fileSize}`
            }
        });

        start += bytesRead;
    }

    fs.closeSync(fd);
    log.push(`Successfully uploaded ${fileName} to OneDrive at /${cleanFolder}/`);
};

// Helper to zip directory
const zipDirectory = (source: string, out: string) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = fs.createWriteStream(out);

    return new Promise<void>((resolve, reject) => {
        archive
            .directory(source, false)
            .on('error', err => reject(err))
            .pipe(stream);

        stream.on('close', () => resolve());
        archive.finalize();
    });
};

// Scheduling Service
// Valid schedules: 'DAILY' (0 0 * * *), 'WEEKLY' (0 0 * * 0)
let scheduledTask: ScheduledTask | null = null;

export const scheduleBackups = async () => {
    if (scheduledTask) {
        scheduledTask.stop();
        scheduledTask = null;
    }

    const frequencySetting = await prisma.settings.findUnique({ where: { key: 'backup_frequency' } });
    const frequency = frequencySetting?.value || 'NEVER';

    if (frequency === 'NEVER') return;

    let cronExpression = '0 0 * * *'; // Default Daily
    if (frequency === 'WEEKLY') cronExpression = '0 0 * * 0'; // Sunday midnight

    console.log(`📅 Scheduling backups: ${frequency} (${cronExpression})`);

    scheduledTask = cron.schedule(cronExpression, async () => {
        console.log('⏰ Running scheduled backup...');
        await performBackup();
    });
};
