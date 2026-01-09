import { Router } from 'express';
import emailService from '../lib/email';

const router = Router();

router.post('/test', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email address required' });
        }

        await emailService.sendTestEmail(email);
        res.json({ success: true, message: 'Test email sent! Check Mailpit at http://localhost:8025' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/verify', async (req, res) => {
    try {
        await emailService.verifyConnection();
        res.json({ success: true, message: 'SMTP Connection Successful!' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
