const {Transform} = require('stream');
const RawIndexedOutput = require('./raw-indexed-output');
const debug = require('debug')('node-invoker:output-forwarder');

module.exports = class OutputForwarder extends Transform {

	constructor(index, contentType, options) {
		super(options);
		this.index = index;
		this.contentType = contentType;
	}

	_transform(value, _, callback) {
		debug(`Forwarding value ${value} for output #${this.index}`);
		this.push(new RawIndexedOutput(this.index, this.contentType, value));
		callback();
	}
}