#!/bin/bash
set -euxo pipefail

# Set env vars
export DOCKER_BUILDKIT=1
export PROJECT_ID=nextjs-on-cloud
export BUILD_ID=468ad1f7-2491-45b5-9ce4-cb10f3c7bd99
export GCS_BUCKET_NAME=nextjs-on-cloud

# Run docker build commands
docker build \
--platform linux/amd64 \
--target runner \
--build-arg="BUILD_ID=$BUILD_ID" \
--build-arg="GCS_BUCKET_NAME=$GCS_BUCKET_NAME" \
-t "us-central1-docker.pkg.dev/$PROJECT_ID/run/nextjs-on-gcp" \
.
