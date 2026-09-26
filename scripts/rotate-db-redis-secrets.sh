#!/usr/bin/env bash
# Rotate POSTGRES_PASSWORD + REDIS_PASSWORD in place without printing secrets.
# JWT_SECRET / KC_CLIENT_SECRET are NOT rotated here (session / IdP impact).
#
# Requires maintenance awareness: brief Redis reconnect; Postgres ALTER USER.
# Creates timestamped .env.bak under /root/hexalyte-secret-backups/ (mode 600).
set -euo pipefail

APP_DIR="${HEXALYTE_APP_DIR:-/opt/hexalyte}"
ENV_FILE="${APP_DIR}/.env"
BAK_DIR="/root/hexalyte-secret-backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
export HEXALYTE_ENV_FILE="${ENV_FILE}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root"
  exit 1
fi
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}"
  exit 1
fi

umask 077
mkdir -p "${BAK_DIR}"
chmod 700 "${BAK_DIR}"
cp -a "${ENV_FILE}" "${BAK_DIR}/env-${STAMP}.bak"
chmod 600 "${BAK_DIR}/env-${STAMP}.bak"
echo "Backed up .env to ${BAK_DIR}/env-${STAMP}.bak (contents not printed)."

NEW_PG="$(openssl rand -base64 32 | tr -d '\n' | tr '/+' 'Aa')"
NEW_REDIS="$(openssl rand -base64 32 | tr -d '\n' | tr '/+' 'Aa')"

cd "${APP_DIR}"

# Update Postgres role password inside DB (dollar-quoting — no shell echo of secret in psql -c argv via file)
PGSQL="${BAK_DIR}/pg-alter-${STAMP}.sql"
umask 077
printf "ALTER USER hexalyte WITH PASSWORD '%s';\n" "${NEW_PG}" > "${PGSQL}"
chmod 600 "${PGSQL}"
docker compose exec -T postgres psql -U hexalyte -d postgres -v ON_ERROR_STOP=1 -f - < "${PGSQL}"
shred -u "${PGSQL}" 2>/dev/null || rm -f "${PGSQL}"

# Patch .env with Python (no secret print)
export HEX_NEW_PG="${NEW_PG}"
export HEX_NEW_REDIS="${NEW_REDIS}"
python3 - <<'PY'
import os, re
path = os.environ["HEXALYTE_ENV_FILE"]
new_pg = os.environ["HEX_NEW_PG"]
new_redis = os.environ["HEX_NEW_REDIS"]
text = open(path, "r", encoding="utf-8").read()

def set_key(t, key, val):
    pat = re.compile(rf"^{re.escape(key)}=.*$", re.M)
    line = f"{key}={val}"
    if pat.search(t):
        return pat.sub(line, t)
    return t.rstrip() + "\n" + line + "\n"

text = set_key(text, "POSTGRES_PASSWORD", new_pg)
text = set_key(text, "REDIS_PASSWORD", new_redis)

def rewrite_url(t, var, new_pass):
    pat = re.compile(rf"^{re.escape(var)}=(.+)$", re.M)
    m = pat.search(t)
    if not m:
        return t
    url = m.group(1).strip().strip('"').strip("'")
    # user:pass@ or :pass@ (Redis)
    url2 = re.sub(r"(://)([^@/]*):([^@/]+)@", rf"\1\2:{new_pass}@", url, count=1)
    return pat.sub(f"{var}={url2}", t, count=1)

text = rewrite_url(text, "DATABASE_URL", new_pg)
text = rewrite_url(text, "REDIS_URL", new_redis)
open(path, "w", encoding="utf-8").write(text)
PY
unset HEX_NEW_PG HEX_NEW_REDIS

chmod 600 "${ENV_FILE}"

# Recreate redis with new requirepass + backend to pick up URLs
docker compose up -d redis --force-recreate
sleep 3
docker compose up -d backend --force-recreate
sleep 8

# Health: DB query + redis ping via backend network (no secret print)
docker compose exec -T postgres psql -U hexalyte -d hexalyte -c "SELECT 1 AS db_ok;" >/dev/null
docker compose exec -T redis redis-cli -a "${NEW_REDIS}" --no-auth-warning PING | grep -q PONG
docker compose ps

# Wipe shell vars
NEW_PG=""
NEW_REDIS=""
unset NEW_PG NEW_REDIS

echo "Rotated POSTGRES_PASSWORD and REDIS_PASSWORD successfully."
echo "JWT_SECRET / KC_CLIENT_SECRET not changed (requires maintenance window)."
echo "Env backup: ${BAK_DIR}/env-${STAMP}.bak"
