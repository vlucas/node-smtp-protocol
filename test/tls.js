var smtp = require('../');
var tls = require('tls');
var fs = require('fs');
var test = require('tap').test;

var serverPort = 8000;

var keys = {
    key: fs.readFileSync('./keys/server-key.pem'),
    cert: fs.readFileSync('./keys/server-cert.pem'),
    ca: fs.readFileSync('./keys/ca.pem')
};

server = tls.createServer({key: keys.key, cert: keys.cert});

server.on('secureConnection', function(s) {
    s.write("220 localhost ESMTP\r\n");
    s.on('data', function(data) {
        s.end("421 Service unavailable\r\n");
    });
});

test('TLS - unauthorized', {timeout: 1000}, function(t) {

    t.plan(2);

    var options = {
        tls: true
    };

    server.listen(serverPort, function() {
        smtp.connect(serverPort, options, function(err) {
            server.close();
            t.ok(err instanceof Error, "connect should fail");
            t.equals(err.message, "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "connect should fail");
            t.end();
        });
    });
});

test('TLS - unauthorized with callback', {timeout: 1000}, function(t) {

    t.plan(4);

    var options = {
        tls: {
            onSecureConnect: function(s) {
                t.ok(!s.authorized);
                return true;
            }
        }
    };

    server.listen(serverPort, function() {
        smtp.connect(serverPort, options, function(session) {
            server.close();
            t.error(session instanceof Error, "connect should succeed");
            session.on('greeting', function(code, messages) {
                t.equal(code, 220);
                t.equal(messages[0], "localhost ESMTP");
                t.end();
                session.quit();
            })
        });
    });
});

test('TLS - authorized', {timeout: 1000}, function(t) {

    t.plan(4);

    var options = {
        tls: {
            ca: [ keys.ca ],
            onSecureConnect: function(s) {
                t.ok(s.authorized, "should be authorized");
                return s.authorized;
            }
        }
    };

    server.listen(serverPort, function() {

        smtp.connect(serverPort, options, function(session) {
            server.close();
            t.error(session instanceof Error, "connect should succeed");
            session.on('greeting', function(code, messages) {
                t.equal(code, 220);
                t.equal(messages[0], "localhost ESMTP");
                t.end();
                session.quit();
            })
        });
    });
});
