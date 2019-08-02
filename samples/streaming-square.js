module.exports =
    (numbers /* Readable */, squares /* Writable */) => {
        console.log('Multi I/O streaming function invocation started');
        numbers.on('data', (number) => {
            console.log(`Input #0 received: ${number}`);
            squares.write(number * number);
        });
        numbers.on('end', () => {
            console.log(`Input #0 ended`);
            squares.end();
        });
    };
module.exports.$interactionModel = 'node-streams';
