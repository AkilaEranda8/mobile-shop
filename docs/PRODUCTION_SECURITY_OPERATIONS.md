# Hexalyte Production Security Operations

Internal runbook. **Never store real passwords, JWT secrets, or `.env` contents in this file.**

Server: `157.180.113.249` · App: `/opt/hexalyte` · Timezone: Asia/Colombo

---

## 1. SSH access

**Policy:** public-key only. Password authentication is disabled.

```bash
ssh -i ~/.ssh/<private_key> root@157.180.113.249
```

- Authorized keys: `/root/.ssh/authorized_keys` (mode 600)
- Hardening drop-in: `/etc/ssh/sshd_config.d/00-hexalyte-hardening.conf`
- Re-apply: `bash /opt/hexalyte/scripts/harden-sshd.sh` (refuses if no keys present)
- Fail2Ban jail `sshd`: 5 failures / 10 minutes → 1 hour ban

**Emergency:** keep a second offline copy of the admin private key. Do not re-enable password auth without installing a working pubkey first.

---

## 2. Database access

Postgres is **not** published on the host. Use Docker network only:

```bash
cd /opt/hexalyte
docker compose exec -T postgres psql -U hexalyte -d hexalyte
```

If a GUI (DBeaver) is required temporarily:

1. Prefer `docker compose exec` + SQL scripts.
2. Or temporarily add `ports: ["127.0.0.1:5432:5432"]`, recreate postgres, SSH tunnel to localhost, then **remove the port again**.

Never open `5432` to `0.0.0.0`.

---

## 3. Backups

| Item | Value |
|------|--------|
| Script | `scripts/backup-hexalyte-db.sh` |
| Installer | `scripts/install-db-backup.sh` |
| Schedule | cron `/etc/cron.d/hexalyte-db-backup` — daily **02:15** |
| Location | `/var/backups/hexalyte/db/*.dump.enc` |
| Encryption | AES-256-CBC + PBKDF2 (openssl), key `/root/.hexalyte-backup.key` (600) |
| Retention | 14 days (encrypted files + meta) |
| Log | `/var/log/hexalyte-db-backup.log` |

Manual backup:

```bash
bash /opt/hexalyte/scripts/backup-hexalyte-db.sh
```

---

## 4. Restore test (non-destructive)

```bash
bash /opt/hexalyte/scripts/restore-test-hexalyte-db.sh
```

Restores latest encrypted dump into temp DB `hexalyte_restore_test`, verifies row counts, then **drops** the temp DB. Production `hexalyte` is never overwritten.

---

## 5. Secret rotation

| Secret | Script / method | Downtime | Notes |
|--------|-----------------|----------|-------|
| `POSTGRES_PASSWORD` + `DATABASE_URL` | `scripts/rotate-db-redis-secrets.sh` | Brief API blip | Alters role + recreates backend |
| `REDIS_PASSWORD` + `REDIS_URL` | same script | Brief | Recreates redis + backend |
| `JWT_SECRET` | Manual maintenance window | **All sessions invalidated** | Update `.env`, recreate backend/web/admin as needed |
| `KC_CLIENT_SECRET` | Manual + Keycloak admin | Depends on IdP | Sync Keycloak client then `.env` |

Env backups (mode 600): `/root/hexalyte-secret-backups/env-*.bak` — do not commit or scp to untrusted machines.

---

## 6. Firewall recovery

```bash
bash /opt/hexalyte/scripts/harden-server-firewall.sh
ufw status verbose
```

Allowed public: `22`, `80`, `443`. Denied: `5432`, `5434`, `6379`, `3000–3002`.

---

## 7. TLS / Nginx

```bash
nginx -t && systemctl reload nginx
```

Certbot renewals via `/etc/cron.d/certbot`. See `docs/SSL_AUTO_RENEW.md`.

Security headers already set in `nginx/hexalyte.conf` (HSTS, nosniff, frame options, referrer policy).

---

## 8. Incident response (short)

1. Preserve logs (`journalctl -u ssh`, `fail2ban-client status sshd`, `docker compose logs --tail=200 backend`).
2. If credential compromise suspected: rotate DB/Redis via script; schedule JWT/Keycloak rotation.
3. If SSH compromise: remove unknown keys from `authorized_keys`, rotate all secrets, review UFW bans.
4. Restore from encrypted backup only after isolate + snapshot.

---

## 9. Quick health checklist

```bash
ufw status
ss -lnt | grep -E ':(22|80|443|5432|6379|3000|3001|3002)\b'
docker compose -f /opt/hexalyte/docker-compose.yml ps
docker compose -f /opt/hexalyte/docker-compose.yml exec -T postgres \
  psql -U hexalyte -d hexalyte -c 'SELECT 1'
fail2ban-client status sshd
ls -la /opt/hexalyte/.env   # expect 600
```
