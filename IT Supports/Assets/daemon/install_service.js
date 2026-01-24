var Service = require('node-windows').Service;
var path = require('path');

// We are in Assets/daemon
// Node is in / (Root) -> ../..
var nodePath = path.join(__dirname, '../..', 'node.exe');
var scriptPath = path.join(__dirname, 'run_app.js');

var svc = new Service({
    name: 'IT Support Portal',
    description: 'IT Support Portal Background Service',
    script: scriptPath,
    nodePath: nodePath,
    workingDirectory: path.join(__dirname, '../..') // Root
});

svc.on('install', function () {
    console.log('Service installed successfully.');
    svc.start();
});

svc.on('alreadyinstalled', function () {
    console.log('Service already installed.');
    svc.start();
});

svc.on('start', function () {
    console.log('Service started.');
});

svc.on('error', function (err) {
    console.error('Service error:', err);
});

svc.install();
