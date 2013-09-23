var parser = require('./parser');
var writer = require('../server/write');
var through = require('through');
var os = require('os');
var EventEmitter = require('events').EventEmitter;
var undot = require('../dot').undot;

module.exports = function (hostname, stream) {
    if (stream === undefined) {
        stream = hostname;
        hostname = undefined;
    }
    
    var p = parser(stream);
    var write = writer(stream);
    write(220, hostname || os.hostname());
    
    function createAck (cb, okCode, raw) {
        return {
            accept : function (code, msg) {
                write(code, msg, okCode || 250);
                if (cb) cb();
                if (!raw) next();
            },
            reject : function (code, msg) {
                write(code, msg, 500);
                next();
            }
        };
    }
    
    function emit (name) {
        var fn = arguments[arguments.length - 1];
        var ack = arguments[arguments.length - 1] = createAck(fn);
        if (req.listeners(name).length === 0) ack.accept();
        req.emit.apply(req, arguments);
    }
    
    var req = new EventEmitter;
    
    stream.on('error', req.emit.bind(req, 'error'));
    
    var next = (function next () {
        p.getCommand(function (err, cmd) {
            if (err) {
                if (err.code) write(err.code, err.message || err.toString())
                else write(501, err.message || err.toString())
                next();
            }
            else if (cmd.name === 'quit') {
                write(221, 'Bye!');
                req.emit('quit');
                stream.end();
            }
            else if (cmd.name === 'rset') {
                write(250);
                req.to = undefined;
                req.from = undefined;
                req.emit('rset');
                next();
            }
            else if (!req.greeting) {
                if (cmd.name === 'greeting') {
                    emit('greeting', cmd, function () {
                        req.greeting = cmd.greeting;
                        req.hostname = cmd.hostname;
                    });
                }
                else {
                    write(503, 'Bad sequence: HELO, EHLO, or LHLO expected.');
                    next();
                }
            }
            else if (cmd.name === 'mail') {
                emit('from', cmd.from, function () {
                    req.fromExt = cmd.ext;
                    req.from = cmd.from;
                });
            }
            else if (cmd.name === 'rcpt') {
                emit('to', cmd.to, function () {
                    req.toExt = cmd.ext;
                    req.to = cmd.to;
                });
            }
            else if (cmd.name === 'data') {
                if (!req.from) {
                    write(503, 'Bad sequence: MAIL expected');
                    next();
                }
                else if (!req.to) {
                    write(503, 'Bad sequence: RCPT expected');
                    next();
                }
                else {
                    var target = makeTarget(write, next, emit);
                    var messageAck = createAck(function () {
                        p.getUntil('.', undot(target));
                    }, 354, true);
                    req.emit('message', target, messageAck);
                }
            }
            else {
                write(502, 'Not implemented.');
                next();
            }
        });
        
        return next;
    })();
    
    return req;
};

function makeTarget (write, next, emit) {
    var target = through(write, end);
    target.aborted = false;
    
    target.abort = function (code, msg) {
        if (!msg && typeof code !== 'number') {
            msg = code;
            code = undefined;
        }
        if (code === undefined) code = 554
        
        target.readable = false;
        target.emit('abort', code, msg);
    };
    
    return target;
    
    function write (buf) {
        if (!this.aborted) this.queue(buf);
    }
    
    function end () {
        this.queue(null);
        
        if (this.aborted) {
            write(target.aborted.code, target.aborted.message);
            next();
        }
        else emit('received', function () {});
    }
}
