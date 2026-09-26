#!/usr/bin/env bash
# Safe restore TEST — restores latest encrypted dump into a TEMP database only.
# Never overwrites production DB "hexalyte".
set -euo pipefail

APP_DIR="${HEXALYTE_APP_DIR:-/opt/hexalyte}"
BACKUP_ROOT="${HEXALYTE_BACKUP_ROOT:-/var/backups/hexalyte}"
KEY_FILE="${HEXALYTE_BACKUP_KEY:-/root/.hexalyte-backup.key}"
TEST_DB="${HEXALYTE_RESTORE_TEST_DB:-hexalyte_restore_test}"
OUT_DIR="${BACKUP_ROOT}/db"

umask 077
cd "${APP_DIR}"

ENC="$(ls -1t "${OUT_DIR}"/hexalyte-*.dump.enc 2>/dev/null | head -1 || true)"
if [[ -z "${ENC}" ]]; then
  echo "ERROR: no encrypted backups found in ${OUT_DIR}"
  exit 1
fi
if [[ ! -f "${KEY_FILE}" ]]; then
  echo "ERROR: missing key ${KEY_FILE}"
  exit 1
fi

TMP_DIR="$(mktemp -d /tmp/hx-restore-XXXXXX)"
PLAIN="${TMP_DIR}/restore.dump"
trap 'rm -rf "${TMP_DIR}"' EXIT

openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in "${ENC}" \
  -out "${PLAIN}" \
  -pass "file:${KEY_FILE}"

# Drop/create TEMP db only
docker compose exec -T postgres psql -U hexalyte -d postgres -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${TEST_DB}' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS ${TEST_DB};
CREATE DATABASE ${TEST_DB} OWNER hexalyte;
SQL

docker compose cp "${PLAIN}" postgres:/tmp/hexalyte-restore.dump
docker compose exec -T postgres pg_restore -U hexalyte -d "${TEST_DB}" --clean --if-exists /tmp/hexalyte-restore.dump
docker compose exec -T postgres rm -f /tmp/hexalyte-restore.dump

# Sanity counts (no row data dumped)
TENANTS="$(docker compose exec -T postgres psql -U hexalyte -d "${TEST_DB}" -tAc 'SELECT COUNT(*) FROM "Tenant";')"
PRODUCTS="$(docker compose exec -T postgres psql -U hexalyte -d "${TEST_DB}" -tAc 'SELECT COUNT(*) FROM "Product";')"

# Cleanup temp DB after successful verify (keeps disk free)
docker compose exec -T postgres psql -U hexalyte -d postgres -v ON_ERROR_STOP=1 <<SQL
DROP DATABASE IF EXISTS ${TEST_DB};
SQL

echo "Restore test OK"
echo "source_backup=$(basename "${ENC}")"
echo "temp_db=${TEST_DB} (dropped after verify)"
echo "tenant_count=${TENANTS}"
echo "product_count=${PRODUCTS}"
