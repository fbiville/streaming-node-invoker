const {pipeline, Writable} = require('stream');
const RiffError = require('./riff-error');
const OutputMarshaller = require('./output-marshaller');
const MappingTransform = require('./mapping-transform');
const logger = require('util').debuglog('riff');
const InputUnmarshaller = require('./input-unmarshaller');

module.exports = class RequestReplyPipeline extends Writable {
    constructor(userFunction, destinationStream, options) {
        if (userFunction.length !== 1) {
            throw new RiffError(
                'error-request-reply-unsupported-function',
                `unsupported function: only functions with a single parameter are supported in request-reply mode (found ${userFunction.length} parameter(s) instead)`
            )
        }
        super(options);
        this.options = options;
        this.inputUnmarshaller = new InputUnmarshaller(this.options);
        this.functionStream = new MappingTransform(userFunction, this.options);
        this.outputMarshaller = null;
        this.destinationStream = destinationStream;
        this.startReceived = false;
        this.on('finish', () => {
            logger('Ending input stream');
            this.inputUnmarshaller.end();
        });
        this.on('error', () => {
            this.endAll();
        });
        logger('Request-reply pipeline initialized');
    }

    endAll() {
        this.inputUnmarshaller.emit('end');
        this.functionStream.emit('end');
        if (this.outputMarshaller) {
            this.outputMarshaller.end();
        }
        this.destinationStream.end();
    }

    _write(inputSignal, _, callback) {
        logger('Input signal received');
        if (!inputSignal['hasStart'] || !inputSignal['hasData']) {
            callback(new RiffError(
                'error-request-reply-input-type-invalid',
                `invalid input type ${Object.prototype.toString.call(inputSignal)}`));
            return;
        }
        if (!inputSignal.hasStart() && !inputSignal.hasData()) {
            callback(new RiffError(
                'error-request-reply-input-type-unsupported',
                'input is neither a start nor a data signal'));
            return;
        }

        if (inputSignal.hasStart()) {
            const outputContentTypes = inputSignal.getStart().getExpectedcontenttypesList();
            const outputCount = outputContentTypes.length;
            if (outputCount > 1) {
                callback(new RiffError(
                    'error-request-reply-invalid-output-count',
                    `invalid output count ${outputCount}: function can only have 1 output`));
                return;
            }
            const outputContentType = outputContentTypes[0];
            if (this.startReceived) {
                callback(new RiffError(
                    'error-request-reply-too-many-starts',
                    `start signal has already been received. Rejecting new start signal with content type ${outputContentType}`));
                return;
            }

            const marshaller = RequestReplyPipeline.createMarshaller(outputContentType, callback);
            if (typeof marshaller === "undefined") {
                return;
            }
            this.outputMarshaller = marshaller;
            pipeline(
                this.inputUnmarshaller,
                this.functionStream,
                this.outputMarshaller,
                this.destinationStream,
                (err) => {
                    if (err) {
                        logger('An error occurred, stopping now');
                        logger(err);
                        this.emit('error', err);
                    }
                }
            );
            this.startReceived = true;
            logger('Ready to process data');
        } else {
            if (!this.startReceived) {
                callback(new RiffError(
                    'error-request-reply-missing-start',
                    'start signal has not been received or processed yet. Rejecting data signal'));
                return;
            }
            this.inputUnmarshaller.write(inputSignal);
        }
        callback();
    }

    static createMarshaller(outputContentType, callback) {
        try {
            return new OutputMarshaller(0, outputContentType, this.options);
        } catch (err) {
            callback(err);
            return undefined;
        }
    }
};
