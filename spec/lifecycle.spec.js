const StreamingPipeline = require('../lib/streaming-pipeline');
const {PassThrough} = require('stream');

describe('streaming pipeline =>', () => {

    let streamingPipeline;
    let destinationStream;

    beforeEach(() => {
        destinationStream = new PassThrough({objectMode: true});
    });

    afterEach(() => {
        streamingPipeline.destroy();
        destinationStream.destroy();
    });

    describe('with a function implementing lifecycle hooks =>', () => {
        const userFunction = require('./helpers/lifecycle/simple-lifecycle-function');

        beforeEach(() => {
            streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {objectMode: true});
        });

        it('invokes the $init hook when the pipeline is instantiated', () => {
            expect(userFunction.getCounter()).toEqual(0, 'counter should have been reset by $init hook');
        });

        it('invokes the $init hook when the destination stream ends', () => {
            destinationStream.end();
            expect(userFunction.getCounter()).toEqual(Number.MAX_SAFE_INTEGER, 'counter should have been changed by $destroy hook');
        });
    });

    describe('with a function with a too slow $init =>', () => {
        const userFunction = require('./helpers/lifecycle/slow-init-function');

        it('emits an error', (done) => {
            streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {
                objectMode: true,
                hookTimeoutInMs: 100
            });
            streamingPipeline.on('error', (err) => {
                expect(err.type).toEqual('error-hook-timeout');
                expect(err.cause).toEqual('The hook took too long to run. Aborting now');
                done();
            });
        });
    });

    describe('with a function with a too slow $destroy =>', () => {
        const userFunction = require('./helpers/lifecycle/slow-destroy-function');

        it('emits an error', (done) => {
            streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {
                objectMode: true,
                hookTimeoutInMs: 100
            });
            streamingPipeline.on('error', (err) => {
                expect(err.type).toEqual('error-hook-timeout');
                expect(err.cause).toEqual('The hook took too long to run. Aborting now');
                done();
            });
            destinationStream.end();
        });
    });

    describe('with a function with a failing $init =>', () => {
        const userFunction = require('./helpers/lifecycle/failing-init-function');

        it('emits an error', (done) => {
            streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {
                objectMode: true,
                hookTimeoutInMs: 100
            });
            streamingPipeline.on('error', (err) => {
                expect(err.type).toEqual('error-hook-runtime-error');
                expect(err.cause.message).toEqual('oopsie');
                done();
            });
        });
    });

    describe('with a function with a failing $destroy =>', () => {
        const userFunction = require('./helpers/lifecycle/failing-destroy-function');

        it('emits an error', (done) => {
            streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {
                objectMode: true,
                hookTimeoutInMs: 100
            });
            streamingPipeline.on('error', (err) => {
                expect(err.type).toEqual('error-hook-runtime-error');
                expect(err.cause.message).toEqual('oopsie');
                done();
            });
            destinationStream.end();
        });
    });
});
