const debug = require('debug')('node-invoker:repeater-sample');

module.exports =
	(numbers /* Readable */, letters /* Readable */, squares /* Writable */, repeated_letters /* Writable */) => {
		debug('Multi I/O streaming function invocation started');
		numbers.on('data', (number) => {
			debug(`Input #0 received: ${number}`);
			squares.write(number * number);
		});
		letters.on('data', (letter) => {
			debug(`Input #1 received: ${letter}`);
			repeated_letters.write(`${letter}${letter}`);
		});
	};
