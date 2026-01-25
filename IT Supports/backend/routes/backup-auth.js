"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const axios_1 = __importDefault(require("axios"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const router = (0, express_1.Router)();
// --- ONE DRIVE DEVICE FLOW ---
// https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code
router.post('/onedrive/init', auth_1.requireAdmin, async (req, res) => {
    try {
        const { clientId } = req.body;
        if (!clientId)
            return res.status(400).json({ error: 'Client ID is required' });
        // 1. Request Device Code
        const params = new URLSearchParams({
            client_id: clientId,
            scope: 'Files.ReadWrite.All offline_access User.Read'
        });
        const response = await axios_1.default.post('https://login.microsoftonline.com/common/oauth2/v2.0/devicecode', params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        // Returns: user_code, device_code, verification_uri, expires_in, interval
        res.json(response.data);
    }
    catch (error) {
        console.error('OneDrive Init Error:', error.response?.data || error.message);
        res.status(500).json({ error: error.response?.data?.error_description || error.message });
    }
});
router.post('/onedrive/poll', auth_1.requireAdmin, async (req, res) => {
    try {
        const { clientId, deviceCode } = req.body;
        const params = new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            client_id: clientId,
            device_code: deviceCode
        });
        const response = await axios_1.default.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        // If successful, we get access_token, refresh_token
        const { refresh_token, access_token } = response.data;
        // Save to DB
        await prisma_1.default.settings.upsert({ where: { key: 'onedrive_client_id' }, create: { key: 'onedrive_client_id', value: clientId }, update: { value: clientId } });
        await prisma_1.default.settings.upsert({ where: { key: 'onedrive_refresh_token' }, create: { key: 'onedrive_refresh_token', value: refresh_token }, update: { value: refresh_token } });
        await prisma_1.default.settings.upsert({ where: { key: 'onedrive_enabled' }, create: { key: 'onedrive_enabled', value: 'true' }, update: { value: 'true' } });
        // We assume Public Client (no secret) for method 1, or user provides it. 
        // If Device Flow is used, Client Secret is NOT required for "Public" app registrations (Mobile/Desktop).
        // We will clear the client_secret setting to avoid confusion if it existed
        await prisma_1.default.settings.deleteMany({ where: { key: 'onedrive_client_secret' } });
        res.json({ success: true, message: 'OneDrive Connected!' });
    }
    catch (error) {
        // Expected error while pending: "authorization_pending"
        const errData = error.response?.data;
        if (errData && errData.error === 'authorization_pending') {
            return res.json({ pending: true });
        }
        console.error('OneDrive Poll Error:', errData || error.message);
        res.status(error.response?.status || 500).json({ error: errData?.error_description || error.message });
    }
});
// --- GOOGLE DRIVE DEVICE FLOW ---
// https://developers.google.com/identity/protocols/oauth2/limited-input-device
router.post('/google/init', auth_1.requireAdmin, async (req, res) => {
    try {
        const { clientId, clientSecret } = req.body; // Google Device Flow technically supports secret-less for some types, but mostly needs Client ID.
        if (!clientId)
            return res.status(400).json({ error: 'Client ID is required' });
        const params = new URLSearchParams({
            client_id: clientId,
            scope: 'https://www.googleapis.com/auth/drive.file'
        });
        const response = await axios_1.default.post('https://oauth2.googleapis.com/device/code', params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        // Returns: device_code, user_code, verification_url, expires_in, interval
        res.json(response.data);
    }
    catch (error) {
        console.error('Google Init Error:', error.response?.data || error.message);
        res.status(500).json({ error: error.message });
    }
});
router.post('/google/poll', auth_1.requireAdmin, async (req, res) => {
    try {
        const { clientId, clientSecret, deviceCode } = req.body;
        const params = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret || '', // Optional for some app types
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        });
        const response = await axios_1.default.post('https://oauth2.googleapis.com/token', params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        const { refresh_token, access_token } = response.data;
        // Save to DB
        await prisma_1.default.settings.upsert({ where: { key: 'gdrive_client_id' }, create: { key: 'gdrive_client_id', value: clientId }, update: { value: clientId } });
        if (clientSecret)
            await prisma_1.default.settings.upsert({ where: { key: 'gdrive_client_secret' }, create: { key: 'gdrive_client_secret', value: clientSecret }, update: { value: clientSecret } });
        await prisma_1.default.settings.upsert({ where: { key: 'gdrive_refresh_token' }, create: { key: 'gdrive_refresh_token', value: refresh_token }, update: { value: refresh_token } });
        await prisma_1.default.settings.upsert({ where: { key: 'gdrive_enabled' }, create: { key: 'gdrive_enabled', value: 'true' }, update: { value: 'true' } });
        res.json({ success: true, message: 'Google Drive Connected!' });
    }
    catch (error) {
        const errData = error.response?.data;
        if (errData && errData.error === 'authorization_pending') {
            return res.json({ pending: true });
        }
        console.error('Google Poll Error:', errData || error.message);
        res.status(500).json({ error: errData?.error_description || error.message });
    }
});
exports.default = router;
//# sourceMappingURL=backup-auth.js.map