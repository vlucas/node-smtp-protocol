var smtp = require('../');
var tls = require('tls');
var fs = require('fs');
var test = require('tap').test;

var serverPort = 8000;

var keys = {
    key: fs.readFileSync(__dirname + '/keys/server-key.pem'),
    cert: fs.readFileSync(__dirname + '/keys/server-cert.pem'),
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

test('TLS - unauthorized', {timeout: 1000}, function(t) {
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
            t.equals(err.message, 'UNABLE_TO_VERIFY_LEAF_SIGNATURE');
            t.end();
        });
    });
});

test('TLS - unauthorized with callback', {timeout: 1000}, function(t) {
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
        
        c.on('secureConnect', function (s, ack) {
            t.ok(!s.authorized);
            ack.accept();
        });
    });
});

test('TLS - authorized', {timeout: 1000}, function(t) {
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
        
        c.on('secureConnect', function (s, ack) {
            t.ok(s.authorized, "should be authorized");
            if (s.authorized) ack.accept()
            else ack.reject()
        });
    });
});
