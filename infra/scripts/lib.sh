# Shared helpers. Source with: source "$(dirname "$0")/lib.sh" <local|aws>
# Works on bash 3.2 (macOS) - no associative arrays or mapfile.
set -euo pipefail

TARGET="${1:-}"
case "$TARGET" in
  local | aws) ;;
  *)
    echo "usage: $(basename "$0") <local|aws> [function ...]" >&2
    exit 1
    ;;
esac

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LAMBDA_DIR="$ROOT_DIR/backend-lambda"
MANIFEST="$LAMBDA_DIR/functions.json"
ENV_FILE="$ROOT_DIR/infra/env/$TARGET.env"
WORK_DIR="$LAMBDA_DIR/dist/.deploy"

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m %s\n' "$*" >&2; }
die() {
  printf '\033[1;31mxx\033[0m %s\n' "$*" >&2
  exit 1
}

for bin in aws jq zip; do
  command -v "$bin" >/dev/null || die "$bin is required"
done
[ -f "$ENV_FILE" ] || die "missing $ENV_FILE (copy it from $TARGET.env.example)"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

export AWS_PAGER=""
PREFIX="$(jq -r .prefix "$MANIFEST")"
API_NAME="$PREFIX-api"
mkdir -p "$WORK_DIR"

to_win_path() {
  local p="$1"
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -m "$p"
  else
    echo "$p" | sed -E 's|^/([a-zA-Z])/(.*)|\1:/\2|'
  fi
}

# aws CLI pointed at the current target
awsx() {
  if [ "$TARGET" = local ]; then
    env -u AWS_PROFILE AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test \
      aws --endpoint-url "$LOCALSTACK_ENDPOINT" --region "$REGION" "$@"
  else
    aws ${AWS_PROFILE:+--profile "$AWS_PROFILE"} --region "$REGION" "$@"
  fi
}

if [ "$TARGET" = local ]; then
  ACCOUNT_ID=000000000000
  curl -fsS "${LOCALSTACK_ENDPOINT}/_localstack/health" >/dev/null 2>&1 ||
    die "LocalStack is not reachable at $LOCALSTACK_ENDPOINT (run: docker compose up -d)"
else
  ACCOUNT_ID="$(awsx sts get-caller-identity --query Account --output text)" ||
    die "AWS credentials not working for profile '${AWS_PROFILE:-default}'"
fi

# Function names to act on: the arguments after the target, or every function in the manifest.
select_functions() {
  local all
  all="$(jq -r '.functions[].name' "$MANIFEST" | tr -d '\r')"
  if [ "$#" -eq 0 ]; then
    echo "$all"
    return
  fi
  local name
  for name in "$@"; do
    name="$(echo "$name" | tr -d '\r')"
    echo "$all" | grep -qx "$name" || die "unknown function '$name' (known: $(echo "$all" | tr '\n' ' '))"
    echo "$name"
  done
}

# Manifest value for a function, falling back to defaults: fn_config <name> <key>
fn_config() {
  jq -r --arg n "$1" --arg k "$2" \
    '(.defaults[$k]) as $d | (.functions[] | select(.name == $n) | .[$k]) // $d // empty' "$MANIFEST"
}

fn_routes() {
  jq -r --arg n "$1" '.functions[] | select(.name == $n) | .routes[]' "$MANIFEST"
}

fn_has_policy() {
  jq -e --arg n "$1" --arg p "$2" '.functions[] | select(.name == $n) | (.policies // []) | index($p) != null' \
    "$MANIFEST" >/dev/null
}

function_name() { echo "$PREFIX-$1"; }
role_name() { echo "$PREFIX-$1-role"; }

# FN_ENV_FOO=bar in the env file -> {"Variables":{"FOO":"bar", ...}}
lambda_environment_json() {
  env | grep '^FN_ENV_' | sed 's/^FN_ENV_//' |
    jq -R -s '
      split("\n") | map(select(length > 0) | capture("^(?<key>[^=]+)=(?<value>.*)$"))
      | from_entries + {NODE_OPTIONS: "--enable-source-maps"}
      | {Variables: .}'
}

api_base_url() {
  local api_id="$1"
  if [ "$TARGET" = local ]; then
    echo "http://$api_id.execute-api.localhost.localstack.cloud:4566/$STAGE_NAME"
  else
    echo "https://$api_id.execute-api.$REGION.amazonaws.com/$STAGE_NAME"
  fi
}

find_api_id() {
  local id
  id="$(awsx apigateway get-rest-apis --query "items[?name=='$API_NAME'].id | [0]" --output text)"
  [ "$id" = None ] && id=""
  echo "$id"
}
