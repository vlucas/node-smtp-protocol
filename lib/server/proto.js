var parser = require('./parser');
var EventEmitter = require('events').EventEmitter;
var dot = require('../dot.js').dot;

module.exports = function (stream) {
    return new Client(stream);
};

function Client (stream) {
    var self = this;
    self.stream = stream;
    self.queue = [
        function (err, code, lines) {
            if (err) self.emit('error', err)
            else self.emit('greeting', code, lines)
        }
    ];
    
    var p = parser(stream, function (err, code, lines) {
        if (self.queue.length) {
            var cb = self.queue.shift();
            if (cb) cb(err, code, lines);
        }
    });
    
    return self;
}

Client.prototype = new EventEmitter;

Client.prototype.helo = function (hostname, cb) {
    if (typeof hostname === 'function') {
        cb = hostname;
        hostname = undefined;
    }
    this.stream.write(
        'HELO'
        + (hostname !== undefined ? ' ' + hostname : '')
        + '\r\n'
    );
    this.queue.push(cb);
};

Client.prototype.ehlo = function (hostname, cb) {
    if (typeof hostname === 'function') {
        cb = hostname;
        hostname = undefined;
    }
    this.stream.write(
        'EHLO'
        + (hostname !== undefined ? ' ' + hostname : '')
        + '\r\n'
    );
    this.queue.push(cb);
};

Client.prototype.starttls = function (cb) {
    if (typeof hostname === 'function') {
        cb = hostname;
        hostname = undefined;
    }
    this.stream.write(
        'STARTTLS'
        + '\r\n'
    );
    this.queue.push(function(err,code,lines){
        // Upgrade connection to TLS
        if(err){
            cb(err, code, lines);
            return true;
        }
        if(code == 220){
            var clear = require('./starttls').starttls(Client.stream, false, function() {
                if (!clear.authorized)
                    cb(new Error('STARTTLS: failed to secure stream'));
                else {
                    cb(false, 220,'STARTTLS success', clear);
                }
            });
        }else{
            cb('Unable to STARTTLS', code, lines);
        }
    });
};

Client.prototype.to = function (addr, ext, cb) {
    if (typeof ext === 'function') {
        cb = ext;
        ext = undefined;
    }
    this.stream.write(
        'RCPT TO: <' + addr + '>'
        + (ext ? ' ' + ext : '')
        + '\r\n'
    );
    this.queue.push(cb);
};

Client.prototype.from = function (addr, ext, cb) {
    if (typeof ext === 'function') {
        cb = ext;
        ext = undefined;
    }
    this.stream.write(
        'MAIL FROM: <' + addr + '>'
        + (ext ? ' ' + ext : '')
        + '\r\n'
    );
    this.queue.push(cb);
};

Client.prototype.data = function (cb) {
    this.stream.write('DATA\r\n');
    this.queue.push(cb);
};

Client.prototype.message = function (source, cb) {
    var self = this;
    
    var newline = true;
    
    dot(source).pipe(self.stream, { end : false });
    
    source.on('end', function () {
        self.stream.write('\r\n.\r\n');
    });
    
    this.queue.push(cb);
};

Client.prototype.quit = function (cb) {
    this.stream.write('QUIT\r\n');
    this.queue.push(cb);
};

Client.prototype.reset = function (cb) {
    this.stream.write('RSET\r\n');
    this.queue.push(cb);
};
