import { Router } from 'express';
import { requireAdmin, AuthRequest } from '../middleware/auth';
import { UploadedFile } from 'express-fileupload';
import cloudinary from '../lib/cloudinary';

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

        // Upload to Cloudinary
        const result: any = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'support-portal/assets',
                    resource_type: 'image',
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            // Stream from temp file
            const fs = require('fs');
            fs.createReadStream(uploadedFile.tempFilePath).pipe(uploadStream);
        });

        // Cleanup temp file
        const fs = require('fs');
        if (fs.existsSync(uploadedFile.tempFilePath)) {
            fs.unlinkSync(uploadedFile.tempFilePath);
        }

        res.json({ url: result.secure_url, filename: result.public_id });
    } catch (error: any) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
