var Service = require('node-windows').Service;
var path = require('path');

var svc = new Service({
    name: 'IT Support Portal',
    script: path.join(__dirname, 'run_app.js')
});

svc.on('uninstall', function () {
    console.log('Uninstall complete.');
});

svc.uninstall();
