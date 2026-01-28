const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables from backend/.env
const envPath = path.join(__dirname, 'backend', '.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

// Ensure logs directory exists
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
    try {
        fs.mkdirSync(logDir, { recursive: true });
    } catch (e) { }
}

const outLogPath = path.join(logDir, 'app-out.log');
const errLogPath = path.join(logDir, 'app-err.log');
const outLog = fs.openSync(outLogPath, 'a');
const errLog = fs.openSync(errLogPath, 'a');

function log(msg) {
    const ts = new Date().toISOString();
    const line = `[${ts}] ${msg}\n`;
    console.log(msg);
    try {
        fs.appendFileSync(outLogPath, line);
    } catch (e) { }
}

log('Starting IT Supports Production Server Runner...');

// Ensure database is migrated
function runMigrations() {
    return new Promise((resolve) => {
        log('Checking database migrations...');
        const prismaPath = path.join(__dirname, 'node_modules', 'prisma', 'build', 'index.js');
        const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
        const nodePath = process.execPath;

        const migrator = spawn(nodePath, [prismaPath, 'migrate', 'deploy', '--schema=' + schemaPath], {
            cwd: __dirname,
            env: {
                ...process.env,
                NODE_ENV: 'production',
                DATABASE_URL: `file:${path.join(__dirname, 'dev.db')}`
            },
            windowsHide: true,
            shell: false
        });

        migrator.stdout.on('data', (data) => log(`[Prisma] ${data.toString().trim()}`));
        migrator.stderr.on('data', (data) => log(`[Prisma Error] ${data.toString().trim()}`));

        migrator.on('close', (code) => {
            if (code === 0) {
                log('Migrations completed or already up to date.');
            } else {
                log(`Migration failed with code ${code}. Attempting to start server anyway...`);
            }
            resolve();
        });
    });
}

async function startServer() {
    await runMigrations();
    // Port 3001 is our production port
    const serverPath = path.join(__dirname, 'backend', 'dist', 'server.js');
    const nodePath = process.execPath;
    const dbPath = path.join(__dirname, 'dev.db');

    log(`Executing: "${nodePath}" "${serverPath}"`);
    log(`Database: "${dbPath}"`);

    const proc = spawn(nodePath, [serverPath], {
        cwd: __dirname,
        env: {
            ...process.env,
            NODE_ENV: 'production',
            PORT: '3001',
            DATABASE_URL: `file:${dbPath}`
        },
        stdio: ['ignore', outLog, errLog],
        windowsHide: true,
        shell: false
    });

    proc.on('error', (err) => {
        log(`Failed to start process: ${err.message}`);
    });

    proc.on('close', (code) => {
        const msg = `Server exited with code ${code}. Restarting in 5s...`;
        log(msg);
        setTimeout(startServer, 5000);
    });
}

startServer();

// Keep runner alive
setInterval(() => { }, 1000 * 60 * 60);
