import { Router } from 'express';
import { requireAdmin } from '../middleware/auth';
import { GoogleDriveProvider } from '../lib/providers/google';
import { OneDriveProvider } from '../lib/providers/onedrive';
import prisma from '../lib/prisma';
import { encrypt } from '../lib/crypto';

const router = Router();

// --- Google Drive Routes (Standard OAuth 3-Legged) ---

router.post('/google/init', requireAdmin, (req, res) => {
    const { clientId, clientSecret, redirectUri } = req.body;
    if (!clientId || !clientSecret || !redirectUri) return res.status(400).json({ error: 'Missing parameters' });

    // Save transient config or assume FE passes it back?
    // The requirement says "Redirect user".

    // We update settings with keys now so we have them for callback? 
    // Or we expect FE to pass them again to callback?
    // Let's save them now to be safe, or just use them for URL generation.
    // Provider expects them on instantiation.

    const provider = new GoogleDriveProvider(clientId, clientSecret);
    const url = provider.getAuthUrl(redirectUri);
    res.json({ url });
});

router.post('/google/callback', requireAdmin, async (req, res) => {
    const { code, clientId, clientSecret, redirectUri } = req.body;
    try {
        const provider = new GoogleDriveProvider(clientId, clientSecret);
        await provider.connect(code, redirectUri);

        // Save Config
        await prisma.settings.upsert({ where: { key: 'gdrive_client_id' }, create: { key: 'gdrive_client_id', value: clientId }, update: { value: clientId } });
        await prisma.settings.upsert({ where: { key: 'gdrive_client_secret' }, create: { key: 'gdrive_client_secret', value: clientSecret }, update: { value: clientSecret } });
        await prisma.settings.upsert({ where: { key: 'gdrive_enabled' }, create: { key: 'gdrive_enabled', value: 'true' }, update: { value: 'true' } });

        res.json({ success: true, message: 'Google Drive Protected Connected' });
    } catch (e: any) {
        console.error("Google Callback Error", e);
        res.status(500).json({ error: e.message });
    }
});


// --- OneDrive Routes (Standard OAuth 3-Legged) ---

router.post('/onedrive/init', requireAdmin, (req, res) => {
    const { clientId, clientSecret, redirectUri } = req.body;
    if (!clientId || !clientSecret || !redirectUri) return res.status(400).json({ error: 'Missing parameters' });

    const provider = new OneDriveProvider(clientId, clientSecret);
    const url = provider.getAuthUrl(redirectUri);
    res.json({ url });
});

router.post('/onedrive/callback', requireAdmin, async (req, res) => {
    const { code, clientId, clientSecret, redirectUri } = req.body;
    try {
        // OneDrive Graph API Exchange
        const provider = new OneDriveProvider(clientId, clientSecret);
        await provider.connect(code, redirectUri); // Connect stores Tokens in DB internally in provider

        // Save Config
        await prisma.settings.upsert({ where: { key: 'onedrive_client_id' }, create: { key: 'onedrive_client_id', value: clientId }, update: { value: clientId } });
        await prisma.settings.upsert({ where: { key: 'onedrive_client_secret' }, create: { key: 'onedrive_client_secret', value: clientSecret }, update: { value: clientSecret } });
        await prisma.settings.upsert({ where: { key: 'onedrive_enabled' }, create: { key: 'onedrive_enabled', value: 'true' }, update: { value: 'true' } });

        res.json({ success: true, message: 'OneDrive Connected' });
    } catch (e: any) {
        console.error("OneDrive Callback Error", e);
        res.status(500).json({ error: e.message });
    }
});

// Endpoint to disconnect
router.post('/disconnect', requireAdmin, async (req, res) => {
    const { provider } = req.body;
    try {
        if (provider === 'google') {
            await prisma.settings.deleteMany({ where: { key: { in: ['gdrive_refresh_token', 'gdrive_access_token', 'gdrive_enabled', 'gdrive_client_id', 'gdrive_client_secret'] } } });
        } else if (provider === 'onedrive') {
            await prisma.settings.deleteMany({ where: { key: { in: ['onedrive_refresh_token', 'onedrive_enabled', 'onedrive_client_id', 'onedrive_client_secret'] } } });
        }
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;

