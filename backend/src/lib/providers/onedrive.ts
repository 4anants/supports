
import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';
import prisma from '../prisma';
import { CloudProvider } from './provider.interface';
import { encrypt, decrypt } from '../crypto';
import fs from 'fs';

export class OneDriveProvider implements CloudProvider {
    name = 'onedrive';
    private clientId: string;
    private clientSecret: string;

    constructor(clientId: string, clientSecret: string) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    getAuthUrl(redirectUri: string): string {
        const params = new URLSearchParams({
            client_id: this.clientId,
            scope: 'Files.ReadWrite offline_access',
            response_type: 'code',
            redirect_uri: redirectUri
        });
        return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
    }

    async connect(code: string, redirectUri: string) {
        const params = new URLSearchParams();
        params.append('client_id', this.clientId);
        params.append('scope', 'Files.ReadWrite offline_access');
        params.append('code', code);
        params.append('redirect_uri', redirectUri);
        params.append('grant_type', 'authorization_code');
        params.append('client_secret', this.clientSecret);

        const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
            method: 'POST',
            body: params,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const data: any = await response.json();
        if (!response.ok) throw new Error(data.error_description || data.error);

        if (data.refresh_token) {
            await prisma.settings.upsert({
                where: { key: 'onedrive_refresh_token' },
                update: { value: encrypt(data.refresh_token) },
                create: { key: 'onedrive_refresh_token', value: encrypt(data.refresh_token) }
            });
        }

        return data;
    }

    async refreshToken(): Promise<string> {
        const encryptedRf = await prisma.settings.findUnique({ where: { key: 'onedrive_refresh_token' } });
        if (!encryptedRf) throw new Error("No OneDrive Refresh Token found");

        const refreshToken = decrypt(encryptedRf.value);

        const params = new URLSearchParams({
            client_id: this.clientId,
            client_secret: this.clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
        });

        const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
            method: 'POST',
            body: params,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const data: any = await response.json();
        if (!response.ok) throw new Error("Failed to refresh OneDrive token: " + data.error);

        // Update Refreshed Token if changed
        if (data.refresh_token) {
            await prisma.settings.upsert({
                where: { key: 'onedrive_refresh_token' },
                update: { value: encrypt(data.refresh_token) },
                create: { key: 'onedrive_refresh_token', value: encrypt(data.refresh_token) }
            });
        }

        return data.access_token;
    }

    async uploadFile(filePath: string, fileName: string, folderName = 'MyAppBackups'): Promise<string> {
        const accessToken = await this.refreshToken();

        const client = Client.init({
            authProvider: (done) => done(null, accessToken)
        });

        // 1. Create Folder logic (Graph API doesn't support recursive 'ensure' easily, assume simple structure)
        // Check if folder exists or create
        try {
            // Try to access folder, if 404 create
            await client.api(`/me/drive/root:/${folderName}`).get();
        } catch (e: any) {
            if (e.statusCode === 404) {
                await client.api('/me/drive/root/children').post({
                    name: folderName,
                    folder: {},
                    "@microsoft.graph.conflictBehavior": "rename"
                });
            }
        }

        // 2. Upload Large File (Session)
        const fileStats = fs.statSync(filePath);
        const uploadSession = await client.api(`/me/drive/root:/${folderName}/${fileName}:/createUploadSession`).post({
            item: {
                "@microsoft.graph.conflictBehavior": "replace"
            }
        });

        const uploadUrl = uploadSession.uploadUrl;

        // Manual range upload loop using fetch for better control
        const CHUNK_SIZE = 320 * 1024 * 10; // 3MB chunks
        const fd = fs.openSync(filePath, 'r');
        let start = 0;

        while (start < fileStats.size) {
            const chunkBuffer = Buffer.alloc(CHUNK_SIZE);
            const bytesRead = fs.readSync(fd, chunkBuffer, 0, CHUNK_SIZE, start);
            const end = start + bytesRead - 1;

            const res = await fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                    'Content-Length': bytesRead.toString(),
                    'Content-Range': `bytes ${start}-${end}/${fileStats.size}`
                },
                body: chunkBuffer.slice(0, bytesRead)
            });

            if (!res.ok) {
                fs.closeSync(fd);
                throw new Error(`Upload failed at chunk ${start}: ${res.statusText}`);
            }
            start += bytesRead;
        }

        fs.closeSync(fd);
        return "Upload Complete";
    }
}
