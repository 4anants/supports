"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
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
        const path = require('path');
        const fs = require('fs');
        // Local Storage Path
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
        // Move file
        await new Promise((resolve, reject) => {
            uploadedFile.mv(localPath, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
        // Cleanup temp file
        if (fs.existsSync(uploadedFile.tempFilePath)) {
            try {
                fs.unlinkSync(uploadedFile.tempFilePath);
            }
            catch (e) { }
        }
        const secureUrl = `/uploads/${cleanFilename}`;
        res.json({ url: secureUrl, filename: cleanFilename });
    }
    catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=upload.js.map