#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

ENVIRONMENT="${ENVIRONMENT:-dev}"
DIST="${DIST:-dist/frontend}"
FUNCTION_NAME="coolture-$ENVIRONMENT-ssr"
BUCKET="coolture-$ENVIRONMENT-static-assets"
: "${DISTRIBUTION_ID:?DISTRIBUTION_ID must be set}"

package="$(mktemp -d)/ssr.zip"
printf '#!/bin/bash\nexec node "${LAMBDA_TASK_ROOT}/server/server.mjs"\n' > "$DIST/run.sh"
chmod 755 "$DIST/run.sh"
(cd "$DIST" && zip -qr "$package" run.sh server browser)

echo "==> Uploading static assets to s3://$BUCKET"
aws s3 sync "$DIST/browser" "s3://$BUCKET" --exclude '*' \
    --include '*.js' --include '*.css' --include 'media/*' \
    --cache-control 'public,max-age=31536000,immutable'
aws s3 sync "$DIST/browser" "s3://$BUCKET" --exclude '*' \
    --include 'i18n/*' --include 'favicon.ico' \
    --cache-control 'public,max-age=300'

echo "==> Updating Lambda $FUNCTION_NAME"
aws lambda update-function-code --function-name "$FUNCTION_NAME" \
    --zip-file "fileb://$package" --query LastUpdateStatus --output text
aws lambda wait function-updated-v2 --function-name "$FUNCTION_NAME"

echo "==> Invalidating CloudFront $DISTRIBUTION_ID"
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths '/*' \
    --query Invalidation.Id --output text
