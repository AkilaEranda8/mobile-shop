# SSL auto-renew (Hexalyte)

## What broke on 24 Aug 2026

Tenant sites (`*.app.hexalyte.com`, e.g. `test.app.hexalyte.com`) stopped being trusted because the **wildcard** certificate expired. `certbot.timer` was enabled, but renewal failed silently because:

1. Cloudflare DNS plugin / credentials path was missing on the host
2. No deploy hook reloaded nginx after renew

## Canonical setup

| Item | Path / name |
|------|-------------|
| Tenant wildcard cert | `wildcard-rsa.app.hexalyte.com` (`*.app.hexalyte.com`) |
| Cloudflare token file | `/etc/cloudflare/credentials.ini` (mode `600`) |
| Example (no secrets) | `scripts/ssl/cloudflare.credentials.example.ini` |
| Install / repair script | `scripts/ssl-auto-renew-setup.sh` |
| Nginx reload hook | `/etc/letsencrypt/renewal-hooks/deploy/01-reload-nginx.sh` |
| Timer | `certbot.timer` (twice daily) |

**Never commit the real Cloudflare API token.**

## Server one-time / repair

```bash
cd /opt/hexalyte
# ensure credentials exist first
bash scripts/ssl-auto-renew-setup.sh
```

Dry-run inside that script proves renew works without waiting for expiry.

## Manual renew (if needed)

```bash
certbot renew --cert-name wildcard-rsa.app.hexalyte.com --force-renewal --no-random-sleep-on-renew
systemctl reload nginx
```
