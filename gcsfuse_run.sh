#!/usr/bin/env bash
set -eo pipefail

echo "BUILD_ID: ${BUILD_ID}"
echo "GCS_BUCKET_NAME: ${GCS_BUCKET_NAME}"

echo "Mounting GCS Fuse."
gcsfuse \
  --debug_gcs \
  --debug_fuse \
  --only-dir app/$BUILD_ID/.next/server \
  --implicit-dirs \
  --stat-cache-ttl 10s \
  --type-cache-ttl 10s \
  $GCS_BUCKET_NAME /app/.next/server

echo "Mounting completed."

# Start the application
node /app/server.js &

# Exit immediately when one of the background processes terminate.
wait -n
