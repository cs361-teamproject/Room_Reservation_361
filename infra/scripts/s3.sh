# ensure_bucket: creates FN_ENV_S3_BUCKET if it does not exist and lets the frontend upload to it.
# sync_photos: copies the room photos the database points at into the LocalStack bucket.
# Sourced by deploy.sh and photos.sh.

ensure_bucket() {
  local bucket="${FN_ENV_S3_BUCKET:-}"
  [ -n "$bucket" ] || return 0
  if ! awsx s3api head-bucket --bucket "$bucket" >/dev/null 2>&1; then
    log "s3: create bucket $bucket"
    if [ "$REGION" = us-east-1 ]; then
      awsx s3api create-bucket --bucket "$bucket" >/dev/null
    else
      awsx s3api create-bucket --bucket "$bucket" \
        --create-bucket-configuration "LocationConstraint=$REGION" >/dev/null
    fi
  fi
  ensure_bucket_cors "$bucket"
}

# Room photos are POSTed by the browser straight to S3 (presigned POST), so the bucket must
# allow the frontend origins. Re-applied on every deploy so it follows FN_ENV_ALLOWED_ORIGINS.
ensure_bucket_cors() {
  local bucket="$1" origins
  origins="$(echo "${FN_ENV_ALLOWED_ORIGINS:-}" | jq -R 'split(",") | map(gsub("^\\s+|\\s+$"; "")) | map(select(length > 0))')"
  [ "$origins" != "[]" ] || return 0
  log "s3: CORS on $bucket for $origins"
  awsx s3api put-bucket-cors --bucket "$bucket" --cors-configuration "{
    \"CORSRules\": [{
      \"AllowedOrigins\": $origins,
      \"AllowedMethods\": [\"GET\", \"POST\"],
      \"AllowedHeaders\": [\"*\"],
      \"MaxAgeSeconds\": 3000
    }]
  }"
}

# Local only. Keys come from the RoomPhotos table, files from PHOTO_SOURCE_URL (the team's real bucket).
# Downloads are cached in dist/.deploy/photos, so only the first run needs the internet.
sync_photos() {
  local bucket="${FN_ENV_S3_BUCKET:-}" cache="$WORK_DIR/photos" keys key
  [ "$TARGET" = local ] && [ -n "$bucket" ] && [ -n "${PHOTO_SOURCE_URL:-}" ] || return 0

  keys="$(docker exec cs361_db psql -U postgres -d platform -Atc \
    'SELECT DISTINCT object_key FROM "RoomPhotos"' 2>/dev/null)" || {
    warn "photos: cannot read RoomPhotos (is the db up and migrated?), skipping"
    return 0
  }
  [ -n "$keys" ] || {
    warn "photos: RoomPhotos is empty (run npm run db:seed), skipping"
    return 0
  }

  mkdir -p "$cache"
  for key in $keys; do
    [ -s "$cache/$key" ] && continue
    curl -fsS -o "$cache/$key" "$PHOTO_SOURCE_URL/$key" || {
      rm -f "$cache/$key"
      warn "photos: could not download $key"
    }
  done

  log "s3: sync $(echo "$keys" | wc -l | tr -d ' ') photos to $bucket"
  awsx s3 sync "$cache" "s3://$bucket" --only-show-errors
}
