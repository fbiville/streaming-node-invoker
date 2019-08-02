const {newFixedSource, newMappingTransform} = require('./helpers/factories');
const promoteFunction = require('../lib/function-promoter');
const {PassThrough} = require('stream');

describe('function promoter =>', () => {
    const data = [1, 2, 4];
    const userFunction = (x) => x ** 2;
    const streamingUserFunction = (input, output) => input.pipe(newMappingTransform(userFunction)).pipe(output);
    streamingUserFunction.$interactionModel = 'node-streams';
    let streamingOutput;
    const expectedResults = data.map(userFunction);
    let source;

    beforeEach(() => {
        source = newFixedSource(data);
        streamingOutput = new PassThrough({objectMode: true});
    });

    afterEach(() => {
        source.destroy();
        streamingOutput.destroy();
    });

    it('promotes request-reply functions to streaming', (done) => {
        let index = 0;
        streamingOutput.on('data', (chunk) => {
            if (index === expectedResults.length) {
                done(new Error(`expected only ${expectedResults.length} element(s)`));
                return
            }
            expect(chunk).toEqual(expectedResults[index++])
        });
        streamingOutput.on('end', () => {
            done()
        });

        const result = promoteFunction(userFunction);
        result(source, streamingOutput);
    });

    it('returns streaming functions as-is', (done) => {
        let index = 0;
        streamingOutput.on('data', (chunk) => {
            if (index === expectedResults.length) {
                done(new Error(`expected only ${expectedResults.length} element(s)`));
                return
            }
            expect(chunk).toEqual(expectedResults[index++])
        });
        streamingOutput.on('end', () => {
            done()
        });

        const result = promoteFunction(streamingUserFunction);
        result(source, streamingOutput);
    });

    it('rejects invalid request-reply functions', () => {
        try {
            promoteFunction((x, y) => x + y);
            fail('should fail')
        } catch (err) {
            expect(err.type).toEqual('error-promoting-function');
            expect(err.cause).toEqual('Request-reply function must have exactly 1 argument, 2 found')
        }
    });
});
