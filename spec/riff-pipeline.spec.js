const {PassThrough} = require('stream');
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
const RiffPipeline = require('../lib/riff-pipeline');

describe('riff pipeline =>', () => {

    const userFunction = (inputStream, outputStream) => {
        inputStream.pipe(newMappingTransform((arg) => arg + 42)).pipe(outputStream);
    };
    let destinationStream;
    let riffPipeline;
    let fixedSource;

    beforeEach(() => {
        destinationStream = new PassThrough({objectMode: true});
        riffPipeline = new RiffPipeline(userFunction, destinationStream, {objectMode: true});
    });

    afterEach(() => {
        fixedSource.destroy();
        riffPipeline.destroy();
        destinationStream.destroy();
    });

    describe('with valid inputs', () => {
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
            riffPipeline.on('error', (err) => {
                done(err);
            });
            let dataReceived = false;
            destinationStream.on('data', (chunk) => {
                if (dataReceived) {
                    done(new Error('data already received'));
                }
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
            fixedSource.pipe(riffPipeline);
        });
    });

    describe('with a closed input stream =>', () => {
        beforeEach(() => {
            fixedSource = newFixedSource([
                newStartSignal(newStartFrame([]))
            ]);
        });

        // when the source ends (such as internal this.push(null) call), the piped destination will have its 'end' method called
        // see https://nodejs.org/api/stream.html#stream_readable_pipe_destination_options
        it('will end input streams when the piped source ends', (done) => {
            const userFunction = (inputStream) => {
                inputStream.on('end', () => {
                    done();
                })
            };

            riffPipeline = new RiffPipeline(userFunction, destinationStream, {objectMode: true});
            fixedSource.pipe(riffPipeline);
            setTimeout(() => {
                fixedSource.end();
            }, 100);

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

            let allDataReceived = false;
            let receivedOutputSignalCount = 0;
            destinationStream.on('data', (outputSignal) => {
                if (receivedOutputSignalCount >= data.length) {
                    done(new Error(`expected to receive only ${data.length} element(s)`))
                }
                expect(outputSignal).toEqual(newOutputSignal(newOutputFrame(1, 'text/plain', data[receivedOutputSignalCount++])));
                if (receivedOutputSignalCount === data.length) {
                    allDataReceived = true;
                }
            });
            destinationStream.on('finish', () => {
                if (allDataReceived) {
                    done();
                } else {
                    done(new Error('the destination stream should end only when all data has been received'));
                }
            });
            riffPipeline = new RiffPipeline(userFunction, destinationStream, {objectMode: true});
            fixedSource.pipe(riffPipeline);
        })
    });

    describe('with badly-typed inputs =>', () => {
        beforeEach(() => {
            fixedSource = newFixedSource(["not a signal"]);
        });

        it('emits an error', (done) => {
            riffPipeline.on('error', (err) => {
                expect(err.type).toEqual('error-streaming-input-type-invalid');
                expect(err.cause).toEqual('invalid input type [object String]');
                done();
            });
            fixedSource.pipe(riffPipeline);
        });
    });

    describe('with a buggy input signal =>', () => {
        beforeEach(() => {
            fixedSource = newFixedSource([newInputSignal(null)]);
        });

        it('emits an error', (done) => {
            riffPipeline.on('error', (err) => {
                expect(err.type).toEqual('error-streaming-input-type-unsupported');
                expect(err.cause).toEqual('input is neither a start nor a data signal');
                done();
            });
            fixedSource.pipe(riffPipeline);
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
            riffPipeline.on('error', (err) => {
                expect(err.type).toEqual('error-streaming-too-many-starts');
                expect(err.cause).toEqual(
                    'start signal has already been received. ' +
                    'Rejecting new start signal with content types [application/x-doom]'
                );
                done();
            });
            fixedSource.pipe(riffPipeline);
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
            riffPipeline.on('error', (err) => {
                expect(err.type).toEqual('error-streaming-invalid-output-count');
                expect(err.cause).toEqual(
                    'invalid output count 3: function has only 2 parameter(s)'
                );
                done();
            });
            fixedSource.pipe(riffPipeline);
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
            riffPipeline.on('error', (err) => {
                expect(err.type).toEqual('error-streaming-missing-start');
                expect(err.cause).toEqual(
                    'start signal has not been received or processed yet. ' +
                    'Rejecting data signal'
                );
                done();
            });
            fixedSource.pipe(riffPipeline);
        })
    });
});
