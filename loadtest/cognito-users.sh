#!/usr/bin/env bash
# Cognito side of the load-test accounts. The DB side is the migrate Lambda ({"loadtestUsers": true}).
# Usernames must match LOADTEST_USERS in backend-lambda/src/shared/db/loadtest-users.ts.
#
#   LOADTEST_PASSWORD='...' ./loadtest/cognito-users.sh create   # users (idempotent)
#   ./loadtest/cognito-users.sh client-create                    # separate app client with USER_PASSWORD_AUTH
#   ./loadtest/cognito-users.sh list
#   ./loadtest/cognito-users.sh delete                           # users
#   ./loadtest/cognito-users.sh client-delete                    # the load-test app client
#
# The real site's app client is never touched: update-user-pool-client resets every field you leave out.
set -euo pipefail

REGION=${COGNITO_REGION:-ap-southeast-1}
POOL=${COGNITO_USER_POOL_ID:-ap-southeast-1_cKRx21D0U}
CLIENT_NAME=roomres-loadtest

# username|display name   (emails use example.com, a domain reserved for tests, so no real inbox exists)
USERS=(
  "6709900001|Bravery Jane"
  "6709900002|Peter Griffin"
  "claude.sandisk|Claude Sandisk"
  "paul.smith|Paul Smith"
  "6709900003|Lara Croft"
  "6709900004|Lemon James"
  "6709900005|Harry Toddler"
  "6709900006|Steve Bob"
  "mick.ankinson|Mick Ankinson"
  "amazon.webservice|Amazon Webservice"
)

cog() { aws cognito-idp --region "$REGION" "$@"; }

case "${1:-}" in
  create)
    : "${LOADTEST_PASSWORD:?set LOADTEST_PASSWORD (8+ chars, upper, lower, number, symbol)}"
    for entry in "${USERS[@]}"; do
      user=${entry%%|*}; name=${entry#*|}
      if cog admin-get-user --user-pool-id "$POOL" --username "$user" >/dev/null 2>&1; then
        echo "exists   $user"
      else
        cog admin-create-user --user-pool-id "$POOL" --username "$user" --message-action SUPPRESS \
          --user-attributes Name=email,Value="loadtest+$user@example.com" Name=email_verified,Value=true Name=name,Value="$name" >/dev/null
        echo "created  $user ($name)"
      fi
      cog admin-set-user-password --user-pool-id "$POOL" --username "$user" --password "$LOADTEST_PASSWORD" --permanent
    done
    ;;
  delete)
    for entry in "${USERS[@]}"; do
      user=${entry%%|*}
      cog admin-delete-user --user-pool-id "$POOL" --username "$user" 2>/dev/null && echo "deleted  $user" || echo "missing  $user"
    done
    ;;
  list)
    for entry in "${USERS[@]}"; do
      user=${entry%%|*}
      cog admin-get-user --user-pool-id "$POOL" --username "$user" --query '[Username,UserStatus,Enabled]' --output text 2>/dev/null || echo "$user  (missing)"
    done
    ;;
  client-create)
    existing=$(cog list-user-pool-clients --user-pool-id "$POOL" --query "UserPoolClients[?ClientName=='$CLIENT_NAME'].ClientId" --output text)
    if [ -n "$existing" ]; then echo "COGNITO_CLIENT_ID=$existing  (already exists)"; exit 0; fi
    id=$(cog create-user-pool-client --user-pool-id "$POOL" --client-name "$CLIENT_NAME" --no-generate-secret \
      --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH --query 'UserPoolClient.ClientId' --output text)
    echo "COGNITO_CLIENT_ID=$id"
    ;;
  client-delete)
    for id in $(cog list-user-pool-clients --user-pool-id "$POOL" --query "UserPoolClients[?ClientName=='$CLIENT_NAME'].ClientId" --output text); do
      cog delete-user-pool-client --user-pool-id "$POOL" --client-id "$id" && echo "deleted client $id"
    done
    ;;
  *)
    sed -n '2,10p' "$0"; exit 1 ;;
esac
