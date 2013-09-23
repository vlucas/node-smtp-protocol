var parser = require('./parser');
var EventEmitter = require('events').EventEmitter;
var dot = require('../dot.js').dot;
var crypto = require('crypto');
var util = require('util');
var through = require('through');

module.exports = function (stream) {
    return new Client(stream);
};

function Client (stream) {
    EventEmitter.call(this);
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

util.inherits(Client, EventEmitter);

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
    this.stream.write(
        'STARTTLS'
        + '\r\n'
    );
    this.queue.push(cb);
};

Client.prototype.tlsconnectionupgrade = function (hostname, cb) { // hostname is required for cert check
    var tls = require('tls');
    var s = tls.connect({servername:hostname, socket:this.stream}, function(error, response){
        if(error){
            cb('Unable to upgrade connection',451);
            return true;
        }
        cb(null,220,s);
    });
};

Client.prototype.login = function (username, password, type, cb) {
    var self = this;
    var supportedTypes =  ['PLAIN','LOGIN','CRAM-MD5'];
    type = (type) ? type.toUpperCase() : 'PLAIN';
    if(supportedTypes.indexOf(type) < 0){
        cb('Unsupported login type', 451);
    }
    switch(type){
        case 'PLAIN':
            var buf = new Buffer(username + "\0" + username + "\0" + password);
            self.stream.write("AUTH PLAIN " + buf.toString("base64") + "\r\n");
            self.queue.push(cb);
            break;
        case "LOGIN":
		case "CRAM-MD5":
            self.authtype = type;
            self.username = username;
            self.password = password;
            self.stream.write("AUTH " + type + "\r\n");
            self.queue.push(function(err,code,lines){
                if(err){
                    cb(err,code,lines);
                    return true;
                }
                if(code != 334){
                    cb(type+' Auth Failed',code,lines);
                    return true;
                }
                switch (self.authtype) {
                    case "LOGIN":
                        var buf = new Buffer(self.username);
                        self.stream.write(buf.toString("base64") + "\r\n");
                        self.queue.push(function(erro,code,lines){
                            if(erro){
                                cb(erro,code,lines);
                                return true;
                            }
                            if(code != 334){
                                cb('LOGIN Auth Failed at username',code,lines);
                                return true;
                            }
                            var buf = new Buffer(self.password);
                            self.stream.write(buf.toString("base64") + "\r\n");
                            self.queue.push(cb);
                        });
                        break;
                    case "CRAM-MD5":
                        var hmac = crypto.createHmac('md5', self.password);
                        msg = (new Buffer(msg, "base64")).toString("ascii");
                        hmac.update(msg);
                        self.stream.write((new Buffer(self.username + " " + hmac.digest("hex")).toString("base64")) + "\r\n");
                        self.queue.push(cb);
                        break;
                }
            });
    }
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
    
    if (!source || typeof source === 'function') {
        cb = source;
        source = through();
    }
    dot(source).pipe(self.stream, { end : false });
    
    source.on('data', function () {});
    source.on('end', function () {
        self.stream.write('\r\n.\r\n');
    });
    
    this.queue.push(cb);
    return source;
};

Client.prototype.quit = function (cb) {
    this.stream.write('QUIT\r\n');
    this.queue.push(cb);
};

Client.prototype.reset = function (cb) {
    this.stream.write('RSET\r\n');
    this.queue.push(cb);
};
