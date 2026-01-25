
import { google } from 'googleapis';
import prisma from '../prisma';
import { CloudProvider } from './provider.interface';
import { encrypt, decrypt } from '../crypto';
import fs from 'fs';

export class GoogleDriveProvider implements CloudProvider {
    name = 'google';
    private clientId: string;
    private clientSecret: string;

    constructor(clientId: string, clientSecret: string) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    private getClient(redirectUri?: string) {
        return new google.auth.OAuth2(
            this.clientId,
            this.clientSecret,
            redirectUri
        );
    }

    getAuthUrl(redirectUri: string): string {
        const oauth2Client = this.getClient(redirectUri);
        return oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/drive.file'],
            prompt: 'consent' // Force refresh token
        });
    }

    async connect(code: string, redirectUri: string) {
        const oauth2Client = this.getClient(redirectUri);
        const { tokens } = await oauth2Client.getToken(code);

        // Save to DB
        if (tokens.refresh_token) {
            await prisma.settings.upsert({
                where: { key: 'gdrive_refresh_token' },
                update: { value: encrypt(tokens.refresh_token) },
                create: { key: 'gdrive_refresh_token', value: encrypt(tokens.refresh_token) }
            });
        }

        await prisma.settings.upsert({
            where: { key: 'gdrive_access_token' },
            update: { value: encrypt(tokens.access_token || '') },
            create: { key: 'gdrive_access_token', value: encrypt(tokens.access_token || '') }
        });

        // Save Client ID/Secret mapping (if dynamic)
        // Usually these are static or already saved, but we ensure consistency

        return tokens;
    }

    async refreshToken(): Promise<string> {
        const encryptedRf = await prisma.settings.findUnique({ where: { key: 'gdrive_refresh_token' } });
        if (!encryptedRf) throw new Error("No Google Refresh Token found");

        const refreshToken = decrypt(encryptedRf.value);
        const oauth2Client = this.getClient();
        oauth2Client.setCredentials({ refresh_token: refreshToken });

        const { credentials } = await oauth2Client.refreshAccessToken();

        if (credentials.access_token) {
            // Update stored access token
            await prisma.settings.upsert({
                where: { key: 'gdrive_access_token' },
                update: { value: encrypt(credentials.access_token) },
                create: { key: 'gdrive_access_token', value: encrypt(credentials.access_token) }
            });
            return credentials.access_token;
        }
        throw new Error("Failed to refresh Google Token");
    }

    async uploadFile(filePath: string, fileName: string, folderName = 'MyAppBackups'): Promise<string> {
        let accessToken = '';
        try {
            accessToken = await this.refreshToken(); // Always ensure fresh token
        } catch (e) {
            throw new Error(`Google Auth Failed: ${e.message}`);
        }

        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: accessToken });
        const drive = google.drive({ version: 'v3', auth });

        // 1. Check/Create Folder
        let folderId = '';
        const folderQuery = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
        const folderRes = await drive.files.list({ q: folderQuery, spaces: 'drive' });

        if (folderRes.data.files && folderRes.data.files.length > 0) {
            folderId = folderRes.data.files[0].id!;
        } else {
            const createRes = await drive.files.create({
                requestBody: {
                    name: folderName,
                    mimeType: 'application/vnd.google-apps.folder'
                },
                fields: 'id'
            });
            folderId = createRes.data.id!;
        }

        // 2. Upload File
        const media = {
            mimeType: 'application/zip',
            body: fs.createReadStream(filePath)
        };

        const fileRes = await drive.files.create({
            requestBody: {
                name: fileName,
                parents: [folderId]
            },
            media: media,
            fields: 'id, webViewLink'
        });

        return fileRes.data.id!;
    }
}
