const {TextEncoder, TextDecoder} = require('util');
const services = require('./codegen/proto/riff-rpc_grpc_pb');
const messages = require('./codegen/proto/riff-rpc_pb');
const mediaTypeNegotiator = require('negotiator/lib/mediaType');
const grpc = require('grpc');

const hardcodedSquareFunction = (number) => {
	return number*number;
};

const invoke = (call) => {
	console.log('INVOKED');
	let expectedOutputContentTypes;
	call.on('data', (/*InputSignal*/ inputSignal) => {
		if (inputSignal.hasStart()) {
			const startSignal = inputSignal.getStart();
			expectedOutputContentTypes = startSignal.getExpectedcontenttypesList();
		} else if (inputSignal.hasData()) {
			const dataSignal = inputSignal.getData();
			const payload = dataSignal.getPayload();
			const contentType = dataSignal.getContenttype();
			if (contentType == 'text/plain') {
				const decoder = new TextDecoder('utf8');
				const input = decoder.decode(payload);
				const rawOutput = hardcodedSquareFunction(input);
				const outputContentType = expectedOutputContentTypes[0];
				if (outputContentType == 'text/plain') {
					const encoder = new TextEncoder('utf8');
					const output = '' + rawOutput;
					const outputFrame = new proto.streaming.OutputFrame();
					outputFrame.setPayload(encoder.encode(output));
					outputFrame.setContenttype(outputContentType);
					const outputSignal = new proto.streaming.OutputSignal();
					outputSignal.setData(outputFrame);
					call.write(outputSignal);
				} else {
					throw `unrecognized output content-type ${contentType}`;
				}
			} else {
				throw `unrecognized input content-type ${contentType}`;
			}
		} else {
			throw `unrecognized signal ${inputSignal}`;
		}
	});
	/*  
	 * 1. extract START signal
	 * 2. decode inputs
	 * 3. call function
	 * 4. encode outputs (based on 1.)
	 * 5. pass to callback
	 */
};

const main = () => {
  const server = new grpc.Server();
  server.addService(services.RiffService, {invoke: invoke});
  server.bind('0.0.0.0:50051', grpc.ServerCredentials.createInsecure());
  server.start();
};

main();