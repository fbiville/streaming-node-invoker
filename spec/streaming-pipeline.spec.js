const StreamingPipeline = require('../lib/streaming-pipeline');
const {PassThrough, Transform} = require('stream');
const {
    newFixedSource,
    newInputFrame,
    newInputSignal,
    newMappingTransform,
    newOutputFrame,
    newOutputSignal,
    newStartFrame,
    newStartSignal
} = require('./helpers/factories');

describe('streaming pipeline =>', () => {
    let destinationStream;
    let streamingPipeline;
    let fixedSource;

    beforeEach(() => {
        destinationStream = new PassThrough({objectMode: true});
    });

    afterEach(() => {
        fixedSource.destroy();
        streamingPipeline.destroy();
        destinationStream.destroy();
    });

    describe('with a reliable function =>', () => {
        const userFunction = (inputStream, outputStream) => {
            inputStream.pipe(newMappingTransform((arg) => arg + 42)).pipe(outputStream);
        };

        beforeEach(() => {
            streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {objectMode: true});
        });

        describe('with valid input signals =>', () => {
            beforeEach(() => {
                fixedSource = newFixedSource([
                    newStartSignal(newStartFrame(['text/plain'])),
                    newInputSignal(newInputFrame(
                        0,
                        'application/json',
                        '"the ultimate answer to life the universe and everything is: "'
                    ))
                ]);
            });

            it('invokes the function and send the outputs', (done) => {
                streamingPipeline.on('error', (err) => {
                    done(err);
                });
                let dataReceived = false;
                destinationStream.on('data', (chunk) => {
                    expect(dataReceived).toBeFalsy('expected to receive data only once');
                    expect(chunk).toEqual(
                        newOutputSignal(newOutputFrame(
                            0,
                            'text/plain',
                            'the ultimate answer to life the universe and everything is: 42'
                        ))
                    );
                    dataReceived = true;
                });
                destinationStream.on('finish', () => {
                    done();
                });
                fixedSource.pipe(streamingPipeline);
            });
        });

        describe('with a closed input stream =>', () => {
            beforeEach(() => {
                fixedSource = newFixedSource([
                    newStartSignal(newStartFrame([]))
                ]);
            });

            // when the source ends (such as an internal call like `this.push(null)`), the piped destination will have its 'end' method called
            // see https://nodejs.org/api/stream.html#stream_readable_pipe_destination_options
            it('will end input streams when the piped source ends', (done) => {
                let inputEnded = false;
                const userFunction = (inputStream) => {
                    inputStream.on('end', () => {
                        inputEnded = true;
                    })
                };
                streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {objectMode: true});
                streamingPipeline.on('finish', () => {
                    expect(inputEnded).toBeTruthy('input stream should have been ended');
                    done();
                });
                fixedSource.pipe(streamingPipeline);
            })
        });

        describe('with an immediately closing output stream =>', () => {
            const data = ['1', '4', '9'];
            beforeEach(() => {
                fixedSource = newFixedSource([
                    newStartSignal(newStartFrame(['text/plain', 'text/plain'])),
                    ...(data.map((payload) => newInputSignal(newInputFrame(0, 'text/plain', payload))))
                ]);
            });

            it('the other output stream can still emit to the destination stream', (done) => {
                const userFunction = (inputStream, outputStream1, outputStream2) => {
                    outputStream1.end();
                    inputStream.pipe(outputStream2);
                };

                let receivedOutputSignalCount = 0;
                destinationStream.on('data', (outputSignal) => {
                    expect(receivedOutputSignalCount).toBeLessThan(data.length, `expected to see only ${data.length}, already seen ${receivedOutputSignalCount + 1}th`);
                    expect(outputSignal).toEqual(newOutputSignal(newOutputFrame(1, 'text/plain', data[receivedOutputSignalCount])));
                    receivedOutputSignalCount++;
                });
                destinationStream.on('finish', () => {
                    expect(receivedOutputSignalCount).toEqual(data.length, `expected to see only ${data.length}, seen ${receivedOutputSignalCount}`);
                    done();
                });
                streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {objectMode: true});
                fixedSource.pipe(streamingPipeline);
            })
        });

        describe('with badly-typed inputs =>', () => {
            beforeEach(() => {
                fixedSource = newFixedSource(["not a signal"]);
            });

            it('emits an error', (done) => {
                let closed = false;
                streamingPipeline.on('finish', () => {
                    closed = true;
                });
                // there is already a error handler registered at that point
                // this pre-registered handler will close the pipeline.
                // then and only then, the handler below takes over
                streamingPipeline.on('error', (err) => {
                    expect(err.type).toEqual('error-streaming-input-type-invalid');
                    expect(err.cause).toEqual('invalid input type [object String]');
                    expect(closed).toBeTruthy('should be closed');
                    done();
                });
                fixedSource.pipe(streamingPipeline);
            });
        });

        describe('with a buggy input signal =>', () => {
            beforeEach(() => {
                fixedSource = newFixedSource([newInputSignal(null)]);
            });

            it('emits an error', (done) => {
                let closed = false;
                streamingPipeline.on('finish', () => {
                    closed = true;
                });
                // there is already a error handler registered at that point
                // this pre-registered handler will close the pipeline
                // then and only then the handler below takes over
                streamingPipeline.on('error', (err) => {
                    expect(err.type).toEqual('error-streaming-input-type-unsupported');
                    expect(err.cause).toEqual('input is neither a start nor a data signal');
                    expect(closed).toBeTruthy('should be closed');
                    done();
                });
                fixedSource.pipe(streamingPipeline);
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
                let errored = false;
                streamingPipeline.on('error', (err) => {
                    expect(err.type).toEqual('error-streaming-too-many-starts');
                    expect(err.cause).toEqual(
                        'start signal has already been received. ' +
                        'Rejecting new start signal with content types [application/x-doom]'
                    );
                    errored = true;
                });
                streamingPipeline.on('finish', () => {
                    expect(errored).toBeTruthy('pipeline should have errored');
                    done();
                });
                fixedSource.pipe(streamingPipeline);
            })
        });

        describe('with a start signal with too many output content types =>', () => {
            beforeEach(() => {
                fixedSource = newFixedSource([
                    newStartSignal(newStartFrame(['text/plain', 'text/sgml', 'text/yaml']))
                ]);
            });

            it('emits an error', (done) => {
                destinationStream.on('data', () => {
                    done(new Error('should not receive any data'));
                });
                let closed = false;
                streamingPipeline.on('finish', () => {
                    closed = true;
                });
                // there is already a error handler registered at that point
                // this pre-registered handler will close the pipeline
                // then and only then the handler below takes over
                streamingPipeline.on('error', (err) => {
                    expect(err.type).toEqual('error-streaming-invalid-output-count');
                    expect(err.cause).toEqual(
                        'invalid output count 3: function has only 2 parameter(s)'
                    );
                    expect(closed).toBeTruthy('should be closed');
                    done();
                });
                fixedSource.pipe(streamingPipeline);
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
                let closed = false;
                streamingPipeline.on('finish', () => {
                    closed = true;
                });
                // there is already a error handler registered at that point
                // this pre-registered handler will close the pipeline
                // then and only then the handler below takes over
                streamingPipeline.on('error', (err) => {
                    expect(err.type).toEqual('error-streaming-missing-start');
                    expect(err.cause).toEqual(
                        'start signal has not been received or processed yet. ' +
                        'Rejecting data signal'
                    );
                    expect(closed).toBeTruthy('should be closed');
                    done();
                });
                fixedSource.pipe(streamingPipeline);
            })
        });
    });

    describe('with a failing-at-invocation-time function =>', () => {
        const userFunction = (inputStream, outputStream) => {
            inputStream.pipe(outputStream);
            null.nope();
        };

        beforeEach(() => {
            streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {objectMode: true});
            fixedSource = newFixedSource([
                newStartSignal(newStartFrame(['text/plain'])),
                newInputSignal(newInputFrame(0, 'application/json', '"42"'))
            ]);
        });

        it('ends the pipeline', (done) => {
            destinationStream.on('data', () => {
                done(new Error('should not receive any data'));
            });
            let closed = false;
            streamingPipeline.on('finish', () => {
                closed = true;
            });
            // there is already a error handler registered at that point
            // then and only then the handler below takes over
            // this pre-registered handler will close the pipeline
            let errored = false;
            streamingPipeline.on('error', (err) => {
                expect(err.type).toEqual('streaming-function-runtime-error');
                expect(err.cause.message).toEqual(`Cannot read property 'nope' of null`);
                errored = true;
            });
            destinationStream.on('end', () => {
                expect(errored).toBeTruthy('pipeline should have errored');
                expect(closed).toBeTruthy('pipeline should be closed');
                done();
            });
            fixedSource.pipe(streamingPipeline);
        })
    });

    describe('with an input that cannot be unmarshalled =>', () => {
        const userFunction = (inputStream, outputStream) => {
            inputStream.pipe(outputStream);
        };

        beforeEach(() => {
            streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {objectMode: true});
            fixedSource = newFixedSource([
                newStartSignal(newStartFrame(['text/plain'])),
                newInputSignal(newInputFrame(0, 'application/json', 'invalid-json'))
            ]);
        });

        it('ends the pipeline', (done) => {
            destinationStream.on('data', () => {
                done(new Error('should not receive any data'));
            });
            let errored = false;
            streamingPipeline.on('error', (err) => {
                expect(err.type).toEqual('error-input-invalid');
                expect(err.cause.message).toEqual('Unexpected token i in JSON at position 0');
                errored = true;
            });
            let destinationClosed = false;
            destinationStream.on('end', () => {
                destinationClosed = true;
            });
            streamingPipeline.on('finish', () => {
                expect(errored).toBeTruthy('pipeline should have errored');
                expect(destinationClosed).toBeTruthy('destination stream should have ended');
                done();
            });
            fixedSource.pipe(streamingPipeline);
        })
    });

    describe('with a function that fails when receiving data =>', () => {
        const userFunction = (inputStream, outputStream) => {
            inputStream.pipe(new SimpleTransform({objectMode: true}, () => {
                throw new Error('Function failed')
            })).pipe(outputStream);
        };

        beforeEach(() => {
            streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {objectMode: true});
            fixedSource = newFixedSource([
                newStartSignal(newStartFrame(['text/plain'])),
                newInputSignal(newInputFrame(0, 'application/json', '42'))
            ]);
        });

        it('ends the pipeline', (done) => {
            destinationStream.on('data', () => {
                done(new Error('should not receive any data'));
            });
            let errored = false;
            streamingPipeline.on('error', (err) => {
                expect(err.type).toEqual('error-input-invalid');
                expect(err.cause.message).toEqual('Function failed');
                errored = true;
            });
            let destinationClosed = false;
            destinationStream.on('end', () => {
                destinationClosed = true;
            });
            streamingPipeline.on('finish', () => {
                expect(errored).toBeTruthy('pipeline should have errored');
                expect(destinationClosed).toBeTruthy('destination stream should have ended');
                done();
            });
            fixedSource.pipe(streamingPipeline);
        })
    });

    describe('with a function producing outputs that cannot be marshalled =>', () => {
        const userFunction = (inputStream, outputStream) => {
            inputStream.pipe(new SimpleTransform({objectMode: true}, (x) => Symbol(x))).pipe(outputStream);
        };

        beforeEach(() => {
            streamingPipeline = new StreamingPipeline(userFunction, destinationStream, {objectMode: true});
            fixedSource = newFixedSource([
                newStartSignal(newStartFrame(['text/plain'])),
                newInputSignal(newInputFrame(0, 'application/json', '42'))
            ]);
        });

        it('ends the pipeline', (done) => {
            destinationStream.on('data', () => {
                done(new Error('should not receive any data'));
            });
            let errored = false;
            streamingPipeline.on('error', (err) => {
                expect(err.type).toEqual('error-output-invalid');
                expect(err.cause.message).toEqual('Cannot convert a Symbol value to a string');
                errored = true;
            });
            let destinationClosed = false;
            destinationStream.on('end', () => {
                destinationClosed = true;
            });
            streamingPipeline.on('finish', () => {
                expect(errored).toBeTruthy('pipeline should have errored');
                expect(destinationClosed).toBeTruthy('destination stream should have ended');
                done();
            });
            fixedSource.pipe(streamingPipeline);
        })
    });
});

class SimpleTransform extends Transform {
    constructor(options, fn) {
        super(options);
        this.fn = fn;
    }

    _transform(chunk, _, callback) {
        callback(null, this.fn(chunk));
    }
}
