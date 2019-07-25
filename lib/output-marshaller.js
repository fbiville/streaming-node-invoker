const { Transform } = require('stream');
const logger = require('util').debuglog('riff');
const {canMarshall, determineContentTypes, marshaller} = require('./content-negotiation');

module.exports = class OutputMarshaller extends Transform {

    constructor(index, contentType, options) {
        super(options);
        this.index = index;
        this.acceptedContentType = determineContentTypes(contentType);
        if (!canMarshall(this.acceptedContentType)) {
            throw `unrecognized output #${index}'s content-type ${contentType}`;
        }
        this.marshallerFunction = marshaller(this.acceptedContentType);
    }

    _transform(value, _, callback) {
        const outputFrame = new proto.streaming.OutputFrame();
        outputFrame.setPayload(this.marshallerFunction(value));
        outputFrame.setContenttype(this.contentType);
        outputFrame.setResultindex(this.index);
        const outputSignal = new proto.streaming.OutputSignal();
        outputSignal.setData(outputFrame);

        logger(`Received output #${this.index} with value: ${value} and content-type: ${this.acceptedContentType}`);
        this.push(outputSignal);
        callback();
    }
};
