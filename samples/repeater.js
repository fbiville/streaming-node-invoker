module.exports =
    (numbers /* Readable */, letters /* Readable */, squares /* Writable */, repeated_letters /* Writable */) => {
        console.log('Multi I/O streaming function invocation started');
        numbers.on('data', (number) => {
            console.log(`Input #0 received: ${number}`);
            squares.write(number * number);
        });
        numbers.on('end', () => {
            console.log(`Input #0 ended`);
            squares.end();
        });
        letters.on('data', (letter) => {
            console.log(`Input #1 received: ${letter}`);
            repeated_letters.write(`${letter}${letter}`);
        });
        letters.on('end', () => {
            console.log(`Input #1 ended`);
            repeated_letters.end();
        });
    };
module.exports.$interactionModel = 'node-streams';
