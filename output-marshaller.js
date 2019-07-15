const { Transform } = require('stream');
const debug = require('debug')('node-invoker:marshaller');

module.exports = class OutputMarshaller extends Transform {

	// FIXME: inputUnmarshaller is only needed for the output content types
	constructor(inputUnmarshaller, options) {
		super(options);
		this.inputUnmarshaller = inputUnmarshaller;
	}

  	_transform(rawOutput, _, callback) {
		const outputContentType = this.inputUnmarshaller.outputContentTypes[0];
		if (outputContentType == 'text/plain') {
			const encoder = new TextEncoder('utf8');
			const output = '' + rawOutput;
			debug('Sending output frame with: ' + output);
			const outputFrame = new proto.streaming.OutputFrame();
			outputFrame.setPayload(encoder.encode(output));
			outputFrame.setContenttype(outputContentType);
			const outputSignal = new proto.streaming.OutputSignal();
			outputSignal.setData(outputFrame);

			this.push(outputSignal);
		} else {
			throw `unrecognized output content-type ${contentType}`;
		}
		callback();
	}
};