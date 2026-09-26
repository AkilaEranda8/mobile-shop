## Database security (Postgres)

**Already in place**
- Compose publishes Postgres only on `127.0.0.1:5432` (not the public internet).
- Backend connects over the internal Docker network (`postgres:5432`).
- Custom `deploy/postgres/pg_hba.conf`: Docker private ranges + localhost with `scram-sha-256`; reject all other hosts.
- Connection / DDL logging enabled (`log_connections`, `log_disconnections`, `log_statement=ddl`).

**On the server (required)**
```bash
cd /opt/hexalyte
git pull
# recreate postgres with new hba/logging (data volume kept)
docker compose up -d postgres --force-recreate
# firewall: SSH + 80/443 only
bash scripts/harden-server-firewall.sh
```

**Admin access to DB**
- Prefer: `docker compose exec -T postgres psql -U hexalyte -d hexalyte`
- Or SSH tunnel to `127.0.0.1:5432` (never open 5432 publicly).

**Optional later**
- Rotate `POSTGRES_PASSWORD` / `DATABASE_URL` (schedule downtime window; update `.env` then recreate backend + postgres).
- Move Postgres to a private VPC / managed DB with TLS.

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
5. **SSL auto-renew:** keep Cloudflare token at `/etc/cloudflare/credentials.ini` and run `bash scripts/ssl-auto-renew-setup.sh` (see `docs/SSL_AUTO_RENEW.md`).
6. **Firewall:** `bash scripts/harden-server-firewall.sh` (UFW: 22/80/443 only).

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
