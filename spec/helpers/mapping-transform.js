const {Transform} = require('stream');

module.exports = class MappingTransform extends Transform {

    constructor(mapFn, options) {
        super(options);
        this.mapFn = mapFn;
    }


    _transform(chunk, _, callback) {
        callback(null, chunk === null ? null : this.mapFn(chunk));
    }
};
