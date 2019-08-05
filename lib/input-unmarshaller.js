const {Transform} = require('stream');
const RiffError = require('./riff-error');
const logger = require('util').debuglog('riff');
const {canUnmarshall, determineContentTypes, unmarshaller} = require('./content-negotiation');

module.exports = class InputUnmarshaller extends Transform {

    constructor(options) {
        super(options);
    }

    _transform(inputSignal, _, callback) {
        const dataSignal = inputSignal.getData();
        const inputIndex = dataSignal.getArgindex();
        const payload = dataSignal.getPayload();
        const contentType = dataSignal.getContenttype();
        const acceptedContentType = determineContentTypes(contentType).accept;
        if (!canUnmarshall(acceptedContentType)) {
            callback(new RiffError('error-input-content-type-unsupported', `unsupported input #${inputIndex}'s content-type ${contentType}`));
            return;
        }
        try {
            const input = unmarshaller(acceptedContentType)(payload);
            logger(`Forwarding data for input #${inputIndex} with payload: ${input}`);
            callback(null, input);
        } catch (err) {
            if (err instanceof RiffError) {
                // some errors are sent back to the the marshaller from "transitively"-piped output streams
                this.emit('error', err);
            } else {
                this.emit('error', new RiffError('error-input-invalid', err));
            }
        }
    }
};
