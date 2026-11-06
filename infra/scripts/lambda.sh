# ensure_function <function> <role-arn>: create or update one Lambda. Sourced by deploy.sh.
# HOT_RELOAD=1 (local only) mounts backend-lambda/dist/<function> instead of uploading a zip.

package_function() {
  local fn="$1"
  # Use PowerShell Compress-Archive (native Windows zip) so aws.exe gets a valid zip file.
  # Convert POSIX paths to Windows paths for PowerShell.
  local win_src win_zip
  win_src="$(echo "$LAMBDA_DIR/dist/$fn" | sed -E 's|^/([a-zA-Z])/|\1:/|')"
  win_zip="$(echo "$WORK_DIR/$fn.zip" | sed -E 's|^/([a-zA-Z])/|\1:/|')"
  rm -f "$WORK_DIR/$fn.zip"
  powershell.exe -NoProfile -Command "Compress-Archive -Path '${win_src}/*' -DestinationPath '${win_zip}' -Force"
  echo "$win_zip"
}

# Prints the --code / --zip-file style args for create (mode=create) or update (mode=update)
code_args() {
  local fn="$1" mode="$2"
  if [ "${HOT_RELOAD:-0}" = 1 ]; then
    [ "$TARGET" = local ] || die "HOT_RELOAD only works with the local target"
    local dir="$LAMBDA_DIR/dist/$fn"
    if [ "$mode" = create ]; then
      echo "--code S3Bucket=hot-reload,S3Key=$dir"
    else
      echo "--s3-bucket hot-reload --s3-key $dir"
    fi
  else
    echo "--zip-file fileb://$(package_function "$fn")"
  fi
}

vpc_args() {
  if [ -n "${VPC_SUBNET_IDS:-}" ]; then
    echo "--vpc-config SubnetIds=$VPC_SUBNET_IDS,SecurityGroupIds=$VPC_SECURITY_GROUP_IDS"
  fi
}

ensure_function() {
  local fn="$1" role_arn="$2" name runtime memory timeout environment
  name="$(function_name "$fn")"
  runtime="$(fn_config "$fn" runtime)"
  memory="$(fn_config "$fn" memory)"
  timeout="$(fn_config "$fn" timeout)"
  environment="$(lambda_environment_json)"

  # Word splitting of code_args/vpc_args is intended (paths contain no spaces by convention)
  # shellcheck disable=SC2046
  if ! awsx lambda get-function --function-name "$name" >/dev/null 2>&1; then
    log "lambda: create $name ($runtime, ${memory}MB, ${timeout}s)"
    local attempt
    for attempt in 1 2 3 4 5 6; do
      # A freshly created IAM role takes a few seconds before Lambda can assume it
      if awsx lambda create-function --function-name "$name" \
        --runtime "$runtime" --handler index.handler --role "$role_arn" \
        --memory-size "$memory" --timeout "$timeout" \
        --environment "$environment" \
        $(vpc_args) $(code_args "$fn" create) >/dev/null; then
        break
      fi
      [ "$attempt" = 6 ] && die "could not create $name"
      warn "create failed (attempt $attempt), retrying in 5s"
      sleep 5
    done
    awsx lambda wait function-active-v2 --function-name "$name"
  else
    log "lambda: update $name"
    awsx lambda update-function-configuration --function-name "$name" \
      --runtime "$runtime" --handler index.handler --role "$role_arn" \
      --memory-size "$memory" --timeout "$timeout" \
      --environment "$environment" \
      $(vpc_args) >/dev/null
    awsx lambda wait function-updated-v2 --function-name "$name"
    awsx lambda update-function-code --function-name "$name" $(code_args "$fn" update) >/dev/null
    awsx lambda wait function-updated-v2 --function-name "$name"
  fi
}
