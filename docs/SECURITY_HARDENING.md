# Security hardening — Hexalyte

Actions taken in the app repo and what you must still do on the server / Keycloak.

## Fixed in codebase

1. **Secrets removed from `docker-compose.yml` / `docker-compose-hexalyte.yml`**  
   Compose now requires `.env` (`JWT_SECRET`, DB/Redis passwords, Keycloak secret, etc.).

2. **Deploy script** no longer embeds SSH passwords — use `HEXALYTE_SSH_PASS`.

3. **Database seed** refuses to run when `NODE_ENV=production`.

4. **Platform admin bootstrap** rejects short / obvious passwords.

## Required on production (`/opt/hexalyte`)

1. Create `/opt/hexalyte/.env` (mode `600`) from `.env.example`.
2. For a **zero-downtime first migrate**, keep the **same** DB/Redis passwords the live volume already uses, then schedule a later rotation.
3. Prefer rotating **`JWT_SECRET`** and **`KC_CLIENT_SECRET`** soon (Keycloak Admin → Clients → `hexalyte-backend` → Credentials → regenerate, then update `.env`).
4. After updating `.env`: `docker compose up -d --force-recreate`.

## Manual VirusTotal / brand trust

- Point `hexalyte.com` DNS to your real marketing/app host.
- Submit VirusTotal reanalysis after DNS + login branding are stable.
- Rotate any secret that was ever committed to git (assume leaked).

## Local develop

```bash
cp .env.example .env
# fill local values
docker compose up -d
```
