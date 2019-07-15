const debug = require('debug')('node-invoker:functions');

module.exports = {
	nonStreamingFunction: (x) => {
		debug('Simple function invocation started');
		return x*x;
	},
	streamingFunction: (numbers /* Readable */, results /* Writable */) => {
		debug('Streaming function invocation started');
		let i = 0;
		let buffer = [];
		numbers.on('data', (number) => {
			debug('Streaming function input received: ' + number);
			buffer[i] = number * number;
			i = (i+1) % 3;
			if (buffer.length === 3) {
				const sum = buffer.reduce((acc, v) => acc + v)
				results.write(sum);
			}
		});
	},
	streamingMultiIoFunction: (numbers /* Readable */, letters /* Readable */, squares /* Writable */, repeated_letters /* Writable */) => {
		debug('Multi I/O streaming function invocation started');
		numbers.on('data', (number) => {
			debug('Streaming function input #1 received: ' + number);
			squares.write(number * number);
		});
		letters.on('data', (letter) => {
			debug('Streaming function input #2 received: ' + letter);
			repeated_letters.write(letter + '' + letter);
		});
	}
};
