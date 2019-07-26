const {Transform} = require('stream');
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
        this.functionArguments = [];
    }

    get parameterCount() {
        return this.userFunction.length;
    }

    _transform(inputSignal, _, callback) {
        logger('Input signal received');
        if (!inputSignal['hasStart'] || !inputSignal['hasData']) {
            callback(new Error(`invalid input type ${Object.prototype.toString.call(inputSignal)}`));
            return;
        }
        if (!inputSignal.hasStart() && !inputSignal.hasData()) {
            callback(new Error('input is neither a start nor a data signal'));
            return;
        }

        if (inputSignal.hasStart()) {
            const outputContentTypes = inputSignal.getStart().getExpectedcontenttypesList();
            if (this.startReceived) {
                callback(new Error(`start signal has already been received. Rejecting new start signal with content types [${outputContentTypes.join()}]`));
                return;
            }
            const outputCount = outputContentTypes.length;
            if (outputCount > this.parameterCount) {
                callback(new Error(`invalid output count ${outputCount}: function has only ${this.parameterCount} parameter(s)`));
                return;
            }
            const inputCount = this.parameterCount - outputContentTypes.length;
            logger(`Start signal received: ${outputContentTypes}`);
            logger(`Wiring ${inputCount} input stream(s)`);
            for (let i = 0; i < inputCount; i++) {
                const marshaller = new InputUnmarshaller(i, this.options);
                this.pipe(marshaller); // FIXME: this is wasteful and should not be needed, but see FIXME below
                this.functionArguments.push(marshaller);
            }
            logger(`Wiring ${outputCount} output stream(s)`);
            for (let i = 0; i < outputCount; i++) {
                const marshaller = new OutputMarshaller(i, outputContentTypes[i], this.options);
                marshaller.pipe(this.destinationStream);
                this.functionArguments.push(marshaller);
            }
            this.userFunction.apply(null, this.functionArguments);
            this.startReceived = true;
            logger('Ready to process data');
        } else {
            if (!this.startReceived) {
                callback(new Error('start signal has not been received or processed yet. Rejecting data signal'));
                return;
            }
            // FIXME: this.functionArguments[input.getData().getArgindex()].push(inputSignal) does not seem to work
            // because of this, RiffFacade needs to pipe to the unmarshallers and therefore be Transform and not just Writable
            this.push(inputSignal);
        }
        callback();
    }
};
