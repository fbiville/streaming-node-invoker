const { Transform } = require('stream');
const debug = require('debug')('node-invoker:marshaller');

module.exports = class OutputMarshaller extends Transform {

	constructor(index, contentType, options) {
		super(options);
		this.index = index;
		this.contentType = contentType;
	}

  	_transform(value, _, callback) {
		debug(`Received output #${this.index} with value: ${value} and content type: ${this.contentType}`);
		if (this.contentType == 'text/plain') {
			const encoder = new TextEncoder('utf8');
			const output = '' + value;
			const outputFrame = new proto.streaming.OutputFrame();
			outputFrame.setPayload(encoder.encode(output));
			outputFrame.setContenttype(this.contentType);
			outputFrame.setResultindex(this.index);
			const outputSignal = new proto.streaming.OutputSignal();
			outputSignal.setData(outputFrame);

			this.push(outputSignal);
		} else {
			throw `unrecognized output content-type ${outputContentType}`;
		}
		callback();
	}
};