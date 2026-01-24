"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Determine log directory (working directory/logs)
// This ensures it works whether running via node, pkg, or dev
const LOG_DIR = path_1.default.join(process.cwd(), 'logs');
// Ensure log directory exists
if (!fs_1.default.existsSync(LOG_DIR)) {
    try {
        fs_1.default.mkdirSync(LOG_DIR, { recursive: true });
    }
    catch (e) {
        // If we can't create logs dir, we probably can't log either.
        console.error("FATAL: Could not create logs directory:", e);
    }
}
const getTimestamp = () => new Date().toISOString();
const formatMessage = (message, ...args) => {
    const argsStr = args.length ? ' ' + args.map(a => {
        if (a instanceof Error)
            return a.stack;
        if (typeof a === 'object')
            return JSON.stringify(a);
        return a;
    }).join(' ') : '';
    return message + argsStr;
};
const logToFile = (filename, level, message) => {
    try {
        const logLine = `[${getTimestamp()}] [${level}] ${message}\n`;
        fs_1.default.appendFileSync(path_1.default.join(LOG_DIR, filename), logLine);
    }
    catch (e) {
        console.error('Failed to write to log file:', e);
    }
};
exports.logger = {
    info: (message, ...args) => {
        const formatted = formatMessage(message, ...args);
        console.log(message, ...args); // Still log to stdout
        logToFile('app.log', 'INFO', formatted);
    },
    warn: (message, ...args) => {
        const formatted = formatMessage(message, ...args);
        console.warn(message, ...args);
        logToFile('app.log', 'WARN', formatted);
    },
    error: (message, ...args) => {
        const formatted = formatMessage(message, ...args);
        console.error(message, ...args);
        logToFile('error.log', 'ERROR', formatted);
        logToFile('app.log', 'ERROR', formatted);
    },
    // Specific for HTTP requests (can be used with morgan if needed, but manual for now)
    http: (message) => {
        console.log(message);
        logToFile('access.log', 'HTTP', message);
    }
};
//# sourceMappingURL=logger.js.map