"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const email_1 = __importDefault(require("../lib/email"));
const router = (0, express_1.Router)();
router.post('/test', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email address required' });
        }
        await email_1.default.sendTestEmail(email);
        res.json({ success: true, message: 'Test email sent! Check Mailpit at http://localhost:8025' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/verify', async (req, res) => {
    try {
        await email_1.default.verifyConnection();
        res.json({ success: true, message: 'SMTP Connection Successful!' });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=email.js.map