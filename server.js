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
	const userFunction = samples.streamingMultiIoFunction;

	const parameterCount = userFunction.length;
	debug(`Function accepts ${parameterCount} parameter(s)`);
	const outputMarshaller = new OutputMarshaller({objectMode: true});
	const inputUnmarshaller = new InputUnmarshaller(parameterCount, outputMarshaller, {objectMode: true});

	userFunction.apply(null, inputUnmarshaller.parameterStreams);
	call.pipe(inputUnmarshaller);
	outputMarshaller.pipe(call);

	call.on('end', () => {
		debug('Cleaning up before next call');
		inputUnmarshaller.destroy();
		outputMarshaller.destroy();
	});
};

const main = () => {
  const server = new grpc.Server();
  server.addService(services.RiffService, {invoke: invoke});
  server.bind('0.0.0.0:50051', grpc.ServerCredentials.createInsecure());
  server.start();
};

main();