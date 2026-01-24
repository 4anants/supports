import 'dotenv/config';
import cloudinary from './lib/cloudinary';
import { createClient } from '@libsql/client';
import path from 'path';

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

const client = createClient({
    url: TURSO_URL!,
    authToken: TURSO_TOKEN!
});

const WALLPAPER_PATH = path.join(__dirname, '../uploads/upload_1768330057250.jpg');

async function fixWallpaper() {
    console.log('🖼️  Fixing Wallpaper...');

    // 1. Upload
    let url = '';
    try {
        const res = await cloudinary.uploader.upload(WALLPAPER_PATH, {
            folder: 'support-portal/assets',
            public_id: 'default_wallpaper'
        });
        url = res.secure_url;
        console.log('✅ Uploaded:', url);
    } catch (e: any) {
        console.error('❌ Upload Failed:', e.message);
        process.exit(1);
    }

    // 2. Update DB
    try {
        // Upsert background_url
        await client.execute({
            sql: `INSERT INTO Settings (id, key, value) VALUES (lower(hex(randomblob(16))), 'background_url', ?) 
                  ON CONFLICT(key) DO UPDATE SET value = ?`,
            args: [url, url]
        });
        console.log('✅ Updated background_url');

        // Also check/update company_logo if needed (using same logic or letting it be)
        // Check current logo
        const logoRes = await client.execute("SELECT value FROM Settings WHERE key='logo_url'");
        if (logoRes.rows.length === 0) {
            console.log('⚠️ No logo_url found. Setting default...');
            // Maybe use same image or another if available
        } else {
            console.log('ℹ️ Logo URL exists:', logoRes.rows[0].value);
        }

    } catch (e: any) {
        console.error('❌ DB Update Failed:', e.message);
    }
}

fixWallpaper();
