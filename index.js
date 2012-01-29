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

exports.connect = function (port, host, options, cb) {
    var args = [].slice.call(arguments).reduce(function (acc, arg) {
        acc[typeof arg] = arg;
        return acc;
    }, {});

    var stream;
    var tlsOpts;

    cb = args["function"];
    args.options = args.object || {};
    
    if (args.string && args.string.match(/^[.\/]/)) {
        // unix socket
        stream = net.createConnection(args.string);
    }
    else {
        port = args.number || 25;
        host = args.string || 'localhost';
        tlsOpts = args.options.tls;

        if (tlsOpts) {

            // TODO: is this the right thing to do?
            var wrapError = function(error) {
               return error instanceof Error ? error : new Error(error);
            };

            var onSecureConnect = tlsOpts.onSecureConnect;
            delete tlsOpts.onSecureConnect;

            stream = tls.connect(
                port,
                host,
                tlsOpts,
                function() {

                    var ok;
                    var result;

                    if (onSecureConnect) ok = onSecureConnect(stream);
                    else ok = stream.authorized;

                    if (!ok) {
                        stream.end();
                        result = wrapError(stream.authorizationError);
                    }
                    else result = proto.server(stream);

                    cb(result);
                }
            );

        }
        else if (args.options.stream) {
            cb(proto.server(args.options.stream));
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
