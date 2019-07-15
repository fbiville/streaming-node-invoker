const { Transform } = require('stream');
const debug = require('debug')('node-invoker:unmarshaller');

module.exports = class InputUnmarshaller extends Transform {

	constructor(options) {
		super(options);
		this.expectedOutputContentTypes = null;
	}

	get outputContentTypes() {
		return this.expectedOutputContentTypes;
	}

  	_transform(inputSignal, _, callback) {
		if (inputSignal.hasStart()) {
			const startSignal = inputSignal.getStart();
			this.expectedOutputContentTypes = startSignal.getExpectedcontenttypesList();
			debug('Start signal received: ' + this.expectedOutputContentTypes);
		} else if (inputSignal.hasData()) {
			const dataSignal = inputSignal.getData();
			const payload = dataSignal.getPayload();
			debug('Data signal received: ' + payload);
			const contentType = dataSignal.getContenttype();
			if (contentType == 'text/plain') {
				const decoder = new TextDecoder('utf8');
				const input = decoder.decode(payload);
				this.push(input)
			} else {
				throw `unrecognized input content-type ${contentType}`;
			}
		} else {
			throw `unrecognized signal ${inputSignal}`;
		}
		callback();
	}
};