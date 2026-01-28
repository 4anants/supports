import { Router } from 'express';
import { requireAdmin, AuthRequest } from '../middleware/auth';
import { UploadedFile } from 'express-fileupload';
import { UPLOADS_DIR } from '../lib/paths';

const router = Router();

// File upload endpoint for logos and backgrounds
router.post('/', requireAdmin, async (req: AuthRequest, res) => {
    try {
        if (!req.files || !req.files.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const uploadedFile = req.files.file as UploadedFile;

        // Validate file type (images only)
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(uploadedFile.mimetype)) {
            return res.status(400).json({ error: 'Invalid file type. Only images are allowed.' });
        }

        const path = require('path');
        const fs = require('fs');

        // Local Storage Path is handled by lib/paths


        // Sanitize filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(uploadedFile.name);
        const basename = path.basename(uploadedFile.name, ext).replace(/[^a-zA-Z0-9]/g, '_');
        const cleanFilename = `${basename}-${uniqueSuffix}${ext}`;
        const localPath = path.join(UPLOADS_DIR, cleanFilename);

        // Move file
        await new Promise<void>((resolve, reject) => {
            uploadedFile.mv(localPath, (err: any) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Cleanup temp file
        if (fs.existsSync(uploadedFile.tempFilePath)) {
            try { fs.unlinkSync(uploadedFile.tempFilePath); } catch (e) { }
        }

        const secureUrl = `/uploads/${cleanFilename}`;
        res.json({ url: secureUrl, filename: cleanFilename });

    } catch (error: any) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
