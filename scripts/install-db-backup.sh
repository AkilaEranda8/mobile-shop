#!/usr/bin/env bash
# Install Hexalyte DB backup key, cron, and directories.
# Does NOT print the key material.
set -euo pipefail

APP_DIR="${HEXALYTE_APP_DIR:-/opt/hexalyte}"
BACKUP_ROOT="${HEXALYTE_BACKUP_ROOT:-/var/backups/hexalyte}"
KEY_FILE="${HEXALYTE_BACKUP_KEY:-/root/.hexalyte-backup.key}"
CRON_FILE="/etc/cron.d/hexalyte-db-backup"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root"
  exit 1
fi

umask 077
mkdir -p "${BACKUP_ROOT}/db" "${BACKUP_ROOT}/restore-test"
chmod 700 "${BACKUP_ROOT}" "${BACKUP_ROOT}/db" "${BACKUP_ROOT}/restore-test"

if [[ ! -f "${KEY_FILE}" ]]; then
  openssl rand -out "${KEY_FILE}" 32
  chmod 600 "${KEY_FILE}"
  echo "Created backup encryption key at ${KEY_FILE} (mode 600)."
else
  echo "Backup key already exists (left unchanged)."
fi

chmod +x "${APP_DIR}/scripts/backup-hexalyte-db.sh" "${APP_DIR}/scripts/restore-test-hexalyte-db.sh" 2>/dev/null || true

# Daily 02:15 local server time
cat > "${CRON_FILE}" <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
15 2 * * * root HEXALYTE_APP_DIR=${APP_DIR} ${APP_DIR}/scripts/backup-hexalyte-db.sh >> /var/log/hexalyte-db-backup.log 2>&1
EOF
chmod 644 "${CRON_FILE}"

touch /var/log/hexalyte-db-backup.log
chmod 600 /var/log/hexalyte-db-backup.log

echo "Installed cron: ${CRON_FILE}"
echo "Run first backup: bash ${APP_DIR}/scripts/backup-hexalyte-db.sh"
