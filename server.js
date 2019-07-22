const {TextEncoder, TextDecoder} = require('util');
const Stream = require('stream');
const services = require('./codegen/proto/riff-rpc_grpc_pb');
const OutputMarshaller = require('./lib/output-marshaller');
const messages = require('./codegen/proto/riff-rpc_pb');
const mediaTypeNegotiator = require('negotiator/lib/mediaType');
const RiffFacade = require('./lib/riff-facade');
const grpc = require('grpc');
const debug = require('debug')('node-invoker:server');

const PORT = process.env.HTTP_PORT || process.env.PORT || '8081';
const userFunction = (fn => {
	debug(fn.toString());
    if (fn.__esModule && typeof fn.default === 'function') {
        // transpiled ES Module interop
        return fn.default;
    }
    return fn;
})(require(process.env.FUNCTION_URI));

const invoke = (call) => {
	debug('New invocation started');
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
	server.bind(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure());
	server.start();
	debug('Ready to process signals');
};

main();