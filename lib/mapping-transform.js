const {Transform} = require('stream');
const RiffError = require('./riff-error');

module.exports = class MappingTransform extends Transform {

    constructor(mapFn, options) {
        super(options);
        this.mapFn = mapFn;
    }

    _transform(chunk, _, callback) {
        try {
            callback(null, chunk === null ? null : this.mapFn(chunk));
        } catch (err) {
            this.emit('error', new RiffError('request-reply-function-runtime-error', err));
        }
    }
};
