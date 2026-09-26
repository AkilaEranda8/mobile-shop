#!/usr/bin/env bash
# Install Fail2Ban for sshd with conservative bans (compatible with UFW).
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y fail2ban

mkdir -p /etc/fail2ban/jail.d
cat > /etc/fail2ban/jail.d/hexalyte-sshd.local <<'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
backend = systemd

[sshd]
enabled = true
port = ssh
filter = sshd
maxretry = 5
bantime = 1h
findtime = 10m
EOF

systemctl enable fail2ban
systemctl restart fail2ban
fail2ban-client status sshd || fail2ban-client status
echo "Fail2Ban installed for sshd (5 fails / 10m → 1h ban)."
