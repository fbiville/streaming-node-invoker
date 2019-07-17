const { Transform } = require('stream');
const debug = require('debug')('node-invoker:marshaller');

module.exports = class OutputMarshaller extends Transform {

	constructor(options) {
		super(options);
	}

  	_transform(rawIndexedOutput, _, callback) {
  		const outputIndex = rawIndexedOutput.index;
  		const outputValue = rawIndexedOutput.value;
		const outputContentType = rawIndexedOutput.contentType;
		debug(`Received output #${outputIndex} with value: ${outputValue} and content type: ${outputContentType}`);
		if (outputContentType == 'text/plain') {
			const encoder = new TextEncoder('utf8');
			const output = '' + outputValue;
			const outputFrame = new proto.streaming.OutputFrame();
			outputFrame.setPayload(encoder.encode(output));
			outputFrame.setContenttype(outputContentType);
			outputFrame.setResultindex(outputIndex);
			const outputSignal = new proto.streaming.OutputSignal();
			outputSignal.setData(outputFrame);

			this.push(outputSignal);
		} else {
			throw `unrecognized output content-type ${outputContentType}`;
		}
		callback();
	}
};