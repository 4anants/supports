const Service = require('node-windows').Service;
const path = require('path');
const fs = require('fs');

const logFile = path.join(__dirname, '..', 'service_install.log');
function log(msg) {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
}

log("Starting Service Installation for IT Supports...");

const scriptPath = path.join(__dirname, '..', 'release_runner.cjs');
if (!fs.existsSync(scriptPath)) {
    log("ERROR: release_runner.cjs not found at " + scriptPath);
    process.exit(1);
}

log(`Using Node executable: ${process.execPath}`);

const svc = new Service({
    name: 'IT Supports',
    description: 'IT Support Ticketing and Inventory System',
    script: scriptPath,
    nodePath: process.execPath,
    workingDirectory: path.join(__dirname, '..'),
    nodeOptions: [
        '--harmony',
        '--max_old_space_size=4096'
    ],
    env: [{
        name: "NODE_ENV",
        value: "production"
    }, {
        name: "PORT",
        value: "3001"
    }]
});

svc.on('install', function () {
    log('Service installed.');
    svc.start();
});

svc.on('alreadyinstalled', function () {
    log('Service already installed, starting...');
    svc.start();
});

svc.on('error', function (err) {
    log('Service Error: ' + (err || 'Unknown error'));
});

try {
    svc.install();
} catch (e) {
    log('Exception: ' + e.message);
}
