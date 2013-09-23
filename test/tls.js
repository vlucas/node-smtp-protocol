var smtp = require('../');
var tls = require('tls');
var fs = require('fs');
var test = require('tap').test;

var serverPort = 8000;

var keys = {
    key: fs.readFileSync(__dirname + '/keys/key.pem'),
    cert: fs.readFileSync(__dirname + '/keys/cert.pem'),
    ca: fs.readFileSync(__dirname + '/keys/ca.pem')
};

function makeServer () {
    var server = tls.createServer({key: keys.key, cert: keys.cert});
    server.on('secureConnection', function (s) {
        s.write("220 localhost ESMTP\r\n");
        s.on('data', function(data) {
            s.end("421 Service unavailable\r\n");
        });
    });
    return server;
}

return console.log('1..0\nSKIPPED');

test('TLS - unauthorized', function (t) {
    t.plan(2);
    var options = { tls: true };
    var server = makeServer();
    
    server.listen(serverPort, function() {
        var c = smtp.connect(serverPort, options, function (session) {
            t.fail('connect should have failed');
        });
        
        c.on('error', function (err) {;
            server.close();
            t.ok(err, 'connect should fail');
            t.equals(err.message, 'DEPTH_ZERO_SELF_SIGNED_CERT');
            t.end();
        });
    });
});

test('TLS - unauthorized with callback', function (t) {
    t.plan(3);
    
    var server = makeServer();
    server.listen(serverPort, function() {
        var c = smtp.connect(serverPort, { tls : true }, function (session) {
            server.close();
            session.on('greeting', function (code, messages) {
                t.equal(code, 220);
                t.equal(messages[0], "localhost ESMTP");
                t.end();
                session.quit();
            })
        });
        
        c.on('secure', function (ack) {
            t.ok(!c.authorized);
            ack.accept();
        });
    });
});

test('TLS - authorized', function (t) {
    t.plan(3);
    
    var server = makeServer();
    var options = { tls: { ca: [ keys.ca ] } };
    
    server.listen(serverPort, function() {
        var c = smtp.connect(serverPort, options, function (session) {
            server.close();
            
            session.on('greeting', function(code, messages) {
                t.equal(code, 220);
                t.equal(messages[0], "localhost ESMTP");
                t.end();
                session.quit();
            })
        });
        
        c.on('secure', function (ack) {
            t.ok(c.authorized, "should be authorized");
            if (c.authorized) ack.accept()
            else ack.reject()
        });
    });
});
