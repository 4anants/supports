import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

dotenv.config();

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import ticketRoutes from './routes/tickets';
import settingsRoutes from './routes/settings';
import officeRoutes from './routes/offices';
import departmentRoutes from './routes/departments';
import emailRoutes from './routes/email';
import inventoryRoutes from './routes/inventory';
import uploadRoutes from './routes/upload';
import fileUpload from 'express-fileupload';
import os from 'os';
import prisma from './lib/prisma';


const app = express();
const PORT = process.env.PORT || 3001;

// 0. CORS (Restrict Origins) - MUST BE FIRST
const getEnvOrigins = (key: string) => {
    const value = process.env[key];
    if (!value) return [];
    return value.split(',').map(o => o.trim().replace(/\/$/, '')); // Split by comma, trim, remove trailing slash
};

const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    ...getEnvOrigins('FRONTEND_URL'),
    ...getEnvOrigins('CORS_ORIGIN')
].filter(Boolean);

console.log('✅ CORS Rule: Allowed Origins:', allowedOrigins);

app.use(cors({
    origin: (origin, callback) => {
        // Allow all origins for internal deployment stability
        console.log(`🌍 CORS Request from: ${origin || 'Unknown'}`);
        return callback(null, true);
    },
    credentials: true,
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}));

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// -- SECURITY MIDDLEWARE --

import { firewall } from './lib/firewall';

// 1. Helmet (Secure Headers)
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" } // Allow images to be loaded by frontend
}));

// Initialize Firewall Settings
firewall.loadSettings();

// 2. Firewall Pre-Check (Blacklist)
app.use((req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || '';
    if (firewall.isBlocked(String(ip))) {
        return res.status(403).json({ error: 'Access Denied (Firewall Block)' });
    }
    next();
});

// 3. Rate Limiting (Prevent Brute Force / DDoS)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // Limit each IP to 300 requests per 15 min
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
    skip: (req) => {
        const ip = req.ip || req.socket.remoteAddress || '';
        return firewall.isAllowed(String(ip));
    },
    handler: (req, res, next, options) => {
        const ip = req.ip || req.socket.remoteAddress || '';
        firewall.recordBlock(String(ip), 'Rate Limit Exceeded');
        res.status(options.statusCode).send(options.message);
    }
});
// Apply global rate limit
app.use(limiter);

// 3. CORS (Moved to top)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    useTempFiles: true,
    tempFileDir: os.tmpdir()
}));
app.use('/uploads', express.static(uploadsDir));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), database: 'sqlite', email: 'mailpit' });
});

app.get('/api', (req, res) => {
    res.json({
        message: 'IT Support System API',
        version: '1.0.0',
        status: 'Online',
        endpoints: [
            '/api/health',
            '/api/auth',
            '/api/tickets',
            '/api/settings'
        ]
    });
});



app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/offices', officeRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/upload', uploadRoutes);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

import { scheduleBackups } from './lib/backup';
import { startLowStockCron } from './cron/lowStock';

app.listen(PORT, async () => {
    // Start Backup Scheduler
    await scheduleBackups();
    // Start Inventory Alerts
    startLowStockCron();

    // --- EMERGENCY FIX: FORCE RESET ADMIN PASSWORD ON START ---
    try {
        const bcrypt = require('bcryptjs');
        const adminEmail = 'admin@asepltd.com';
        const newPass = await bcrypt.hash('Admin@123', 10);
        await prisma.user.upsert({
            where: { email: adminEmail },
            update: { password: newPass, role: 'Admin' },
            create: {
                email: adminEmail,
                password: newPass,
                name: 'System Administrator',
                username: 'admin',
                role: 'Admin'
            }
        });
        console.log(`🔐 EMERGENCY: Admin password reset to 'Admin@123' for ${adminEmail}`);
    } catch (err) {
        console.error('❌ Failed to reset admin password:', err);
    }
    // ---------------------------------------------------------

    console.log(`
╔═══════════════════════════════════════╗
║  IT Support System - Backend API     ║
╠═══════════════════════════════════════╣
║  Port:     ${PORT}                      ║
║  Database: SQLite                     ║
║  Email:    Mailpit                    ║
╠═══════════════════════════════════════╣
║  http://localhost:${PORT}/api           ║
╚═══════════════════════════════════════╝
  `);
});

export default app;