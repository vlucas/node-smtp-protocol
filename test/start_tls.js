var smtp = require('../');
var tls = require('tls');
var net = require('net');
var fs = require('fs');
var test = require('tap').test;
var concat = require('concat-stream');
var split = require('split');

var keys = {
    key: fs.readFileSync(__dirname + '/keys/key.pem'),
    cert: fs.readFileSync(__dirname + '/keys/cert.pem'),
    ca: fs.readFileSync(__dirname + '/keys/ca.pem')
};

test('server upgrade to TLS', function (t) {
    t.plan(5);
    
    var opts = {
        domain: 'beep',
        key: keys.key,
        cert: keys.cert,
        ca: keys.key
    };
    var server = smtp.createServer(opts, function (req) {
        req.on('tls', function () {
            console.log('UPGRADED!');
            t.ok(true);
        });
        
        req.on('to', function (to, ack) {
            t.equal(to, 'beep@boop');
            ack.accept();
        });
        
        req.on('message', function (stream, ack) {
            stream.pipe(concat(function (body) {
                t.equal(body, 'oh hello');
            }));
            ack.accept();
        });
        
        return server;
    });
    server.listen(0, function () {
        var stream = net.connect(server.address().port);
        
        var steps = [
            function () {
                stream.write('ehlo beep\n');
            },
            function () {
                stream.write('starttls\n');
            },
            function () {
                var tstream = tls.connect({
                    servername: 'beep',
                    socket: stream
                });
                
                tstream.on('secureConnection', function (sec) {
                    t.ok(true, 'secure connection established');
                    sec.write('quit\n');
                });
            }
        ];
        
        var ix = -1;
        stream.pipe(split()).on('data', function ondata (line) {
console.log('line=', line);
            if (/^\d{3}(\s|$)/.test(line)) {
                var f = steps[++ix];
                if (f) f()
                else this.removeListener('data', ondata)
            }
        });
    });
});
