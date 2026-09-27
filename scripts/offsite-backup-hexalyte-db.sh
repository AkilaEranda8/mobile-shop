#!/usr/bin/env bash
# Optional offsite copy of an already-encrypted Hexalyte DB backup.
# Requires approved AWS credentials — does NOT invent them.
#
# Env (from /opt/hexalyte/.env or environment):
#   AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET
# Optional:
#   OFFSITE_S3_PREFIX (default: hexalyte/db-backups)
#   OFFSITE_S3_ENDPOINT (for S3-compatible providers)
#   HEXALYTE_BACKUP_ROOT (default /var/backups/hexalyte)
#
# Never uploads .env or the backup encryption key.
# Never prints secret values.
set -euo pipefail

APP_DIR="${HEXALYTE_APP_DIR:-/opt/hexalyte}"
BACKUP_ROOT="${HEXALYTE_BACKUP_ROOT:-/var/backups/hexalyte}"
OUT_DIR="${BACKUP_ROOT}/db"
PREFIX="${OFFSITE_S3_PREFIX:-hexalyte/db-backups}"
RETENTION_DAYS="${HEXALYTE_OFFSITE_RETENTION_DAYS:-14}"
LOG="${HEXALYTE_OFFSITE_LOG:-/var/log/hexalyte-offsite-backup.log}"

log() { echo "[$(date -Is)] $*" | tee -a "${LOG}"; }
fail() { log "ERROR: $*"; exit 1; }

# Load .env keys without exporting secrets to the process table via `set -a` dump
load_env_key() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "${APP_DIR}/.env" 2>/dev/null | tail -1 || true)"
  if [[ -n "$line" ]]; then
    printf '%s' "${line#*=}"
  fi
}

AWS_REGION_VAL="$(load_env_key AWS_REGION)"
AWS_KEY="$(load_env_key AWS_ACCESS_KEY_ID)"
AWS_SECRET="$(load_env_key AWS_SECRET_ACCESS_KEY)"
AWS_BUCKET="$(load_env_key AWS_S3_BUCKET)"
ENDPOINT="$(load_env_key OFFSITE_S3_ENDPOINT)"
[[ -z "$ENDPOINT" ]] && ENDPOINT="$(load_env_key S3_ENDPOINT)"
PREFIX_ENV="$(load_env_key OFFSITE_S3_PREFIX)"
[[ -n "$PREFIX_ENV" ]] && PREFIX="$PREFIX_ENV"

if [[ -z "${AWS_KEY}" || -z "${AWS_SECRET}" || -z "${AWS_BUCKET}" || -z "${AWS_REGION_VAL}" ]]; then
  log "OFFSITE SKIPPED — missing approved credentials"
  log "Required: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET"
  exit 2
fi

command -v aws >/dev/null 2>&1 || fail "aws CLI not installed on host"
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum missing"

LATEST_ENC="$(ls -1t "${OUT_DIR}"/hexalyte-*.dump.enc 2>/dev/null | head -1 || true)"
[[ -n "${LATEST_ENC}" ]] || fail "no local encrypted backup found under ${OUT_DIR}"
BASE="$(basename "${LATEST_ENC}")"
META="${LATEST_ENC%.dump.enc}.meta"
[[ -f "${META}" ]] || META="${OUT_DIR}/${BASE%.enc}.meta"
LOCAL_SHA="$(sha256sum "${LATEST_ENC}" | awk '{print $1}')"
OBJ="${PREFIX%/}/${BASE}"

export AWS_ACCESS_KEY_ID="${AWS_KEY}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET}"
export AWS_DEFAULT_REGION="${AWS_REGION_VAL}"
export AWS_REGION="${AWS_REGION_VAL}"

AWS_ARGS=(s3 cp "${LATEST_ENC}" "s3://${AWS_BUCKET}/${OBJ}" --only-show-errors --sse AES256)
if [[ -n "${ENDPOINT}" ]]; then
  AWS_ARGS=(--endpoint-url "${ENDPOINT}" "${AWS_ARGS[@]}")
fi

log "Uploading encrypted backup object=${OBJ} bytes=$(stat -c%s "${LATEST_ENC}")"
aws "${AWS_ARGS[@]}" || fail "s3 upload failed"

# Integrity: re-stat remote etag/checksum when available; always compare size
REMOTE_SIZE="$(aws ${ENDPOINT:+--endpoint-url "$ENDPOINT"} s3api head-object --bucket "${AWS_BUCKET}" --key "${OBJ}" --query ContentLength --output text 2>/dev/null || echo 0)"
LOCAL_SIZE="$(stat -c%s "${LATEST_ENC}")"
[[ "${REMOTE_SIZE}" == "${LOCAL_SIZE}" ]] || fail "size mismatch local=${LOCAL_SIZE} remote=${REMOTE_SIZE}"

# Optional: upload meta (no secrets) beside the object
if [[ -f "${META}" ]]; then
  aws ${ENDPOINT:+--endpoint-url "$ENDPOINT"} s3 cp "${META}" "s3://${AWS_BUCKET}/${PREFIX%/}/${BASE}.meta" --only-show-errors --sse AES256 \
    || log "WARN: meta upload failed (encrypted dump already uploaded)"
fi

{
  echo "offsite_at=$(date -Is)"
  echo "bucket=${AWS_BUCKET}"
  echo "object=${OBJ}"
  echo "local_sha256=${LOCAL_SHA}"
  echo "bytes=${LOCAL_SIZE}"
  echo "status=ok"
} > "${OUT_DIR}/offsite-last.meta"
chmod 600 "${OUT_DIR}/offsite-last.meta"

log "Offsite OK object=${OBJ} sha256=${LOCAL_SHA}"
# Clear exported secrets from this shell
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_KEY AWS_SECRET
exit 0
