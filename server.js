const StreamingPipeline = require('./lib/streaming-pipeline');
const services = require('./codegen/proto/riff-rpc_grpc_pb');
const logger = require('util').debuglog('riff');
const grpc = require('grpc');

const userFunctionUri = process.env.FUNCTION_URI;
if (typeof userFunctionUri === 'undefined' || userFunctionUri === '') {
    throw 'FUNCTION_URI envvar not set or empty. Aborting.'
}
const port = process.env.HTTP_PORT || process.env.PORT || '8081';
const userFunction = (fn => {
    if (fn.__esModule && typeof fn.default === 'function') {
        // transpiled ES Module interop
        // see https://2ality.com/2017/01/babel-esm-spec-mode.html
        return fn.default;
    }
    return fn;
})(require(userFunctionUri));

const invoke = (call) => {
    logger('New invocation started');
    const streamingPipeline = new StreamingPipeline(userFunction, call, {objectMode: true});
    call.pipe(streamingPipeline);
};

const main = () => {
    const server = new grpc.Server();
    server.addService(services.RiffService, {invoke: invoke});

    const shutdown = () => {
        logger('Graceful shutdown started');
        server.tryShutdown(() => logger('Graceful shutdown completed'));
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    server.bind(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure());
    server.start();
    logger('Ready to process signals');

};

main();
