const {TextEncoder, TextDecoder} = require('util');
const Stream = require('stream');
const services = require('./codegen/proto/riff-rpc_grpc_pb');
const samples = require('./sample-functions');
const OutputMarshaller = require('./lib/output-marshaller');
const messages = require('./codegen/proto/riff-rpc_pb');
const mediaTypeNegotiator = require('negotiator/lib/mediaType');
const RiffFacade = require('./lib/riff-facade');
const grpc = require('grpc');
const debug = require('debug')('node-invoker:server');


const invoke = (call) => {
	debug('Invocation started');
	const userFunction = samples.streamingMultiIoFunction;
	const riffFacade = new RiffFacade(userFunction, call, {objectMode: true});
	call.pipe(riffFacade);

	call.on('end', () => {
		debug('Cleaning up before next call');
		riffFacade.destroy();
	});
};

const main = () => {
	const server = new grpc.Server();
	server.addService(services.RiffService, {invoke: invoke});
	server.bind('0.0.0.0:50051', grpc.ServerCredentials.createInsecure());
	server.start();
};

main();