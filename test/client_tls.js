var smtp = require('../');
var test = require('tap').test;
var tls = require('tls');
var split = require('split');
var net = require('net');
var fs = require('fs');
var concat = require('concat-stream');

var keys = {
    key: fs.readFileSync(__dirname + '/keys/key.pem'),
    cert: fs.readFileSync(__dirname + '/keys/cert.pem'),
    ca: fs.readFileSync(__dirname + '/keys/ca.pem')
};

test('client TLS upgrade', function (t) {
    var server = net.createServer(function (stream) {
        stream.write('220 beep\n');
        
        stream.pipe(split()).on('data', function ondata (line) {
            if (/^EHLO\b/i.test(line)) {
                stream.write('250-beep\n');
                stream.write('250 STARTTLS\n');
            }
            
            if (line !== 'STARTTLS') return;
            this.removeListener('data', ondata);
            stream.write('220 Ready to start TLS.\n');
            
            var opts = {
                key: keys.key,
                cert: keys.cert
            };
            var tserver = tls.createServer(opts, function (s) {
                stream.pipe(s).pipe(stream);
                
            });
            tserver.listen(0, function () {
                var s = net.connect(tserver.address().port);
                s.pipe(stream).pipe(s);
                
                s.pipe(concat(function (body) {
                    console.log(body.toString('utf8'));
                }));
            });
            
            t.on('end', function () {
                tserver.close();
            });
        });
    });
    
    server.listen(0, function () {
        smtp.connect(server.address().port, function (r) {
            r.ehlo('localhost');
            
            r.on('greeting', function (code, host) {
                t.equal(code, 220);
                r.startTLS({ ca: keys.ca });
            });
            
            r.on('tls', function () {
                r.from('alice@beep');
                r.to('bob@beep');
                r.data(function (mail) {
                    mail.end('beep boop!\n');
                });
                r.quit();
            });
        });
    });
});
