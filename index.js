var net = require('net');
var tls = require('tls');

var proto = exports.protocol = {
    client : require('./lib/client/proto'),
    server : require('./lib/server/proto'),
};

exports.createServer = function (opts, cb) {
    if (typeof opts === 'string') {
        opts = { domain: opts };
    }
    if (typeof opts === 'function') {
        cb = opts;
        opts = {};;
    }
    var tserver = false;
    if (opts.key || opts.pfx) {
        tserver = tls.createServer(opts);
        tserver.on('secureConnection', function (sec) {
            var req = false;
console.log('SCONN', sec);
            //onstream(sec, req);
        });
    }
    
    var server = net.createServer(onstream);
    var requests = {};
    var seqNum = 0;
    
    function onstream (stream, existingReq) {
        var req = existingReq || proto.client(opts, stream);
        
        req.on('_tlsNext', function (write) {
            if (existingReq) {
                return write(503, 'Bad sequence: already using TLS.');
            }
            var s = net.connect(tserver.address().port, '127.0.0.1');
            s.on('open', function () {
console.log(s);
console.log('--------------------------------------');
            });
            s.on('error', function (err) {});
            
            stream.pipe(s).pipe(stream);
            write(220, 'Ready to start TLS.');
            req.emit('tls');
        });
        if (!existingReq) cb(req);
    }
    if (tserver) {
        server.on('listening', function () {
            tserver.listen(0, '127.0.0.1');
        });
        server.on('close', function () {
            tserver.close();
        });
    }
    return server;
};

exports.connect = function () {
    var args = [].slice.call(arguments).reduce(function (acc, arg) {
        acc[typeof arg] = arg;
        return acc;
    }, {});

    var stream;
    var cb = args.function;
    var options = args.object || {};
    
    var port = args.number || 25;
    var host = args.string || 'localhost';
    var tlsOpts = options.tls;
    
    if (args.string && args.string.match(/^[.\/]/)) {
        // unix socket
        stream = net.createConnection(args.string);
    }
    else if (tlsOpts) {
        stream = tls.connect(port, host, tlsOpts, function () {
            var pending = stream.listeners('secure').length;
            var allOk = true;
            if (pending === 0 && !stream.authorized
            && tlsOpts.rejectUnauthorized !== false) {
                allOk = false;
            }
            if (pending === 0) return done()
            
            var ack = {
                accept : function (ok) {
                    allOk = allOk && (ok !== false);
                    if (--pending === 0) done();
                },
                reject : function () {
                    allOk = false;
                    if (--pending === 0) done();
                }
            };
            stream.emit('secure', ack);
            
            function done () {
                if (!allOk) {
                    stream.end();
                    stream.emit('error', new Error(stream.authorizationError));
                }
                else cb(proto.server(stream));
            }
        });
    }
    else if (options.stream) {
        cb(proto.server(options.stream));
    }
    else {
        stream = net.connect(port, host);
        stream.on('connect', function () {
            cb(proto.server(stream));
        });
    }
    
    return stream;
};
