const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
    name: 'IT Supports',
    script: path.join(__dirname, '..', 'release_runner.cjs')
});

svc.on('uninstall', function () {
    console.log('Uninstall complete.');
    console.log('The service exists: ', svc.exists);
});

svc.uninstall();
