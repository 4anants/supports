import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5050;

// Middleware
app.use(cors());
app.use(express.json());

// Nodemailer Transporter
const createTransporter = () => {
    // Check if using Service (Gmail) or Custom Host
    if (process.env.SMTP_SERVICE) {
        return nodemailer.createTransport({
            service: process.env.SMTP_SERVICE, // e.g., 'gmail'
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    } else {
        // Custom SMTP
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            tls: {
                rejectUnauthorized: false
            }
        });
    }
};

// Health Check
app.get('/', (req, res) => {
    res.send('Email Server is Running');
});

// Send Endpoint
app.post('/send-email', async (req, res) => {
    const { to, subject, html, fromName } = req.body;

    if (!to || !subject || !html) {
        return res.status(400).json({ success: false, error: "Missing fields" });
    }

    try {
        const transporter = createTransporter();

        // Formatting From Address
        const fromAddress = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
        const sender = fromName ? `"${fromName}" <${fromAddress}>` : fromAddress;

        const info = await transporter.sendMail({
            from: sender,
            to: to,
            subject: subject,
            html: html
        });

        console.log(`[Email] Sent to ${to} | ID: ${info.messageId}`);
        res.status(200).json({ success: true, messageId: info.messageId });

    } catch (error) {
        console.error('[Email Failed]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Serve React Frontend (Production)
app.use(express.static(join(__dirname, 'dist')));

// SPA Fallback: Any route not handled above returns index.html
app.use((req, res) => {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n📧 Email Service Running on http://localhost:${PORT}`);
    console.log(`   - SMTP User: ${process.env.SMTP_USER || 'Not Set'}\n`);
});
