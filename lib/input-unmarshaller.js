const {Transform} = require('stream');
const debug = require('debug')('node-invoker:input-unmarshaller');

module.exports = class InputUnmarshaller extends Transform {

	constructor(index, options) {
		super(options);
		this.index = index;
	}

	_transform(inputSignal, _, callback) {
		const dataSignal = inputSignal.getData();
		const inputIndex = dataSignal.getArgindex();
		if (this.index != inputIndex) {
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