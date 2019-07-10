#!/bin/bash
set -euxo pipefail

PROTO_FILE=./proto/riff-rpc.proto
OUTPUT_DIR=./codegen

grpc_tools_node_protoc \
	--js_out=import_style=commonjs,binary:${OUTPUT_DIR} \
	--grpc_out=${OUTPUT_DIR} \
	--plugin=protoc-gen-grpc=`which grpc_tools_node_protoc_plugin` \
	${PROTO_FILE}