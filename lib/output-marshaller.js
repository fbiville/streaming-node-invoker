const { Transform } = require('stream');
const logger = require('util').debuglog('riff');
const RiffError = require('./riff-error');
const {canMarshall, determineContentTypes, marshaller} = require('./content-negotiation');

module.exports = class OutputMarshaller extends Transform {

    constructor(index, contentType, options) {
        super(options);
        if (index < 0) {
            throw new RiffError('error-streaming-output-index-invalid', `invalid output index: ${index}`);
        }
        const acceptedContentType = determineContentTypes(contentType).accept;
        if (!canMarshall(acceptedContentType)) {
            throw new RiffError('error-streaming-output-content-type-unsupported', `unrecognized output #${index}'s content-type ${contentType}`);
        }
        this.index = index;
        this.acceptedContentType = acceptedContentType;
        this.marshallerFunction = marshaller(this.acceptedContentType);
    }

    _transform(value, _, callback) {
        const outputFrame = new proto.streaming.OutputFrame();
        outputFrame.setResultindex(this.index);
        outputFrame.setContenttype(this.acceptedContentType);
        outputFrame.setPayload(this.marshallerFunction(value));
        const outputSignal = new proto.streaming.OutputSignal();
        outputSignal.setData(outputFrame);

        logger(`Received output #${this.index} with value: ${value} and content-type: ${this.acceptedContentType}`);
        this.push(outputSignal);
        callback();
    }
};

