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

    it('intercepts runtime errors and sends error events', (done) => {
        mappingTransform.on('data', () => {
            done(new Error('should not receive any data as the computation failed'));
        });
        mappingTransform.on('error', (err) => {
            expect(err.type).toEqual('request-reply-function-runtime-error');
            expect(err.cause.name).toEqual('TypeError');
            expect(err.cause.message).toEqual('x.foo is not a function');
            done();
        });
        mappingTransform.write({});
    });
});
