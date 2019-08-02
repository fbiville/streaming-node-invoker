const logger = require('util').debuglog('riff');
const MappingTransform = require('./mapping-transform');
const RiffError = require('./riff-error');


module.exports = (userFunction) => {
    const interactionModel = userFunction['$interactionModel'] || 'request-reply';
    if (interactionModel !== 'request-reply') {
        return userFunction;
    }

    if (userFunction.length !== 1) {
        throw new RiffError('error-promoting-function', `Request-reply function must have exactly 1 argument, ${userFunction.length} found`)
    }

    logger('Promoting request-reply function to streaming function');
    const mapper = new MappingTransform(userFunction, {objectMode: true});
    return (input, output) => {
        input.pipe(mapper).pipe(output);
    }
};
