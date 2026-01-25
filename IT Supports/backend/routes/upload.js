"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const cloudinary_1 = __importDefault(require("../lib/cloudinary"));
const router = (0, express_1.Router)();
// File upload endpoint for logos and backgrounds
router.post('/', auth_1.requireAdmin, async (req, res) => {
    try {
        if (!req.files || !req.files.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const uploadedFile = req.files.file;
        // Validate file type (images only)
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(uploadedFile.mimetype)) {
            return res.status(400).json({ error: 'Invalid file type. Only images are allowed.' });
        }
        let secureUrl = '';
        let publicId = '';
        try {
            // Try Cloudinary First
            if (!process.env.CLOUDINARY_CLOUD_NAME)
                throw new Error('Cloudinary not configured');
            const result = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary_1.default.uploader.upload_stream({
                    folder: 'support-portal/assets',
                    resource_type: 'image',
                }, (error, result) => {
                    if (error)
                        reject(error);
                    else
                        resolve(result);
                });
                // Stream from temp file
                const fs = require('fs');
                fs.createReadStream(uploadedFile.tempFilePath).pipe(uploadStream);
            });
            secureUrl = result.secure_url;
            publicId = result.public_id;
        }
        catch (cloudError) {
            console.warn('[API] Cloudinary upload failed or not configured. Using local fallback.', cloudError);
            const path = require('path');
            const fs = require('fs');
            // Local Fallback
            const uploadsDir = path.join(__dirname, '../../uploads');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }
            // Sanitize filename
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const ext = path.extname(uploadedFile.name);
            const basename = path.basename(uploadedFile.name, ext).replace(/[^a-zA-Z0-9]/g, '_');
            const cleanFilename = `${basename}-${uniqueSuffix}${ext}`;
            const localPath = path.join(uploadsDir, cleanFilename);
            await new Promise((resolve, reject) => {
                uploadedFile.mv(localPath, (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            secureUrl = `/uploads/${cleanFilename}`;
            publicId = cleanFilename;
        }
        // Cleanup temp file
        const fs = require('fs');
        if (fs.existsSync(uploadedFile.tempFilePath)) {
            try {
                fs.unlinkSync(uploadedFile.tempFilePath);
            }
            catch (e) { }
        }
        res.json({ url: secureUrl, filename: publicId });
    }
    catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=upload.js.map