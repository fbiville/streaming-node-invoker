const {Transform} = require('stream');
const RiffError = require('./riff-error');

module.exports = class MappingTransform extends Transform {

    constructor(fn, options) {
        super(options);
        this._function = fn;
    }

    _transform(chunk, _, callback) {
        try {
            callback(null, chunk === null ? null : this._function(chunk));
        } catch (err) {
            this.emit('error', new RiffError('request-reply-function-runtime-error', err));
        }
    }
};
