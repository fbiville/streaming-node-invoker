const {Transform} = require('stream');
const debug = require('debug')('node-invoker:input-unmarshaller');
const {canUnmarshall, determineContentTypes, unmarshaller} = require('./content-negotiation');

module.exports = class InputUnmarshaller extends Transform {

	constructor(index, options) {
		super(options);
		this.index = index;
	}

	_transform(inputSignal, _, callback) {
		const dataSignal = inputSignal.getData();
		const inputIndex = dataSignal.getArgindex();
		// see FIXME in riff-facade.js
		if (this.index != inputIndex) {
			callback();
			return;
		}
		const payload = dataSignal.getPayload();
		const contentType = dataSignal.getContenttype();
		const acceptedContentType = determineContentTypes(contentType);
		if (!canUnmarshall(acceptedContentType)) {
			throw `unrecognized input #${inputIndex}'s content-type ${contentType}`;
		}
		const input = unmarshaller(acceptedContentType)(payload);
		debug(`Forwarding data for input #${inputIndex} with payload: ${input}`);
		this.push(input);
		callback();
	}
}