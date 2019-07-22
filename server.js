const services = require('./codegen/proto/riff-rpc_grpc_pb');
const RiffFacade = require('./lib/riff-facade');
const grpc = require('grpc');
const debug = require('debug')('node-invoker:server');

const userFunctionUri = process.env.FUNCTION_URI;
if (typeof userFunctionUri === 'undefined' || userFunctionUri === '') {
    throw 'FUNCTION_URI envvar not set or unset. Aborting.'
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
    server.bind(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure());
    server.start();
    debug('Ready to process signals');
};

main();
