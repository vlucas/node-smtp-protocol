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
    
    if (args.string && args.string.match(/^[.\/]/)) {
        // unix socket
        stream = net.createConnection(args.string);
    }
    else {
        port = args.number || 25;
        host = args.string || 'localhost';
        var tlsOpts = options.tls;
        
        if (tlsOpts) {
            var onSecureConnect = tlsOpts.onSecureConnect;
            delete tlsOpts.onSecureConnect;
            
            stream = tls.connect(port, host, tlsOpts, function () {
                var ok = onSecureConnect
                    ? onSecureConnect(stream)
                    : stream.authorized
                ;
                
                if (!ok) {
                    stream.end();
                    stream.emit('error', new Error(stream.authorizationError));
                }
                else cb(proto.server(stream));
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
    }
    
    return stream;
};
