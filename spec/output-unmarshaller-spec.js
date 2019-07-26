const {newFixedSource, newOutputFrame, newOutputSignal} = require('./helpers/factories');
const OutputMarshaller = require('../lib/output-marshaller');

describe('output marshaller =>', () => {
    let marshaller;
    let outputPayloadSource;
    const outputPayloads = [42, "forty-two"];
    const expectedResults = [42, '"forty-two"'];
    const expectedIndex = 0;
    const expectedContentType = 'application/json';
    const expectedPayloadCount = expectedResults.length;

    beforeEach(() => {
        marshaller = new OutputMarshaller(expectedIndex, expectedContentType, {objectMode: true});
        outputPayloadSource = newFixedSource(outputPayloads);
    });

    afterEach(() => {
        outputPayloadSource.destroy();
        marshaller.destroy();
    });

    it('marshalls the given outputs', (done) => {
        let index = 0;
        marshaller.on('data', (chunk) => {
            if (index === outputPayloads.length) {
                done(new Error(`should not consume more than ${expectedPayloadCount} elements, about to consume ${index}th one`));
            }
            const expectedFrame = newOutputFrame(expectedIndex, expectedContentType, expectedResults[index++]);
            const expectedSignal = newOutputSignal(expectedFrame);
            expect(chunk).toEqual(expectedSignal);
        });
        marshaller.on('end', () => {
            done();
        });

        outputPayloadSource.pipe(marshaller);
    });
});
