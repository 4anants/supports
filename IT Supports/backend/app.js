"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express_fileupload_1 = __importDefault(require("express-fileupload"));
const os_1 = __importDefault(require("os"));
dotenv_1.default.config();
const auth_1 = __importDefault(require("./routes/auth"));
const users_1 = __importDefault(require("./routes/users"));
const tickets_1 = __importDefault(require("./routes/tickets"));
const settings_1 = __importDefault(require("./routes/settings"));
const offices_1 = __importDefault(require("./routes/offices"));
const departments_1 = __importDefault(require("./routes/departments"));
const email_1 = __importDefault(require("./routes/email"));
const inventory_1 = __importDefault(require("./routes/inventory"));
const upload_1 = __importDefault(require("./routes/upload"));
const firewall_1 = require("./lib/firewall");
const logger_1 = require("./lib/logger");
const app = (0, express_1.default)();
// 0. CORS (Restrict Origins) - MUST BE FIRST
const getEnvOrigins = (key) => {
    const value = process.env[key];
    if (!value)
        return [];
    return value.split(',').map(o => o.trim().replace(/\/$/, '')); // Split by comma, trim, remove trailing slash
};
const allowedOrigins = [
    'http://localhost:3002',
    ...getEnvOrigins('FRONTEND_URL'),
    ...getEnvOrigins('CORS_ORIGIN')
].filter(Boolean);
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        console.warn(`⛔ Blocked CORS Request from: ${origin}`);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    optionsSuccessStatus: 200
}));
// Enable local uploads directory for fallback
const uploadsDir = path_1.default.join(__dirname, '../uploads');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
// 1. Helmet (Secure Headers)
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
// Initialize Firewall Settings (disabled for serverless)
// firewall.loadSettings();
// 2. Firewall Pre-Check (Blacklist)
app.use((req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || '';
    if (firewall_1.firewall.isBlocked(String(ip))) {
        return res.status(403).json({ error: 'Access Denied (Firewall Block)' });
    }
    next();
});
// 3. Rate Limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
    skip: (req) => {
        const ip = req.ip || req.socket.remoteAddress || '';
        return firewall_1.firewall.isAllowed(String(ip));
    },
    handler: (req, res, next, options) => {
        const ip = req.ip || req.socket.remoteAddress || '';
        firewall_1.firewall.recordBlock(String(ip), 'Rate Limit Exceeded');
        res.status(options.statusCode).send(options.message);
    }
});
app.use(limiter);
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, express_fileupload_1.default)({
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB Max
    useTempFiles: true,
    tempFileDir: os_1.default.tmpdir()
}));
app.use('/uploads', express_1.default.static(uploadsDir));
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), database: 'turso', storage: 'cloudinary' });
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
app.use('/api/auth', auth_1.default);
app.use('/api/users', users_1.default);
app.use('/api/tickets', tickets_1.default);
app.use('/api/settings', settings_1.default);
app.use('/api/offices', offices_1.default);
app.use('/api/departments', departments_1.default);
app.use('/api/email', email_1.default);
app.use('/api/inventory', inventory_1.default);
app.use('/api/upload', upload_1.default);
// Serve Frontend in Production
const clientBuildPath = path_1.default.join(__dirname, '../../client');
if (fs_1.default.existsSync(clientBuildPath)) {
    logger_1.logger.info(`🚀 Serving Frontend from: ${clientBuildPath}`);
    app.use(express_1.default.static(clientBuildPath));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) {
            return res.status(404).json({ error: 'API Endpoint Not Found' });
        }
        res.sendFile(path_1.default.join(clientBuildPath, 'index.html'));
    });
}
app.use((err, req, res, next) => {
    logger_1.logger.error('Request Error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});
exports.default = app;
//# sourceMappingURL=app.js.map