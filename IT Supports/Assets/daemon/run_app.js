const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// We are in Assets/daemon
// Root is two levels up
const rootDir = path.join(__dirname, '../..');

// Ensure directories exist in Assets
const assetsDir = path.join(rootDir, 'Assets');
const logDir = path.join(assetsDir, 'logs'); // Logs should probably be in Assets too? 
// User didn't explicitly say logs, but logic suggests organizing data there.
// However user list was: (backups,database,logos,uploads,daemon). 
// User didn't mention logs. I'll check if logs exists in root.
// If I move logs without asking, might be issue. I'll leave logs in ROOT or ask?
// Wait, the user said "move all under new folder name Assets. (backups,database,logos,uploads,daemon)".
// Logs was NOT in the list. I will assume logs stays in root OR I should have moved it.
// Given strict instructions, I will generate logs in Root/logs or Root/Assets/logs?
// Let's stick to Root/logs as it wasn't requested to move, BUT run_app usually creates it.
// Actually, to keep it clean, let's put logs in Assets/logs if possible, but safely I will keep it in root 
// unless I see it was moved.
// Checking previous directory list, 'logs' was in root.
// I'll keep logs in root to follow instructions exactly.

// Ensure directories (in Assets where appropriate, or Root)
const uploadDirInAssets = path.join(assetsDir, 'uploads');
const backupDirInAssets = path.join(assetsDir, 'backups');
// Logs in root
const rootLogDir = path.join(rootDir, 'logs');

[rootLogDir, uploadDirInAssets, backupDirInAssets].forEach(dir => {
    if (!fs.existsSync(dir)) {
        try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { }
    }
});

const outLogPath = path.join(rootLogDir, 'app-out.log');
const errLogPath = path.join(rootLogDir, 'app-err.log');
const outLog = fs.openSync(outLogPath, 'a');
const errLog = fs.openSync(errLogPath, 'a');

function log(msg) {
    const ts = new Date().toISOString();
    const line = `[${ts}] ${msg}\n`;
    process.stdout.write(line);
    try { fs.appendFileSync(outLogPath, line); } catch (e) { }
}

log('--- IT Support Portal Runner Starting ---');

function startServer() {
    const nodeExe = path.join(rootDir, 'node.exe');
    const serverJs = path.join(rootDir, 'backend', 'server.js');

    // DB Path in backend/prisma
    const dbPath = path.join(rootDir, 'backend', 'prisma', 'dev.db').replace(/\\/g, '/');
    const dbUrl = `file:${dbPath}`;

    log(`Detected Database Path: ${dbPath}`);
    log(`Spawning: "${nodeExe}" "${serverJs}"`);

    const proc = spawn(`"${nodeExe}"`, [`"${serverJs}"`], {
        cwd: rootDir,
        env: {
            ...process.env,
            NODE_ENV: 'production',
            PORT: '3003',
            DATABASE_URL: dbUrl
        },
        stdio: ['ignore', outLog, errLog],
        windowsHide: true,
        shell: true
    });

    proc.on('error', (err) => {
        log(`Failed to start server process: ${err.message}`);
    });

    proc.on('close', (code) => {
        log(`Server process exited with code ${code}. Restarting in 5s...`);
        setTimeout(startServer, 5000);
    });
}

startServer();

setInterval(() => { }, 60000);
