#!/usr/bin/env bash
# Hexalyte encrypted PostgreSQL backup (production).
# - Uses docker compose exec (no public DB port required)
# - Encrypts with AES-256-CBC via openssl using key file (never logged)
# - Retains daily dumps; does not delete unrelated archives
#
# Install:
#   sudo bash scripts/install-db-backup.sh
#
# Manual run:
#   sudo bash scripts/backup-hexalyte-db.sh
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

umask 077
mkdir -p "${OUT_DIR}"
chmod 700 "${BACKUP_ROOT}" "${OUT_DIR}" 2>/dev/null || true

if [[ ! -f "${KEY_FILE}" ]]; then
  echo "ERROR: backup key missing at ${KEY_FILE}. Run install-db-backup.sh first."
  exit 1
fi

cd "${APP_DIR}"

# Custom format dump (compressed) via container — no password on CLI from host
docker compose exec -T postgres pg_dump -U hexalyte -d hexalyte -Fc -f /tmp/hexalyte-backup.dump
docker compose cp postgres:/tmp/hexalyte-backup.dump "${PLAIN}"
docker compose exec -T postgres rm -f /tmp/hexalyte-backup.dump

openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 \
  -in "${PLAIN}" \
  -out "${ENC}" \
  -pass "file:${KEY_FILE}"

# Remove plaintext immediately
shred -u "${PLAIN}" 2>/dev/null || rm -f "${PLAIN}"

{
  echo "created_at=${STAMP}"
  echo "host=$(hostname -f 2>/dev/null || hostname)"
  echo "format=pg_dump-Fc+openssl-aes-256-cbc-pbkdf2"
  echo "encrypted_file=$(basename "${ENC}")"
  echo "bytes=$(wc -c < "${ENC}" | tr -d ' ')"
  echo "sha256=$(sha256sum "${ENC}" | awk '{print $1}')"
} > "${META}"
chmod 600 "${ENC}" "${META}"

# Retention: encrypted dumps + meta only
find "${OUT_DIR}" -type f -name 'hexalyte-*.dump.enc' -mtime "+${RETENTION_DAYS}" -delete 2>/dev/null || true
find "${OUT_DIR}" -type f -name 'hexalyte-*.meta' -mtime "+${RETENTION_DAYS}" -delete 2>/dev/null || true

echo "Backup OK: ${ENC}"
echo "Meta: ${META}"
