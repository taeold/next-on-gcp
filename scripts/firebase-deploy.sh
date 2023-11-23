#!/bin/bash
set -eux pipefail

mkdir public/_next
mv .next/static public/_next
firebase deploy --project $PROJECT_ID --only hosting
