var net = require('net');
var tls = require('tls');

var proto = exports.protocol = {
    client : require('./lib/client/proto'),
    server : require('./lib/server/proto'),
};

exports.createServer = function (domain, cb) {
    if (typeof domain === 'function') {
        cb = domain;
        domain = undefined;
    }
    
    return net.createServer(function (stream) {
        cb(proto.client(domain, stream));
    });
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
            if(pending === 0){
                if(!stream.authorized && tlsOpts.rejectUnauthorized !== false) allOk = false;
            }
            if (pending === 0) done()
            else {
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
            }
            
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
        stream = net.createConnection(port, host);
        stream.on('connect', function () {
            cb(proto.server(stream));
        });
    }
    
    return stream;
};
