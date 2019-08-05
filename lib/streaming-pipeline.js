const {Writable} = require('stream');
const RiffError = require('./riff-error');
const OutputMarshaller = require('./output-marshaller');
const logger = require('util').debuglog('riff');
const InputUnmarshaller = require('./input-unmarshaller');

module.exports = class StreamingPipeline extends Writable {

    constructor(userFunction, destinationStream, options) {
        super(options);
        this.options = options;
        this.userFunction = userFunction;
        this.destinationStream = destinationStream;
        this.startReceived = false;
        this._functionInputs = [];
        this._functionOutputs = [];
        this.finishedOutputs = 0;
        this.on('finish', () => {
            // upstream source is done emitting input signals
            logger('Ending input streams');
            this._endInputs();
        });
        this.on('error', (err) => {
            logger('An error occurred, stopping now');
            logger(err);
            this._endAll();
        });
        logger('Streaming pipeline initialized');
    }

    _endAll() {
        this._endInputs();
        this._functionOutputs.forEach((fi) => fi.end());
        this.destinationStream.end();
        this.end();
    }

    _endInputs() {
        this._functionInputs.forEach((fi) => fi.emit('end'));
    }

    get parameterCount() {
        return this.userFunction.length;
    }

    _write(inputSignal, _, callback) {
        logger('Input signal received');
        if (!inputSignal || !inputSignal['hasStart'] || !inputSignal['hasData']) {
            callback(new RiffError(
                'error-streaming-input-type-invalid',
                `invalid input type ${Object.prototype.toString.call(inputSignal)}`));
            return;
        }
        if (!inputSignal.hasStart() && !inputSignal.hasData()) {
            callback(new RiffError(
                'error-streaming-input-type-unsupported',
                'input is neither a start nor a data signal'));
            return;
        }

        if (inputSignal.hasStart()) {
            const outputContentTypes = inputSignal.getStart().getExpectedcontenttypesList();
            if (this.startReceived) {
                callback(new RiffError(
                    'error-streaming-too-many-starts',
                    `start signal has already been received. Rejecting new start signal with content types [${outputContentTypes.join()}]`));
                return;
            }
            const outputCount = outputContentTypes.length;
            if (outputCount > this.parameterCount) {
                callback(new RiffError(
                    'error-streaming-invalid-output-count',
                    `invalid output count ${outputCount}: function has only ${this.parameterCount} parameter(s)`));
                return;
            }
            logger(`Start signal received: ${outputContentTypes}`);
            this.wireInputs(this.parameterCount - outputContentTypes.length);
            this.wireOutputs(outputContentTypes);
            this.invoke(callback);
            this.startReceived = true;
            logger('Ready to process data');
        } else {
            if (!this.startReceived) {
                callback(new RiffError(
                    'error-streaming-missing-start',
                    'start signal has not been received or processed yet. Rejecting data signal'));
                return;
            }
            const inputIndex = inputSignal.getData().getArgindex();
            const inputUnmarshaller = this._functionInputs[inputIndex];
            inputUnmarshaller.write(inputSignal);
            callback();
        }
    }

    wireInputs(inputCount) {
        logger(`Wiring ${inputCount} input stream(s)`);
        for (let i = 0; i < inputCount; i++) {
            const inputUnmarshaller = new InputUnmarshaller(this.options);
            inputUnmarshaller.on('error', (err) => {
                this.emit('error', err);
            });
            this._functionInputs[i] = inputUnmarshaller;
        }
    }

    wireOutputs(outputContentTypes) {
        const outputCount = outputContentTypes.length;
        logger(`Wiring ${outputCount} output stream(s)`);
        for (let i = 0; i < outputCount; i++) {
            const marshaller = new OutputMarshaller(i, outputContentTypes[i], this.options);
            marshaller.pipe(this.destinationStream, {end: false});
            marshaller.on('finish', () => {
                this.finishedOutputs++;
                if (this.finishedOutputs === this._functionOutputs.length) {
                    logger('Last output stream closing: ending destination stream');
                    this.destinationStream.end();
                }
            });
            this._functionOutputs[i] = marshaller;
        }
    }

    invoke(callback) {
        try {
            this.userFunction.apply(null, [...this._functionInputs, ...this._functionOutputs]);
            callback();
        } catch (err) {
            callback(new RiffError('streaming-function-runtime-error', err));
        }
    }
};
