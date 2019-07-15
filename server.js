const {TextEncoder, TextDecoder} = require('util');
const Stream = require('stream');
const services = require('./codegen/proto/riff-rpc_grpc_pb');
const samples = require('./sample-functions');
const OutputMarshaller = require('./output-marshaller');
const messages = require('./codegen/proto/riff-rpc_pb');
const mediaTypeNegotiator = require('negotiator/lib/mediaType');
const InputUnmarshaller = require('./input-unmarshaller');
const grpc = require('grpc');
const debug = require('debug')('node-invoker:server');


const invoke = (call) => {
	debug('Invocation started');
	const inputUnmarshaller = new InputUnmarshaller({objectMode: true});
	const outputMarshaller = new OutputMarshaller(inputUnmarshaller, {objectMode: true});

	// streaming function:
	outputMarshaller.pipe(call);
	samples.streamingFunction(call.pipe(inputUnmarshaller), outputMarshaller);
	// non-streaming function:
	// const userFn = new Stream.Transform({objectMode: true});
	// userFn._transform = (input, _, cb) => {
	// 	userFn.push(samples.nonStreamingFunction(input));
	// 	cb();
	// };
	// call.pipe(inputUnmarshaller).pipe(userFn).pipe(outputMarshaller).pipe(call);
};

const main = () => {
  const server = new grpc.Server();
  server.addService(services.RiffService, {invoke: invoke});
  server.bind('0.0.0.0:50051', grpc.ServerCredentials.createInsecure());
  server.start();
};

main();