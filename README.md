# Node function invoker for riff

## Purpose

The node function invoker provides a host for functions consisting of a single NodeJS module.
It adheres to [riff streaming protocol](https://github.com/projectriff/streaming-processor) 
and invokes functions accordinly.

## Supported functions

### Non-streaming functions

Non-streaming functions, more specifically "request-reply" functions, such as:
```
module.exports = (x) => x**2;
```
will be automatically promoted to streaming functions via the equivalent of the `map` operator.

Note that the interaction model can be explicitly advertised, albeit this is not necessary:
```
module.exports = (x) => x**2;
module.exports.$interactionModel = 'request-reply';
```

### Streaming functions

Streaming functions must comply to the following signature:
```
module.exports = (inputStream1, inputStream2, ..., inputStreamN, outputStream1, ..., outputStreamM) {
    // do something
}
module.exports.$interactionModel = 'node-streams';
```

Input streams are [Readable streams](https://nodejs.org/api/stream.html#stream_readable_streams).
Output streams are [Writable streams](https://nodejs.org/api/stream.html#stream_class_stream_readable).

The function **must** close the output streams when it is done emitting data 
(if the output streams are [`pipe`](https://nodejs.org/api/stream.html#stream_readable_pipe_destination_options)'d from input streams, then this is automatically managed).

## Development

### Prereqs

 - [Node](https://nodejs.org/en/download/) version required: 10+.
 - Make sure to install the [EditorConfig](https://editorconfig.org/) plugin in your editing environment.
 
#### Build

 - Install dependencies by running `yarn` or `yarn install`
 - Generate the Protobuf client and server with `yarn generate-proto`
 - Run the tests with `yarn test`

#### Full streaming setup

1. Set up Kafka onto your K8s cluster (`kubectl apply` the file `kafka-broker.yaml` included in the [streaming processor project](https://github.com/projectriff/streaming-processor)).
1. Set up Liiklus (`kubectl apply` the file `liiklus.yaml` included in the [streaming processor project](https://github.com/projectriff/streaming-processor)).
1. Set up the Kafka Gateway by following these [instructions](https://github.com/projectriff/kafka-gateway).

### End-to-end run

1. Run Liiklus producers and consumers with this [project](https://github.com/projectriff-samples/liiklus-client).
1. Run this invoker: `FUNCTION_URI='./samples/repeater' yarn start`
1. Run the [processor](https://github.com/projectriff/streaming-processor) with the appropriate parameters.
1. Start sending data via the Liiklus producers.

### Invoker debug run

Execute the following:

```shell
 $ FUNCTION_URI='./samples/repeater' NODE_DEBUG='riff' yarn start
```

