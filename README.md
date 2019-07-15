# Node function invoker for riff

## Prereqs

### Proto generation

```shell
 $ npm install -g grpc-tools
 $ ./generate.sh
```

### Full streaming setup

1. Set up Kafka onto your K8s cluster.
1. Set up Liiklus.
1. Set up the Kafka Gateway by following these [instructions](https://github.com/projectriff/kafka-gateway).

## End-to-end run

1. Run the Liiklus producer and the consumer with this [project](https://github.com/projectriff-samples/liiklus-client).
1. Run this invoker: `yarn start`
1. Run the [processor](https://github.com/projectriff/streaming-processor) with the appropriate parameters.
1. Start sending data via the Liiklus producer.

## Invoker debug run

Execute the following:

```shell
 $ DEBUG='node-invoker:*' yarn start
```