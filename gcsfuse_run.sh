#!/usr/bin/env bash
set -eo pipefail

# Create mount directory for service
mkdir -p $GCS_MNT_DIR

echo "Mounting GCS Fuse."
gcsfuse \
  --debug_gcs \
  --debug_fuse \
  --only-dir $GCS_BUCKET_DIR \
  --stat-cache-ttl 10s \
  --type-cache-ttl 10s \
  $GCS_BUCKET_NAME $GCS_MNT_DIR
echo "Mounting completed."

# Start the application
node server.js &

# Exit immediately when one of the background processes terminate.
wait -n
