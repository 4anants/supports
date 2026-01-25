"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OneDriveProvider = void 0;
const microsoft_graph_client_1 = require("@microsoft/microsoft-graph-client");
require("isomorphic-fetch");
const prisma_1 = __importDefault(require("../prisma"));
const crypto_1 = require("../crypto");
const fs_1 = __importDefault(require("fs"));
class OneDriveProvider {
    name = 'onedrive';
    clientId;
    clientSecret;
    constructor(clientId, clientSecret) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }
    getAuthUrl(redirectUri) {
        const params = new URLSearchParams({
            client_id: this.clientId,
            scope: 'Files.ReadWrite offline_access',
            response_type: 'code',
            redirect_uri: redirectUri
        });
        return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
    }
    async connect(code, redirectUri) {
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
        const data = await response.json();
        if (!response.ok)
            throw new Error(data.error_description || data.error);
        if (data.refresh_token) {
            await prisma_1.default.settings.upsert({
                where: { key: 'onedrive_refresh_token' },
                update: { value: (0, crypto_1.encrypt)(data.refresh_token) },
                create: { key: 'onedrive_refresh_token', value: (0, crypto_1.encrypt)(data.refresh_token) }
            });
        }
        return data;
    }
    async refreshToken() {
        const encryptedRf = await prisma_1.default.settings.findUnique({ where: { key: 'onedrive_refresh_token' } });
        if (!encryptedRf)
            throw new Error("No OneDrive Refresh Token found");
        const refreshToken = (0, crypto_1.decrypt)(encryptedRf.value);
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
        const data = await response.json();
        if (!response.ok)
            throw new Error("Failed to refresh OneDrive token: " + data.error);
        // Update Refreshed Token if changed
        if (data.refresh_token) {
            await prisma_1.default.settings.upsert({
                where: { key: 'onedrive_refresh_token' },
                update: { value: (0, crypto_1.encrypt)(data.refresh_token) },
                create: { key: 'onedrive_refresh_token', value: (0, crypto_1.encrypt)(data.refresh_token) }
            });
        }
        return data.access_token;
    }
    async uploadFile(filePath, fileName, folderName = 'MyAppBackups') {
        const accessToken = await this.refreshToken();
        const client = microsoft_graph_client_1.Client.init({
            authProvider: (done) => done(null, accessToken)
        });
        // 1. Create Folder logic (Graph API doesn't support recursive 'ensure' easily, assume simple structure)
        // Check if folder exists or create
        try {
            // Try to access folder, if 404 create
            await client.api(`/me/drive/root:/${folderName}`).get();
        }
        catch (e) {
            if (e.statusCode === 404) {
                await client.api('/me/drive/root/children').post({
                    name: folderName,
                    folder: {},
                    "@microsoft.graph.conflictBehavior": "rename"
                });
            }
        }
        // 2. Upload Large File (Session)
        const fileStats = fs_1.default.statSync(filePath);
        const uploadSession = await client.api(`/me/drive/root:/${folderName}/${fileName}:/createUploadSession`).post({
            item: {
                "@microsoft.graph.conflictBehavior": "replace"
            }
        });
        const uploadUrl = uploadSession.uploadUrl;
        // Manual range upload loop using fetch for better control
        const CHUNK_SIZE = 320 * 1024 * 10; // 3MB chunks
        const fd = fs_1.default.openSync(filePath, 'r');
        let start = 0;
        while (start < fileStats.size) {
            const chunkBuffer = Buffer.alloc(CHUNK_SIZE);
            const bytesRead = fs_1.default.readSync(fd, chunkBuffer, 0, CHUNK_SIZE, start);
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
                fs_1.default.closeSync(fd);
                throw new Error(`Upload failed at chunk ${start}: ${res.statusText}`);
            }
            start += bytesRead;
        }
        fs_1.default.closeSync(fd);
        return "Upload Complete";
    }
}
exports.OneDriveProvider = OneDriveProvider;
//# sourceMappingURL=onedrive.js.map