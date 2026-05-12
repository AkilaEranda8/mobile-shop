#!/bin/bash
# Hexalyte Domain + SSL Setup Script
# Run on the server: bash setup-domain.sh
# Requires: DNS A records already pointing to this server's IP

set -e

DOMAINS=("app.hexalyte.com" "api.shop.hexalyte.com" "admin2.hexalyte.com")
EMAIL="admin@hexalyte.com"
APP_DIR="/opt/hexalyte"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Hexalyte Domain & SSL Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Install nginx & certbot
echo "--- Installing nginx and certbot ---"
apt-get update -qq
apt-get install -y nginx certbot python3-certbot-nginx

# 2. Copy nginx config
echo "--- Deploying nginx config ---"
cp "$APP_DIR/nginx/hexalyte.conf" /etc/nginx/sites-available/hexalyte
ln -sf /etc/nginx/sites-available/hexalyte /etc/nginx/sites-enabled/hexalyte
rm -f /etc/nginx/sites-enabled/default

# 3. Temporarily allow HTTP for certbot ACME challenge
echo "--- Creating temp HTTP-only config for cert issuance ---"
cat > /etc/nginx/sites-available/hexalyte-temp << 'EOF'
server {
    listen 80;
    server_name app.hexalyte.com api.shop.hexalyte.com admin2.hexalyte.com;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 200 'OK'; }
}
EOF
ln -sf /etc/nginx/sites-available/hexalyte-temp /etc/nginx/sites-enabled/hexalyte-temp
nginx -t && systemctl reload nginx

# 4. Get SSL certificates
echo "--- Obtaining SSL certificates ---"
for domain in "${DOMAINS[@]}"; do
    echo "  → Cert for $domain"
    certbot certonly --nginx -d "$domain" --email "$EMAIL" --agree-tos --non-interactive --quiet
done

# 5. Swap to final config (with SSL)
echo "--- Activating SSL config ---"
rm -f /etc/nginx/sites-enabled/hexalyte-temp
nginx -t && systemctl reload nginx

# 6. Auto-renew cron
echo "--- Setting up auto-renew ---"
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && systemctl reload nginx") | crontab -

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Done! Services are live at:"
echo "  Web   → https://app.hexalyte.com"
echo "  API   → https://api.shop.hexalyte.com"
echo "  Admin → https://admin2.hexalyte.com"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
