const {Transform} = require('stream');
const RawIndexedOutput = require('./raw-indexed-output');
const debug = require('debug')('node-invoker:input-forwarder');

module.exports = class InputForwarder extends Transform {

	constructor(index, options) {
		super(options);
		this.index = index;
	}

	_transform(inputSignal, _, callback) {
		const dataSignal = inputSignal.getData();
		const inputIndex = dataSignal.getArgindex();
		if (inputIndex != this.index) {
			callback();
			return;
		}
		const payload = dataSignal.getPayload();
		const contentType = dataSignal.getContenttype();
		debug(`Data signal for input #${inputIndex} received: ${payload}`);
		if (contentType == 'text/plain') {
			const decoder = new TextDecoder('utf8');
			const input = decoder.decode(payload);
			this.push(input);
		} else {
			throw `unrecognized input #${inputIndex}'s content-type ${contentType}`;
		}
		callback();
	}
}