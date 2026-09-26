# Hexalyte Production Security Operations Runbook

Internal operations guide for production. **Never store real passwords, JWT secrets, API keys, private keys, `.env` contents, or backup encryption keys in this file.**

| | |
|--|--|
| Server | `157.180.113.249` |
| Application | `/opt/hexalyte` |
| Timezone | Asia/Colombo |
| **Current security state** | **HARDENED WITH FOLLOW-UPS** |

Placeholders used below: `<PRIVATE_KEY>`, `<SECRET>`, `<BACKUP_DESTINATION>`.

---

## Security baseline (do not weaken)

```text
UFW: allow 22, 80, 443 — deny PostgreSQL, Redis, app direct ports
PostgreSQL: Docker-network only, no public host port, SCRAM, restricted pg_hba
Redis: private/loopback, auth + protected mode
SSH: public-key only, password auth disabled, Fail2Ban on sshd
.env: chmod 600, never committed
TLS: Nginx + Let's Encrypt
```

---

## 1. SSH Access

**Policy:** public-key only.

```bash
ssh -i ~/.ssh/<PRIVATE_KEY> root@157.180.113.249
```

| Item | Path / value |
|------|----------------|
| Authorized keys | `/root/.ssh/authorized_keys` (mode `600`) |
| Harden drop-in | `/etc/ssh/sshd_config.d/00-hexalyte-hardening.conf` |
| Re-apply script | `bash /opt/hexalyte/scripts/harden-sshd.sh` |

### Before changing SSH

1. Keep current session open.
2. Open a **second** session with the admin key and confirm it works.
3. Only then edit SSH config.
4. Validate, then reload:

```bash
sshd -t
systemctl reload ssh
```

Never reload after a failed `sshd -t`.

### Effective configuration check

```bash
sshd -T | grep -Ei \
  'passwordauthentication|pubkeyauthentication|authenticationmethods|permitrootlogin'
```

**Expected:**

```text
passwordauthentication no
pubkeyauthentication yes
authenticationmethods publickey
permitrootlogin prohibit-password
```

**Emergency:** keep an offline copy of `<PRIVATE_KEY>`. Do not re-enable password auth without a verified pubkey in `authorized_keys`.

---

## 2. Database Access

**PostgreSQL must not be exposed publicly.**

Preferred access (Docker network only):

```bash
cd /opt/hexalyte
docker compose exec -T postgres \
  psql -U hexalyte -d hexalyte
```

### DBeaver / GUI

1. Prefer SSH tunnel + temporary localhost mapping **only if required**.
2. Never publish `5432` to `0.0.0.0`.
3. If temporary `127.0.0.1:5432:5432` is added, remove it immediately after use.
4. Verify:

```bash
ss -lnt | grep 5432 || echo "5432 not on host (expected for hardened mode)"
```

---

## 3. Backups

| Item | Value |
|------|--------|
| Script | `/opt/hexalyte/scripts/backup-hexalyte-db.sh` |
| Installer | `/opt/hexalyte/scripts/install-db-backup.sh` |
| Schedule | `/etc/cron.d/hexalyte-db-backup` — daily **02:15** |
| Location | `/var/backups/hexalyte/db/*.dump.enc` |
| Meta | `/var/backups/hexalyte/db/*.meta` |
| Encryption | **format_version=1** — AES-256-CBC + PBKDF2 (openssl) |
| Key file | `/root/.hexalyte-backup.key` (mode `600` — never display contents) |
| Retention | 14 days |
| Log | `/var/log/hexalyte-db-backup.log` |

### Manual backup

```bash
bash /opt/hexalyte/scripts/backup-hexalyte-db.sh
echo "exit=$?"
```

Non-zero exit = failure (safe for cron / monitoring).

### Verification commands

```bash
df -h

tail -50 /var/log/hexalyte-db-backup.log

find /var/backups/hexalyte/db \
  -type f \
  -name '*.dump.enc' \
  -mtime -2 \
  -ls

# Key permissions only (do not cat the key)
ls -la /root/.hexalyte-backup.key
```

### How to interpret status

| Condition | Meaning |
|-----------|---------|
| Log ends with `Backup OK` and exit `0` | **Succeeded** |
| Log contains `ERROR:` or cron exit ≠ 0 | **Failed** |
| No `*.dump.enc` with `-mtime -2` | **Stale** (job missed / broken) |
| `df -h` near/full on `/` or backup volume | **Disk pressure** — see Disk Space Monitoring |

Script behaviour: fails if dump/encrypt missing or too small; shreds plaintext; never logs secrets.

### Encryption note (future)

Current production format is **v1** (AES-256-CBC + PBKDF2).  
Authenticated encryption (e.g. AES-256-GCM) may be introduced later as **format_version=2** without invalidating old v1 restores. Do not delete old backups when changing format.

---

## 4. Restore Test

```text
DO NOT restore test backups directly into the production database.
```

```bash
bash /opt/hexalyte/scripts/restore-test-hexalyte-db.sh
```

**Behaviour:**

1. Uses latest valid encrypted backup  
2. Decrypts temporarily  
3. Restores into temp DB `hexalyte_restore_test`  
4. Verifies tables / row counts (`Tenant`, `Product`, …)  
5. Drops **only** the temporary database  
6. Never overwrites production `hexalyte`

**Frequency:** at least monthly; after backup-script changes; after major PostgreSQL upgrades.

---

## 5. Offsite Backups

```text
Status: PENDING
```

Target architecture:

```text
PostgreSQL
    ↓
Encrypted backup (local)
    ↓
Encrypted offsite copy → <BACKUP_DESTINATION>
```

Offsite destination requirements:

- Outside the production server  
- Encrypted transport (e.g. SSH/SFTP or provider TLS)  
- Restricted credentials (not in Git)  
- No public object ACL  
- Documented retention  
- Prefer object-lock / MFA-delete where available  

Do **not** invent cloud credentials here. Implement only when `<BACKUP_DESTINATION>` and IAM/SFTP access are provisioned.

---

## 6. Secret Rotation

### Already rotated (historical — do not print values)

```text
POSTGRES_PASSWORD
DATABASE_URL
REDIS_PASSWORD
REDIS_URL
```

Script (DB + Redis only):

```bash
bash /opt/hexalyte/scripts/rotate-db-redis-secrets.sh
```

Env backups (mode 600): `/root/hexalyte-secret-backups/env-*.bak` — never commit.

### Pending — maintenance window required

```text
JWT_SECRET
KC_CLIENT_SECRET   # only if Keycloak auth is enabled
```

**Do not rotate these automatically.**

#### JWT_SECRET (planned window)

1. Announce maintenance window.  
2. Confirm recent encrypted backup + restore test.  
3. Generate new `<SECRET>` securely (offline / `openssl rand`).  
4. Update `/opt/hexalyte/.env` (do not echo value).  
5. Recreate required services (`backend`, and apps that embed JWT verify if any).  
6. Verify API authentication.  
7. Verify Web / Admin.  
8. Confirm old sessions are invalidated.  
9. Monitor auth error rates.

#### KC_CLIENT_SECRET (if Keycloak enabled)

1. Confirm Keycloak auth is enabled.  
2. Generate new client secret in Keycloak.  
3. Update Keycloak client.  
4. Update production `.env`.  
5. Recreate required services.  
6. Test login.  
7. Monitor authentication.

---

## 7. Disk Space Monitoring

```bash
df -h
docker system df
du -sh /var/backups/hexalyte
```

| Usage | Action |
|-------|--------|
| ≥ 80% | Warning — plan cleanup / expand |
| ≥ 90% | Critical — free space before next backup |
| ≥ 95% | Immediate — stop non-essential growth; expand disk |

### Safe cleanup principles

1. Inspect first — never blind prune.

```bash
docker system df
docker image ls
docker container ls -a
```

2. Do **not** run `docker system prune -a` blindly.  
3. Do not delete active volumes or the production DB volume.  
4. Prefer removing unused dangling images after confirming tags still needed.  
5. Old encrypted backups older than retention are already pruned by the backup script.

---

## 8. Firewall Recovery

```bash
bash /opt/hexalyte/scripts/harden-server-firewall.sh
ufw status verbose
```

| Direction | Ports |
|-----------|--------|
| Allow | `22`, `80`, `443` |
| Deny | `5432`, `5434`, `6379`, `3000–3002` |

Never disable UFW to “fix” an issue without a documented temporary exception and restore step.

---

## 9. TLS / Nginx

```bash
nginx -t && systemctl reload nginx
certbot certificates
```

Always run `nginx -t` before reload. Check expiry with `certbot certificates`. Renewals: `/etc/cron.d/certbot` (see `docs/SSL_AUTO_RENEW.md`).

Existing headers (keep; do not break UI with untested CSP): HSTS, `X-Content-Type-Options`, frame protection, `Referrer-Policy`.

Known follow-up: duplicate `server_name` warnings — clean when editing Nginx (non-blocking).

---

## 10. Fail2Ban

| Setting | Value |
|---------|--------|
| Jail | `sshd` |
| Threshold | 5 failures / 10 minutes |
| Ban | 1 hour |
| Install script | `/opt/hexalyte/scripts/install-fail2ban-sshd.sh` |

```bash
fail2ban-client status sshd
```

Shows current bans, failed attempts, jail status. Do not use overly aggressive bans that lock out legitimate admins. Prefer fixing root cause over permanent bans.

---

## 11. Incident Response

### Preserve evidence first

```bash
journalctl -u ssh --since "24 hours ago" | tail -200
fail2ban-client status sshd
docker compose -f /opt/hexalyte/docker-compose.yml logs --tail=200 backend
```

Do not destroy logs before investigation.

### Suspected credential compromise — review list

```text
PostgreSQL credentials
Redis credentials
JWT secret
Keycloak client secret
SSH keys
Payment gateway credentials
SMS gateway credentials
Cloud/API credentials
```

Rotate **affected** credentials only; do not blindly rotate unrelated systems.

### SSH compromise checklist

1. Preserve logs.  
2. Identify unknown keys in `authorized_keys`.  
3. Isolate if necessary.  
4. Remove unauthorized SSH keys.  
5. Rotate affected credentials (DB/Redis now; JWT/KC in window).  
6. Review UFW.  
7. Review Fail2Ban.  
8. Review Docker processes.  
9. Review authentication logs.  
10. Restore from known-good encrypted backup if integrity is doubtful.

---

## 12. Quick Health Checklist

```bash
cd /opt/hexalyte

ufw status verbose
ss -lnt
docker compose ps
docker compose exec -T postgres \
  psql -U hexalyte -d hexalyte -c 'SELECT 1'
fail2ban-client status sshd
df -h
docker system df
ls -la /opt/hexalyte/.env
```

Expected `.env` mode: **`600`**. Do not `cat` `.env`.

---

## 13. Security Verification

```bash
ss -lnt | grep -E ':(22|80|443|5432|5434|6379|3000|3001|3002)\b'
```

| Port | Expected |
|------|----------|
| `22`, `80`, `443` | Public listeners OK |
| `5432`, `5434` | **Not** publicly exposed (no host publish OR loopback-only + UFW deny) |
| `6379`, `3000–3002` | Loopback-only + UFW deny — **not** public |

Localhost-only bind ≠ public exposure, but prefer no Postgres host publish at all (current hardened mode).

---

## 14. Change Management

Before a potentially disruptive change:

```text
1. Backup
2. Verify backup (log + find -mtime -2 + optional restore-test)
3. Check current service health
4. Make one change
5. Verify service health
6. Review logs
7. Verify application
8. Document result
```

Extra verification required for: PostgreSQL, Redis, SSH, Nginx, Firewall, JWT, Keycloak, Docker Compose.

---

## 15. Rollback Procedures

| Area | Rollback (no secrets in docs) |
|------|-------------------------------|
| SSH | Restore previous `/etc/ssh/sshd_config.d/00-hexalyte-hardening.conf` from known-good copy; `sshd -t` then `systemctl reload ssh`. Keep a key session open. |
| Firewall | Re-run `harden-server-firewall.sh` or restore saved `ufw status numbered` rules. |
| PostgreSQL compose | Re-add temporary `127.0.0.1:5432:5432` only if ops requires; recreate postgres; verify app. Prefer staying unpublished. |
| Redis | Restore prior compose + `.env` bak; recreate redis/backend. |
| Secret rotation (DB/Redis) | Restore `/root/hexalyte-secret-backups/env-*.bak` to `.env`, set DB role password to match bak (offline), recreate services. |
| Nginx | Restore prior conf from Git / backup; `nginx -t` then reload. |
| Backup cron | Restore `/etc/cron.d/hexalyte-db-backup` or remove to pause. |
| Docker Compose | `git checkout` known-good compose + `docker compose up -d` for affected services only. |

---

## 16. Emergency Recovery

1. Prefer **read-only** assessment: health checklist §12 + logs.  
2. If data loss / corruption: decrypt latest good `*.dump.enc` into a **new** temp DB first (restore-test pattern).  
3. Only after validation, plan production restore under maintenance (separate procedure — never overwrite blindly).  
4. Keep SSH key access and UFW intact during recovery.  
5. After recovery: immediate backup + restore-test + credential review.

---

## Script inventory (validated names)

| Script | Status |
|--------|--------|
| `/opt/hexalyte/scripts/backup-hexalyte-db.sh` | Present |
| `/opt/hexalyte/scripts/install-db-backup.sh` | Present |
| `/opt/hexalyte/scripts/restore-test-hexalyte-db.sh` | Present |
| `/opt/hexalyte/scripts/harden-server-firewall.sh` | Present |
| `/opt/hexalyte/scripts/harden-sshd.sh` | Present |
| `/opt/hexalyte/scripts/install-fail2ban-sshd.sh` | Present |
| `/opt/hexalyte/scripts/rotate-db-redis-secrets.sh` | Present |

---

## Remaining follow-ups

```text
- JWT_SECRET rotation (maintenance window)
- KC_CLIENT_SECRET rotation if Keycloak is enabled
- Encrypted offsite backup (<BACKUP_DESTINATION>)
- Ongoing disk usage monitoring
- Dependency vulnerability scanning
- Nginx duplicate server_name cleanup
- Optional Redis host-port removal
```

```text
Current Security State:
HARDENED WITH FOLLOW-UPS
```

Do not claim the system is 100% secure.
