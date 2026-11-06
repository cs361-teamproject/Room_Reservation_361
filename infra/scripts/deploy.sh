#!/usr/bin/env bash
# Build and deploy Lambda functions + API Gateway from backend-lambda/functions.json.
#   ./deploy.sh local                  everything to LocalStack
#   ./deploy.sh aws facilities health  only these functions to AWS
#   HOT_RELOAD=1 ./deploy.sh local     LocalStack runs code straight from dist/ (pair with: npm run build -- --watch)
# Safe to re-run: existing resources are updated, not duplicated.
DIR="$(cd "$(dirname "$0")" && pwd)"
source "$DIR/lib.sh" "$@"
shift
source "$DIR/iam.sh"
source "$DIR/s3.sh"
source "$DIR/lambda.sh"
source "$DIR/apigw.sh"

FUNCTIONS="$(select_functions "$@" | tr -d '\r')"

log "target=$TARGET account=$ACCOUNT_ID region=$REGION functions: $(echo "$FUNCTIONS" | tr '\n' ' ')"

# shellcheck disable=SC2086
(cd "$LAMBDA_DIR" && node build.mjs $FUNCTIONS)

ensure_bucket
sync_photos

for fn in $FUNCTIONS; do
  role_arn="$(ensure_role "$fn")"
  ensure_function "$fn" "$role_arn"
done

ensure_api
for fn in $FUNCTIONS; do
  ensure_routes "$fn"
done
deploy_stage

BASE_URL="$(api_base_url "$API_ID")"
echo
log "API: $BASE_URL"
log "try: curl $BASE_URL/api/health"
