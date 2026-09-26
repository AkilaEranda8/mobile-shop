#!/usr/bin/env bash
# Hexalyte encrypted PostgreSQL backup (production).
# - Uses docker compose exec (no public DB port required)
# - Encrypts with AES-256-CBC + PBKDF2 via openssl (format v1)
# - Never logs secrets; removes plaintext dump immediately
# - Exits non-zero on any failure (for cron / monitoring)
#
# Install:  sudo bash scripts/install-db-backup.sh
# Manual:   sudo bash scripts/backup-hexalyte-db.sh
set -euo pipefail

APP_DIR="${HEXALYTE_APP_DIR:-/opt/hexalyte}"
BACKUP_ROOT="${HEXALYTE_BACKUP_ROOT:-/var/backups/hexalyte}"
KEY_FILE="${HEXALYTE_BACKUP_KEY:-/root/.hexalyte-backup.key}"
RETENTION_DAYS="${HEXALYTE_BACKUP_RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="${BACKUP_ROOT}/db"
PLAIN="${OUT_DIR}/hexalyte-${STAMP}.dump"
ENC="${PLAIN}.enc"
META="${OUT_DIR}/hexalyte-${STAMP}.meta"
MIN_BYTES="${HEXALYTE_BACKUP_MIN_BYTES:-1024}"

umask 077
mkdir -p "${OUT_DIR}"
chmod 700 "${BACKUP_ROOT}" "${OUT_DIR}" 2>/dev/null || true

cleanup_plain() {
  if [[ -f "${PLAIN}" ]]; then
    shred -u "${PLAIN}" 2>/dev/null || rm -f "${PLAIN}"
  fi
}
trap cleanup_plain EXIT

log() { echo "[$(date -Is)] $*"; }

fail() {
  log "ERROR: $*"
  exit 1
}

[[ -f "${KEY_FILE}" ]] || fail "backup key missing at ${KEY_FILE}. Run install-db-backup.sh first."
[[ -r "${KEY_FILE}" ]] || fail "backup key not readable (check ownership/permissions)."
KEY_MODE="$(stat -c '%a' "${KEY_FILE}" 2>/dev/null || echo '?')"
[[ "${KEY_MODE}" == "600" || "${KEY_MODE}" == "400" ]] || log "WARN: key mode is ${KEY_MODE} (prefer 600)"

cd "${APP_DIR}" || fail "cannot cd ${APP_DIR}"

log "Starting encrypted backup stamp=${STAMP}"

docker compose exec -T postgres pg_dump -U hexalyte -d hexalyte -Fc -f /tmp/hexalyte-backup.dump \
  || fail "pg_dump failed"
docker compose cp postgres:/tmp/hexalyte-backup.dump "${PLAIN}" \
  || fail "docker compose cp dump failed"
docker compose exec -T postgres rm -f /tmp/hexalyte-backup.dump || true

[[ -f "${PLAIN}" ]] || fail "plaintext dump missing after copy"
PLAIN_BYTES="$(wc -c < "${PLAIN}" | tr -d ' ')"
[[ "${PLAIN_BYTES}" -ge "${MIN_BYTES}" ]] || fail "plaintext dump too small (${PLAIN_BYTES} bytes)"

# Format v1 — AES-256-CBC + PBKDF2 (keep recoverable; do not break old restores)
openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 \
  -in "${PLAIN}" \
  -out "${ENC}" \
  -pass "file:${KEY_FILE}" \
  || fail "openssl encrypt failed"

cleanup_plain
trap - EXIT

[[ -f "${ENC}" ]] || fail "encrypted output missing: ${ENC}"
ENC_BYTES="$(wc -c < "${ENC}" | tr -d ' ')"
[[ "${ENC_BYTES}" -ge "${MIN_BYTES}" ]] || fail "encrypted output too small (${ENC_BYTES} bytes)"

{
  echo "created_at=${STAMP}"
  echo "host=$(hostname -f 2>/dev/null || hostname)"
  echo "format_version=1"
  echo "format=pg_dump-Fc+openssl-aes-256-cbc-pbkdf2"
  echo "encrypted_file=$(basename "${ENC}")"
  echo "bytes=${ENC_BYTES}"
  echo "sha256=$(sha256sum "${ENC}" | awk '{print $1}')"
  echo "status=ok"
} > "${META}"
chmod 600 "${ENC}" "${META}"

find "${OUT_DIR}" -type f -name 'hexalyte-*.dump.enc' -mtime "+${RETENTION_DAYS}" -delete 2>/dev/null || true
find "${OUT_DIR}" -type f -name 'hexalyte-*.meta' -mtime "+${RETENTION_DAYS}" -delete 2>/dev/null || true

log "Backup OK path=${ENC} bytes=${ENC_BYTES}"
log "Meta path=${META}"
exit 0
