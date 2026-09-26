# Hexalyte Production Security Hardening — Implementation Report

**Date:** 26 September 2026 (Asia/Colombo)  
**Server:** `157.180.113.249` · **App:** `/opt/hexalyte`  
**Final status:** **HARDENED WITH FOLLOW-UPS**

---

## 1. Completed

| Control | What changed | Why | Downtime | Rollback |
|---------|--------------|-----|----------|----------|
| Encrypted DB backups | Daily AES-256 encrypted `pg_dump` + cron + key file | No automated backups existed | None | Disable cron; keep files |
| Restore test | Temp DB restore then drop | Prove backups work without touching prod | None | N/A |
| SSH pubkey installed | Admin `id_rsa.pub` → `authorized_keys` | Prerequisite for password disable | None | Remove key line |
| SSH password disabled | `AuthenticationMethods publickey` + harden script | Stop brute-force password logins | None | Re-enable only after keys verified |
| Fail2Ban sshd | 5 fails / 10m → 1h ban | Rate-limit SSH abuse | None | `systemctl stop fail2ban` |
| Postgres host port removed | No `ports:` publish | DB only on Docker network | Brief postgres recreate (~20s) | Re-add `127.0.0.1:5432:5432` |
| DB + Redis password rotation | `rotate-db-redis-secrets.sh` | Reduce credential age / leak risk | Brief redis/backend recreate | Restore `/root/hexalyte-secret-backups/env-*.bak` + re-ALTER role |
| UFW retained | Unchanged allow 22/80/443 | Perimeter least privilege | None | N/A |
| Ops docs | `PRODUCTION_SECURITY_OPERATIONS.md` | Runbooks without secrets | None | N/A |

---

## 2. Verified (live)

- UFW **active**; public allow **22/80/443**; deny **5432/6379/3000–3002**
- Postgres **not** listening on host (`5432 not on host`; container `5432/tcp` only)
- Redis still loopback-only `127.0.0.1:6379` + UFW deny
- App ports loopback-only `3000–3002`
- Password SSH rejected (`server sent: publickey`)
- Key SSH works (`BatchMode` OK)
- Fail2Ban jail `sshd` active (sample bans present for scanners)
- Backup file present under `/var/backups/hexalyte/db/*.dump.enc` (mode 600)
- Restore test OK — temp DB counts: tenants **67**, products **3535**, then dropped
- Post-rotation DB query OK (`SELECT 1` / tenant count **67**)
- `.env` mode **600**; env backup stored under `/root/hexalyte-secret-backups/` (not printed)
- Git does not track production `.env` (only `.env.example` variants)

---

## 3. Remaining risks

| Risk | Severity | Likelihood | Current mitigation | Recommended action | Owner | Target |
|------|----------|------------|--------------------|--------------------|-------|--------|
| `JWT_SECRET` not rotated | High | Medium | Existing secret; sessions still valid | Maintenance window rotation + recreate API/web/admin | Ops | ≤ 14 days |
| `KC_CLIENT_SECRET` not rotated | High | Medium | Only if Keycloak auth enabled | Rotate in Keycloak + `.env` together | Ops | ≤ 14 days |
| Redis still published on loopback | Low | Low | UFW deny + requirepass | Optional: remove host `ports:` like Postgres | Ops | ≤ 30 days |
| Disk ~79% full | Medium | Medium | Monitor | Expand volume / prune images & old artifacts | Ops | ≤ 7 days |
| No offsite backup copy yet | Medium | Medium | Local encrypted dumps | rsync/S3 encrypted offsite | Ops | ≤ 30 days |
| Nginx duplicate server_name warnings | Low | Low | `nginx -t` OK | Dedupe conf includes | Eng | backlog |
| Dependency CVEs | Medium | Medium | Not fully scanned this pass | Scheduled `npm audit` + image updates | Eng | ≤ 30 days |
| `sshd -T` may still show PasswordAuthentication=yes if cloud-init order races | Low | Low | Effective auth is publickey-only (verified) | Keep `00-hexalyte-hardening.conf` first | Ops | done / re-check |

---

## 4. Downtime

**No planned user-facing maintenance window.**  
Brief service recreates: Postgres (port removal), Redis + Backend (secret rotation). Expected impact: seconds–low minutes of API reconnect. Web/Admin containers stayed up.

---

## 5. Backup

| Field | Value |
|-------|--------|
| Backup created | Yes — `hexalyte-20260926-144803.dump.enc` |
| Backup location | `/var/backups/hexalyte/db/` |
| Backup encryption | Yes — AES-256-CBC PBKDF2; key `/root/.hexalyte-backup.key` |
| Restore tested | Yes |
| Restore result | OK (temp DB verified then dropped) |
| Recovery procedure | See `docs/PRODUCTION_SECURITY_OPERATIONS.md` §3–4 |

---

## 6. Secret rotation

| Category | Rotated? |
|----------|----------|
| `POSTGRES_PASSWORD` / `DATABASE_URL` | **Yes** |
| `REDIS_PASSWORD` / `REDIS_URL` | **Yes** |
| `JWT_SECRET` | **No** (session invalidation — schedule window) |
| `KC_CLIENT_SECRET` | **No** (IdP sync required) |

Secret **values were not printed** in logs or this report.

---

## 7. SSH

| Check | Result |
|-------|--------|
| Admin pubkey installed | Yes |
| Key login verified (separate session) | Yes |
| Password login disabled / rejected | Yes (verified with plink password attempt) |
| Fail2Ban | Installed & active for `sshd` |

---

## 8. Final status

```text
HARDENED WITH FOLLOW-UPS
```

Follow-ups: JWT/Keycloak rotation under maintenance window; offsite backups; disk space; optional Redis host-port removal; dependency audit.

---

*Related: `docs/SECURITY_HARDENING.md`, `docs/HEXALYTE_SECURITY_REPORT.md`, `docs/PRODUCTION_SECURITY_OPERATIONS.md`*
