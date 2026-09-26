#!/usr/bin/env bash
# Harden sshd ONLY after verifying pubkey login works.
# Usage:
#   1) Ensure /root/.ssh/authorized_keys has at least one key
#   2) From an admin machine: ssh -o BatchMode=yes root@HOST 'echo key-ok'
#   3) bash scripts/harden-sshd.sh
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root"
  exit 1
fi

AK="/root/.ssh/authorized_keys"
if [[ ! -f "${AK}" ]] || ! grep -qE '^(ssh-rsa|ssh-ed25519|ecdsa-sha2)' "${AK}"; then
  echo "REFUSING: no usable public keys in ${AK}. Password auth would lock everyone out."
  exit 2
fi

SSHD_CONFIG="/etc/ssh/sshd_config"
DROPIN_DIR="/etc/ssh/sshd_config.d"
mkdir -p "${DROPIN_DIR}"
# OpenSSH uses the FIRST obtained value per keyword — use 00- so we win over cloud-init.
DROPIN="${DROPIN_DIR}/00-hexalyte-hardening.conf"
# Remove older drop-in if present
rm -f "${DROPIN_DIR}/99-hexalyte-hardening.conf"

cat > "${DROPIN}" <<'EOF'
# Managed by Hexalyte harden-sshd.sh — key-only admin access
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
PubkeyAuthentication yes
PermitRootLogin prohibit-password
AuthenticationMethods publickey
EOF

sshd -t
systemctl reload ssh || systemctl reload sshd

echo "sshd hardened: password auth disabled; pubkey required."
sshd -T | grep -iE '^(passwordauthentication|pubkeyauthentication|permitrootlogin|authenticationmethods) '
