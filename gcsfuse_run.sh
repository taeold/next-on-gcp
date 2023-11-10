#!/usr/bin/env bash
set -eo pipefail

echo "BUILD_ID: ${BUILD_ID}"
echo "GCS_BUCKET_NAME: ${GCS_BUCKET_NAME}"

echo "Mounting GCS Fuse."
gcsfuse \
  --debug_gcs \
  --debug_fuse \
  --only-dir app/$BUILD_ID/.next \
  --implicit-dirs \
  --stat-cache-ttl 1s \
  --type-cache-ttl 1s \
  $GCS_BUCKET_NAME /app/.next

echo "Mounting completed."

# Start the application
node /app/server.js &

# Exit immediately when one of the background processes terminate.
wait -n
