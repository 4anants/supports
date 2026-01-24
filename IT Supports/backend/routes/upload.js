"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const fs = require('fs');
const path = require('path');

// Determine uploads directory (in root of installation)
// Navigate up from backend/routes -> backend -> root -> Assets -> uploads
const UPLOADS_DIR = path.join(__dirname, '../../Assets/uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
    try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch (e) { }
}

// File upload endpoint (Local Storage)
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

        // Generate safe unique filename
        const timestamp = Date.now();
        const ext = path.extname(uploadedFile.name);
        const safeName = `${timestamp}${ext}`;
        const targetPath = path.join(UPLOADS_DIR, safeName);

        // Move file
        uploadedFile.mv(targetPath, (err) => {
            if (err) {
                console.error('Local upload error:', err);
                return res.status(500).json({ error: 'Failed to save file locally.' });
            }

            // Construct local URL for the frontend
            // The frontend needs to access this via a static route
            const fileUrl = `/uploads/${safeName}`;
            res.json({ url: fileUrl, filename: safeName });
        });
    }
    catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;