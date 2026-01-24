import fs from 'fs';
import path from 'path';

// Determine log directory (working directory/logs)
// This ensures it works whether running via node, pkg, or dev
const LOG_DIR = path.join(process.cwd(), 'logs');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
    try {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    } catch (e) {
        // If we can't create logs dir, we probably can't log either.
        console.error("FATAL: Could not create logs directory:", e);
    }
}

const getTimestamp = () => new Date().toISOString();

const formatMessage = (message: string, ...args: any[]) => {
    const argsStr = args.length ? ' ' + args.map(a => {
        if (a instanceof Error) return a.stack;
        if (typeof a === 'object') return JSON.stringify(a);
        return a;
    }).join(' ') : '';
    return message + argsStr;
};

const logToFile = (filename: string, level: string, message: string) => {
    try {
        const logLine = `[${getTimestamp()}] [${level}] ${message}\n`;
        fs.appendFileSync(path.join(LOG_DIR, filename), logLine);
    } catch (e) {
        console.error('Failed to write to log file:', e);
    }
};

export const logger = {
    info: (message: string, ...args: any[]) => {
        const formatted = formatMessage(message, ...args);
        console.log(message, ...args); // Still log to stdout
        logToFile('app.log', 'INFO', formatted);
    },

    warn: (message: string, ...args: any[]) => {
        const formatted = formatMessage(message, ...args);
        console.warn(message, ...args);
        logToFile('app.log', 'WARN', formatted);
    },

    error: (message: string, ...args: any[]) => {
        const formatted = formatMessage(message, ...args);
        console.error(message, ...args);
        logToFile('error.log', 'ERROR', formatted);
        logToFile('app.log', 'ERROR', formatted);
    },

    // Specific for HTTP requests (can be used with morgan if needed, but manual for now)
    http: (message: string) => {
        console.log(message);
        logToFile('access.log', 'HTTP', message);
    }
};
