# Hexalyte Security Hardening — Final Follow-up Report

**Date:** 26 September 2026 (Asia/Colombo)  
**Server:** `157.180.113.249` · **App:** `/opt/hexalyte`  
**Auth host:** `auth.hexalyte.com` → `95.217.134.211`

```text
Current Security State:
HARDENED WITH FOLLOW-UPS
```

---

## Completed

| Item | Result |
|------|--------|
| Auth root password rotation | **ROTATED** (old chat password rejected; ops pubkey bootstrap on auth host; recovery once-file root-only on auth — value not recorded here) |
| Disk pressure (82% → warning) | **Cleared** via `docker builder prune -af` only (no volume/image/container delete) → **~30%** used |
| Nginx duplicate `server_name` | **Cleaned** — removed duplicate `sites-enabled/hexalyte` load; kept single `conf.d/hexalyte.conf` (synced from newer sites-available). `nginx -t` clean; app/api/admin/auth HTTPS **200** |
| Redis host port | **Removed** from compose (backend uses `redis:6379` on Docker network). Loopback publish no longer required |
| Keycloak TLS incident | Already fixed earlier — cert valid until **2026-12-25**; `KEYCLOAK_AUTH_ENABLED=true`; OIDC discovery **200** |
| Login resilience | Preserved — Keycloak failure → local JWT fallback |
| Local encrypted DB backups | Daily **02:15** Asia/Colombo; AES-256-CBC format v1; admin **System Health → Daily Backups** |
| Dependency audit (scan) | Completed for backend/web/admin — see Remaining Risks (no blind `--force` upgrades) |

---

## Verified (live)

```text
UFW: active — public 22/80/443
ss: public listeners 22/80/443 only
Postgres: not on host ports
Redis: Docker-network only after host-port removal
App ports: 127.0.0.1:3000–3002
.env: mode 600
Fail2Ban: sshd jail active
nginx -t: OK (no duplicate server_name warnings)
TLS: app / api.shop / admin2 / auth → HTTP 200
Keycloak: reachable
Disk: ~30% after build-cache prune
Backup dir: present under /var/backups/hexalyte
```

---

## Pending

```text
JWT_SECRET ROTATION:
PENDING MAINTENANCE WINDOW

KC_CLIENT_SECRET:
PENDING MAINTENANCE WINDOW

OFFSITE BACKUP:
PENDING PROVIDER / DESTINATION CONFIGURATION

Dependency patches (Next critical / nodemailer / ws / xlsx):
PENDING staged upgrades + regression tests

Ongoing disk monitoring / alerting:
PENDING (thresholds documented; no external alert sink configured)

Auth root password:
ROTATED — operator should store new value from auth host recovery file offline, then shred the once-file
```

---

## Security controls (baseline — unchanged)

| Control | State |
|---------|--------|
| UFW | Allow 22/80/443; deny DB/Redis/app direct |
| SSH | Public-key only; password auth disabled on shop host |
| Fail2Ban | sshd 5/10m → 1h |
| PostgreSQL | Docker-network only; SCRAM; restricted `pg_hba` |
| Redis | Auth + protected mode; Docker-network only |
| TLS | Nginx + Let's Encrypt |
| `.env` | `chmod 600`; not in Git |

---

## Backup

| Item | Status |
|------|--------|
| Local encrypted backup | Active — cron daily 02:15 |
| Encryption | format_version=1 AES-256-CBC + PBKDF2 |
| Admin visibility | System Health → Daily Backups |
| Restore test | Script present — run monthly |
| Offsite | **PENDING** destination/credentials |

---

## Authentication

| Item | Status |
|------|--------|
| Keycloak | Enabled; TLS valid to 2026-12-25 |
| Local JWT fallback | Enabled on KC outage |
| JWT_SECRET | **PENDING** maintenance window |
| KC_CLIENT_SECRET | **PENDING** maintenance window |
| Auth host root password | **ROTATED** |

---

## Remaining risks

| Risk | Severity | Likelihood | Mitigation | Owner | Target |
|------|----------|------------|------------|-------|--------|
| JWT secret age | High | Medium | Rotate in maintenance window; expect session invalidation | Platform | Next window |
| KC client secret age | High | Medium | Rotate KC client + `.env` together; test login/fallback | Platform | Next window |
| No offsite backups | High | Medium | Configure encrypted offsite destination | Platform | When provider ready |
| Next.js critical advisory (web/admin) | Critical | Medium | Plan Next upgrade + full UI regression | Eng | Next release train |
| xlsx no fix available | High | Low | Minimize untrusted spreadsheet upload; track SheetJS advisory | Eng | Ongoing |
| Disk growth (Docker builds) | Medium | High | Periodic `docker builder prune`; alert at 80% | Ops | Weekly |
| Auth recovery once-file on disk | Medium | Low | Operator copy offline + `shred` once-file on auth host | Ops | Immediate |

---

## Production impact

```text
Production Impact:
- Auth root password: rotated (auth host only; Keycloak app auth unaffected)
- Disk prune: none (build cache only)
- Nginx: reload only (~0s)
- Redis host-port removal: brief redis recreate; backend reconnects via Docker DNS

Next Maintenance Window:
- JWT_SECRET rotation
- KC_CLIENT_SECRET rotation
- Optional Next.js / nodemailer / ws dependency upgrades with full regression
```

---

## Offsite backup requirements (when ready)

Do not invent credentials. Need approved:

```text
<BACKUP_DESTINATION>   # S3/SFTP/other outside this server
Encrypted transport
Restricted IAM / SSH key
No public ACL
Retention matching or exceeding local (14d+)
Integrity check + restore test
Never upload .env or plaintext backup key
```

---

**Do not claim the system is 100% secure.**
