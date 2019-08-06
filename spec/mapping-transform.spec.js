const MappingTransform = require('../lib/mapping-transform');

describe('MappingTransform', () => {

    let mappingTransform;

    beforeEach(() => {
        mappingTransform = new MappingTransform((x) => x.foo(), {objectMode: true});
    });

    afterEach(() => {
        mappingTransform.destroy();
    });

    it('promotes non-streaming functions by mapping them', (done) => {
        mappingTransform.on('data', (chunk) => {
            expect(chunk).toEqual(42);
            done();
        });
        mappingTransform.write({foo: () => 42});
    });
});
