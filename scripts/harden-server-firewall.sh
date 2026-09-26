#!/usr/bin/env bash
# Hexalyte production firewall — allow SSH + HTTP/HTTPS only.
# Run on the app server as root after reviewing SSH access.
#
#   bash scripts/harden-server-firewall.sh
#
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
if ! command -v ufw >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y ufw
fi

# Default deny inbound
ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# SSH first — do not lock yourself out
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# Explicitly deny database / redis / app ports from the public internet
# (compose already binds these to 127.0.0.1; UFW is defense in depth)
ufw deny 5432/tcp comment 'Postgres public deny'
ufw deny 5434/tcp comment 'Postgres alt deny'
ufw deny 6379/tcp comment 'Redis public deny'
ufw deny 3000/tcp comment 'Web direct deny'
ufw deny 3001/tcp comment 'API direct deny'
ufw deny 3002/tcp comment 'Admin direct deny'

ufw --force enable
ufw status verbose

echo ""
echo "Firewall enabled. Postgres/Redis stay on 127.0.0.1 only via Docker publish."
echo "App access: HTTPS (443) through nginx. DB access: SSH tunnel or docker exec."
