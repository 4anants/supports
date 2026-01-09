import { Router } from 'express';
import { requireAdmin, AuthRequest } from '../middleware/auth';
import path from 'path';
import fs from 'fs';
import { UploadedFile } from 'express-fileupload';

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

        // Generate unique filename
        const timestamp = Date.now();
        const ext = path.extname(uploadedFile.name);
        const fileName = `upload_${timestamp}${ext}`;

        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filePath = path.join(uploadDir, fileName);

        // Save file
        await uploadedFile.mv(filePath);

        // Return the URL
        const fileUrl = `/uploads/${fileName}`;
        res.json({ url: fileUrl, filename: fileName });
    } catch (error: any) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
