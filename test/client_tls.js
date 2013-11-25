var smtp = require('../');
var test = require('tap').test;
var tls = require('tls');
var split = require('split');
var net = require('net');
var fs = require('fs');

var keys = {
    key: fs.readFileSync(__dirname + '/keys/key.pem'),
    cert: fs.readFileSync(__dirname + '/keys/cert.pem'),
    ca: fs.readFileSync(__dirname + '/keys/ca.pem')
};

test('client TLS upgrade', function (t) {
    var server = net.createServer(function (stream) {
        stream.write('220 beep\n');
        
        stream.pipe(split()).on('data', function ondata (line) {
            if (line === 'EHLO beep') {
                stream.write('250-beep\n');
                stream.write('250 STARTTLS\n');
            }
            
            if (line !== 'STARTTLS') return;
            stream.removeListener('data', ondata);
            stream.write('220 Ready to start TLS.\n');
            
            var tserver = tls.createServer(function (s) {
                stream.pipe(s).pipe(stream);
            });
            tserver.listen(0, function () {
                var s = net.connect(tserver.address().port);
                s.pipe(stream).pipe(s);
            });
            
            t.on('end', function () {
                tserver.close();
            });
        });
    });
    
    server.listen(0, function () {
        smtp.connect(server.address().port, function (r) {
            r.ehlo();
            
            r.on('greeting', function (code, host) {
                t.equal(code, 220);
                r.startTLS();
            });
            
            r.on('tls', function () {
                console.log('TLS!');
            });
        });
    });
});
