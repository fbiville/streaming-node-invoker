const {Transform} = require('stream');
const OutputMarshaller = require('./output-marshaller');
const logger = require('util').debuglog('riff');
const InputUnmarshaller = require('./input-unmarshaller');

module.exports = class RiffFacade extends Transform {
    constructor(userFunction, grpcStream, options) {
        super(options);
        this.options = options;
        this.userFunction = userFunction;
        this.grpcStream = grpcStream;
        this.startReceived = false;
        this.functionArguments = [];
    }

    get parameterCount() {
        return this.userFunction.length;
    }

    _transform(inputSignal, _, callback) {
        logger('Input signal received');
        if (inputSignal.hasStart()) {
            if (this.startReceived) {
                throw 'start signal has already been received. Rejecting new start signal';
            }
            const outputContentTypes = inputSignal.getStart().getExpectedcontenttypesList();
            if (outputContentTypes.length > this.parameterCount) {
                throw `invalid output count ${this.outputCount} function has only ${this.parameterCount} parameter(s)`;
            }
            const inputCount = this.parameterCount - outputContentTypes.length;
            const outputCount = outputContentTypes.length;
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
                marshaller.pipe(this.grpcStream);
                this.functionArguments.push(marshaller);
            }
            this.userFunction.apply(null, this.functionArguments);
            this.startReceived = true;
            logger('Ready to process data');
        } else if (inputSignal.hasData()) {
            if (!this.startReceived) {
                throw 'start signal has not been received or processed yet. Rejecting data signal';
            }
            // FIXME: this.functionArguments[input.getData().getArgindex()].push(inputSignal) does not seem to work
            // because of this, RiffFacade needs to pipe to the unmarshallers and therefore be Transform and not just Writable
            this.push(inputSignal);
        } else {
            throw `unrecognized signal ${inputSignal}`;
        }
        callback();
    }
};
