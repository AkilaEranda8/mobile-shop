#!/bin/bash
# Hexalyte SSL auto-renew setup (idempotent).
# Run on the production host as root from /opt/hexalyte:
#   bash scripts/ssl-auto-renew-setup.sh
#
# Prerequisites:
#   - Cloudflare API token at /etc/cloudflare/credentials.ini
#     (see scripts/ssl/cloudflare.credentials.example.ini)
#   - Existing Let's Encrypt certs already issued

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/hexalyte}"
CF_CREDS="/etc/cloudflare/credentials.ini"
CF_MIRROR="/root/.secrets/cloudflare.ini"
HOOK_SRC="$APP_DIR/scripts/ssl/reload-nginx.hook.sh"
NGINX_SRC="$APP_DIR/nginx/hexalyte.conf"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Hexalyte SSL auto-renew setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ $EUID -ne 0 ]]; then
  echo "ERROR: run as root"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y certbot python3-certbot-nginx python3-certbot-dns-cloudflare

mkdir -p /etc/cloudflare /root/.secrets \
  /etc/letsencrypt/renewal-hooks/deploy \
  /etc/letsencrypt/renewal-hooks/post

if [[ ! -f "$CF_CREDS" ]]; then
  echo "ERROR: missing $CF_CREDS"
  echo "Copy scripts/ssl/cloudflare.credentials.example.ini → $CF_CREDS and set the token."
  exit 1
fi
chmod 600 "$CF_CREDS"
# Keep mirror for older renewal confs that still point here
cp -f "$CF_CREDS" "$CF_MIRROR"
chmod 600 "$CF_MIRROR"

# Normalize wildcard renewal confs to the canonical credentials path + safer DNS wait
for conf in /etc/letsencrypt/renewal/*.conf; do
  [[ -f "$conf" ]] || continue
  if grep -q 'dns_cloudflare' "$conf" 2>/dev/null; then
    sed -i 's|^dns_cloudflare_credentials *=.*|dns_cloudflare_credentials = /etc/cloudflare/credentials.ini|' "$conf"
    if grep -q '^dns_cloudflare_propagation_seconds' "$conf"; then
      sed -i 's|^dns_cloudflare_propagation_seconds *=.*|dns_cloudflare_propagation_seconds = 30|' "$conf"
    else
      # insert under [renewalparams]
      sed -i '/^\[renewalparams\]/a dns_cloudflare_propagation_seconds = 30' "$conf"
    fi
    echo "normalized: $conf"
  fi
done

# Deploy hook so every successful renew reloads nginx
install -m 755 "$HOOK_SRC" /etc/letsencrypt/renewal-hooks/deploy/01-reload-nginx.sh
install -m 755 "$HOOK_SRC" /etc/letsencrypt/renewal-hooks/post/01-reload-nginx.sh

# Keep live nginx config in sync with repo (tenant wildcard cert name)
if [[ -f "$NGINX_SRC" ]]; then
  cp "$NGINX_SRC" /etc/nginx/sites-available/hexalyte
  ln -sfn /etc/nginx/sites-available/hexalyte /etc/nginx/sites-enabled/hexalyte
  nginx -t
  systemctl reload nginx
  echo "nginx config synced from repo"
fi

systemctl enable --now certbot.timer
systemctl restart certbot.timer

# Dry-run only the certs Hexalyte production depends on (skip legacy/unused hosts)
echo "--- certbot renew dry-run (critical certs) ---"
CRITICAL=(
  wildcard-rsa.app.hexalyte.com
  shop.hexalyte.com-0001
  app.hexalyte.com
  api.shop.hexalyte.com
  admin2.hexalyte.com
)
DRY_FAIL=0
for name in "${CRITICAL[@]}"; do
  if [[ -f "/etc/letsencrypt/renewal/${name}.conf" ]]; then
    echo "dry-run: $name"
    if ! certbot renew --cert-name "$name" --dry-run --non-interactive --no-random-sleep-on-renew; then
      echo "WARN: dry-run failed for $name"
      DRY_FAIL=1
    fi
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " SSL auto-renew is armed"
echo "  Timer : certbot.timer (twice daily)"
echo "  Creds : $CF_CREDS"
echo "  Hook  : reload nginx after renew"
if [[ "$DRY_FAIL" -ne 0 ]]; then
  echo "  NOTE  : one or more critical dry-runs failed — check Cloudflare DNS token / propagation"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
systemctl list-timers --all | grep -i certbot || true
exit 0
