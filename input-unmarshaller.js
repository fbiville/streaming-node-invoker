const {PassThrough, Transform} = require('stream');
const OutputForwarder = require('./output-forwarder');
const InputForwarder = require('./input-forwarder');
const debug = require('debug')('node-invoker:unmarshaller');

module.exports = class InputUnmarshaller extends Transform {

	constructor(functionParameterCount, outputMarshaller, options) {
		super(options);
		this.startReceived = false;
		this.parameterCount = functionParameterCount;
		this.outputMarshaller = outputMarshaller;
		this.options = options;
		const parameterStreams = [];
		for (let i = 0; i < this.parameterCount; i++) {
			parameterStreams[i] = new PassThrough(this.options);
		}
		this.parameterStreams = parameterStreams;
		this.forwarders = [];
		this.expectedOutputContentTypes = null;
	}

	get outputContentTypes() {
		return this.expectedOutputContentTypes;
	}

	get inputCount() {
		return this.parameterCount - this.outputCount;
	}

	get outputCount() {
		return this.expectedOutputContentTypes.length;
	}

  	_transform(inputSignal, _, callback) {
  		debug(`Input signal received`);
		if (inputSignal.hasStart()) {
			if (this.startReceived) {
				throw 'start signal has already been received. Rejecting new start signal';
			}
			this.startReceived = true;
			this.expectedOutputContentTypes = inputSignal.getStart().getExpectedcontenttypesList();
			if (this.outputCount > this.parameterCount) {
				throw `invalid output count ${this.outputCount} function has only ${this.parameterCount} parameter(s)`;
			}
			debug(`Start signal received: ${this.expectedOutputContentTypes}`);
			debug(`Function has ${this.inputCount} input(s) and ${this.outputCount} output(s)`);
			this._pipeInputStreams(this.outputMarshaller);
			this._pipeOutputStreams(this.outputMarshaller);
		} else if (inputSignal.hasData()) {
			if (!this.startReceived) {
				throw 'start signal has not been received. Rejecting data signal';
			}
			const inputIndex = inputSignal.getData().getArgindex();
			if (inputIndex >= this.inputCount) {
				throw `invalid input #${inputIndex}: function has only ${this.inputCount} input(s)`; 
			}
			this.push(inputSignal);
		} else {
			throw `unrecognized signal ${inputSignal}`;
		}
		callback();
	}

	destroy() {
		super.destroy();
		this.parameterStreams.forEach(ps => ps.destroy());
		this.forwarders.forEach(fwd => fwd.destroy());
		this.parameterStreams = [];
		this.forwarders = [];
	}

	_pipeInputStreams(duplex) {
		for (let inputIndex = 0; inputIndex < this.inputCount; inputIndex++) { 
			const inputStream = this.parameterStreams[inputIndex];
			const forwarder = new InputForwarder(inputIndex, this.options);
			this.pipe(forwarder).pipe(inputStream);
			this.forwarders.push(forwarder);
		}
	}

	_pipeOutputStreams(duplex) {
		for (let outputIndex = 0; outputIndex < this.outputCount; outputIndex++) { 
			const outputStream = this.parameterStreams[this.inputCount + outputIndex];
			const contentType = this.expectedOutputContentTypes[outputIndex];
			const forwarder = new OutputForwarder(outputIndex, contentType, this.options);
			debug(`Output #${outputIndex} values will be forwarded with content type ${contentType}`);
			outputStream.pipe(forwarder).pipe(duplex);
			this.forwarders.push(forwarder);
		}
	}
};