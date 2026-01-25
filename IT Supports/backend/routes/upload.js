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
        // Upload to Cloudinary
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
        // Cleanup temp file
        const fs = require('fs');
        if (fs.existsSync(uploadedFile.tempFilePath)) {
            fs.unlinkSync(uploadedFile.tempFilePath);
        }
        res.json({ url: result.secure_url, filename: result.public_id });
    }
    catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=upload.js.map