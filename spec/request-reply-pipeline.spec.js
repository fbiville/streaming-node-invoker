const RequestReplyPipeline = require('../lib/request-reply-pipeline');
const {PassThrough} = require('stream');
const {
    newFixedSource,
    newInputFrame,
    newInputSignal,
    newOutputFrame,
    newOutputSignal,
    newStartFrame,
    newStartSignal
} = require('./helpers/factories');

describe('request-reply pipeline =>', () => {

    describe('with a valid request-reply function =>', () => {

        let userFunction = (arg) => arg ** 2;
        let destinationStream;
        let requestReplyPipeline;
        let fixedSource;

        beforeEach(() => {
            destinationStream = new PassThrough({objectMode: true});
            requestReplyPipeline = new RequestReplyPipeline(userFunction, destinationStream, {objectMode: true});
        });

        afterEach(() => {
            fixedSource.destroy();
            requestReplyPipeline.destroy();
            destinationStream.destroy();
        });

        describe('with valid input signals =>', () => {
            const data = [7, 11, 2];
            const result = data.map(userFunction);
            beforeEach(() => {
                fixedSource = newFixedSource([
                    newStartSignal(newStartFrame(['text/plain'])),
                    ...(data.map((payload) => newInputSignal(newInputFrame(0, 'application/json', payload))))
                ]);
            });

            it('invokes the function and send the outputs', (done) => {
                requestReplyPipeline.on('error', (err) => {
                    done(err);
                });
                let index = 0;
                destinationStream.on('data', (chunk) => {
                    if (index === result.length) {
                        done(new Error(`expected only ${result.length} results`));
                    }
                    expect(chunk).toEqual(
                        newOutputSignal(newOutputFrame(0, 'text/plain', result[index++]))
                    );
                });
                destinationStream.on('finish', () => {
                    done();
                });
                fixedSource.pipe(requestReplyPipeline);
            });
        });

        describe('with badly-typed inputs =>', () => {
            beforeEach(() => {
                fixedSource = newFixedSource(["not a signal"]);
            });

            it('emits an error', (done) => {
                requestReplyPipeline.on('error', (err) => {
                    expect(err.type).toEqual('error-request-reply-input-type-invalid');
                    expect(err.cause).toEqual('invalid input type [object String]');
                    done();
                });
                fixedSource.pipe(requestReplyPipeline);
            });
        });

        describe('with a buggy input signal =>', () => {
            beforeEach(() => {
                fixedSource = newFixedSource([newInputSignal(null)]);
            });

            it('emits an error', (done) => {
                requestReplyPipeline.on('error', (err) => {
                    expect(err.type).toEqual('error-request-reply-input-type-unsupported');
                    expect(err.cause).toEqual('input is neither a start nor a data signal');
                    done();
                });
                fixedSource.pipe(requestReplyPipeline);
            });
        });

        describe('with too many start signals =>', () => {
            beforeEach(() => {
                fixedSource = newFixedSource([
                    newStartSignal(newStartFrame(['text/plain'])),
                    newStartSignal(newStartFrame(['application/x-doom']))
                ]);
            });

            it('emits an error', (done) => {
                destinationStream.on('data', () => {
                    done(new Error('should not receive any data'));
                });
                requestReplyPipeline.on('error', (err) => {
                    expect(err.type).toEqual('error-request-reply-too-many-starts');
                    expect(err.cause).toEqual(
                        'start signal has already been received. ' +
                        'Rejecting new start signal with content type application/x-doom'
                    );
                    done();
                });
                fixedSource.pipe(requestReplyPipeline);
            })
        });

        describe('with a start signal with more than one output content type =>', () => {
            beforeEach(() => {
                fixedSource = newFixedSource([
                    newStartSignal(newStartFrame(['text/plain', 'text/sgml']))
                ]);
            });

            it('emits an error', (done) => {
                destinationStream.on('data', () => {
                    done(new Error('should not receive any data'));
                });
                requestReplyPipeline.on('error', (err) => {
                    expect(err.type).toEqual('error-request-reply-invalid-output-count');
                    expect(err.cause).toEqual(
                        'invalid output count 2: function can only have 1 output'
                    );
                    done();
                });
                fixedSource.pipe(requestReplyPipeline);
            })
        });

        describe('with no start signal to start with =>', () => {
            beforeEach(() => {
                fixedSource = newFixedSource([newInputSignal(
                    newInputFrame(42, 'application/x-doom', '??'))
                ]);
            });

            it('emits an error', (done) => {
                destinationStream.on('data', () => {
                    done(new Error('should not receive any data'));
                });
                requestReplyPipeline.on('error', (err) => {
                    expect(err.type).toEqual('error-request-reply-missing-start');
                    expect(err.cause).toEqual(
                        'start signal has not been received or processed yet. ' +
                        'Rejecting data signal'
                    );
                    done();
                });
                fixedSource.pipe(requestReplyPipeline);
            })
        });
    });

    describe('when facing errors =>', () => {

        let userFunction;
        let destinationStream;
        let requestReplyPipeline;
        let fixedSource;

        beforeEach(() => {
            destinationStream = new PassThrough({objectMode: true});
        });

        afterEach(() => {
            requestReplyPipeline.destroy();
            fixedSource.destroy();
            destinationStream.destroy();
        });

        describe('when an invalid input cannot be unmarshalled =>', () => {
            beforeEach(() => {
                userFunction = (input) => {
                    throw new Error(`error with ${input}`);
                };
                fixedSource = newFixedSource([
                    newStartSignal(newStartFrame(['text/plain'])),
                    newInputSignal(newInputFrame(0, 'application/json', "invalid JSON"))
                ]);
                requestReplyPipeline = new RequestReplyPipeline(userFunction, destinationStream, {objectMode: true});
            });

            it('ends the pipeline', (done) => {
                destinationStream.on('data', () => {
                    done(new Error('should not receive any data'));
                });
                destinationStream.on('finish', () => {
                    done();
                });
                fixedSource.pipe(requestReplyPipeline);
            });
        });

        describe('when a function throws =>', () => {
            beforeEach(() => {
                userFunction = (input) => {
                    throw new Error(`error with ${input}`);
                };
                fixedSource = newFixedSource([newStartSignal(newStartFrame(['text/plain']))]);
                requestReplyPipeline = new RequestReplyPipeline(userFunction, destinationStream, {objectMode: true});
            });

            it('ends the pipeline', (done) => {
                destinationStream.on('data', () => {
                    done(new Error('should not receive any data'));
                });
                destinationStream.on('finish', () => {
                    done();
                });
                fixedSource.pipe(requestReplyPipeline);
            });
        });

        describe('with an invalid output content-type =>', () => {
            beforeEach(() => {
                userFunction = (input) => {
                    return input;
                };
                fixedSource = newFixedSource([
                    newStartSignal(newStartFrame(['text/csv'])),
                    newInputSignal(newInputFrame(0, 'text/plain', "nuff said"))
                ]);
                requestReplyPipeline = new RequestReplyPipeline(userFunction, destinationStream, {objectMode: true});
            });

            it('ends the pipeline', (done) => {
                destinationStream.on('data', () => {
                    done(new Error('should not receive any data'));
                });
                destinationStream.on('finish', () => {
                    done();
                });
                fixedSource.pipe(requestReplyPipeline);
            });
        });

        describe('with an invalid output =>', () => {
            beforeEach(() => {
                userFunction = (input) => {
                    return Symbol(input);
                };
                fixedSource = newFixedSource([
                    newStartSignal(newStartFrame(['application/json'])),
                    newInputSignal(newInputFrame(0, 'text/plain', "nuff said"))
                ]);
                requestReplyPipeline = new RequestReplyPipeline(userFunction, destinationStream, {objectMode: true});
            });

            it('ends the pipeline', (done) => {
                destinationStream.on('data', () => {
                    done(new Error('should not receive any data'));
                });
                destinationStream.on('finish', () => {
                    done();
                });
                fixedSource.pipe(requestReplyPipeline);
            });
        });
    });

    describe('with an invalid user function =>', () => {

        let destinationStream;

        beforeEach(() => {
            destinationStream = new PassThrough();
        });

        afterEach(() => {
            destinationStream.destroy();
        });

        it('fails to instantiate', () => {
            try {
                new RequestReplyPipeline((too, many, inputs) => {
                    throw `should not be called ${too} ${many} ${inputs}`;
                }, destinationStream);
                fail('constructor should throw')
            } catch (err) {
                expect(err.type).toEqual('error-request-reply-unsupported-function');
                expect(err.cause).toEqual('unsupported function: ' +
                    'only functions with a single parameter are supported in request-reply mode ' +
                    '(found 3 parameter(s) instead)');
            }
        });
    });
});
