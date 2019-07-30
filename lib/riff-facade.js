const {Transform} = require('stream');
const RiffError = require('./riff-error');
const OutputMarshaller = require('./output-marshaller');
const logger = require('util').debuglog('riff');
const InputUnmarshaller = require('./input-unmarshaller');

module.exports = class RiffFacade extends Transform {

    constructor(userFunction, destinationStream, options) {
        super(options);
        this.options = options;
        this.userFunction = userFunction;
        this.destinationStream = destinationStream;
        this.startReceived = false;
        this._functionInputs = [];
        this._functionOutputs = [];
        this.on('finish', () => {
            logger('Ending input streams');
            this.endInputs();
        });
        this.finishedOutputs = 0;
    }

    endInputs() {
        this._functionInputs.forEach((fi) => fi.emit('end'));
    }

    get parameterCount() {
        return this.userFunction.length;
    }

    _transform(inputSignal, _, callback) {
        logger('Input signal received');
        if (!inputSignal['hasStart'] || !inputSignal['hasData']) {
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
            const inputCount = this.parameterCount - outputContentTypes.length;
            logger(`Start signal received: ${outputContentTypes}`);
            logger(`Wiring ${inputCount} input stream(s)`);
            for (let i = 0; i < inputCount; i++) {
                this._functionInputs[i] = new InputUnmarshaller(this.options);
            }
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
            this.userFunction.apply(null, [...this._functionInputs, ...this._functionOutputs]);
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
        }
        callback();
    }
};
