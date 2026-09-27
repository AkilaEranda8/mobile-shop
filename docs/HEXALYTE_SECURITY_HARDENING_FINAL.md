# Hexalyte Security Hardening — Final Follow-up Report

**Date:** 26 September 2026 (Asia/Colombo)  
**Server:** `157.180.113.249` · **App:** `/opt/hexalyte`  
**Auth host:** `auth.hexalyte.com` → `95.217.134.211`  
**Code branch (deps/xlsx):** `security/followups-2026-09-26`

```text
Current Security State:
HARDENED WITH FOLLOW-UPS
```

Critical secret rotations from the prior maintenance window remain verified. This follow-up pass addressed dependency patches (partial), xlsx upload mitigations, POS PIN verification, offsite scaffolding, and infra re-checks. Remaining blockers: password-manager import, AWS secret keys for offsite, Next.js production deploy (staging gate), nodemailer major, full role-matrix auth tests.

---

## Completed (verified)

| Item | Result | Evidence / time (UTC) |
|------|--------|------------------------|
| JWT_SECRET rotation | Done prior window | Old/forged JWT → 401 |
| KC_CLIENT_SECRET rotation | Done prior window | client_credentials 200; wrong secret 401 |
| Encrypted local DB backup | Active | Latest enc `20260926-162256`; cron 02:15 |
| Backup decrypt + TOC restore test | Done prior | TOC 1404 lines; prod DB untouched |
| Auth recovery once-file on servers | Shredded | Auth + shop hosts absent |
| UFW / SSH key-only / Fail2Ban | Verified 26 Sep ~17:11 | Public 22/80/443 only |
| Nginx / TLS | Verified | `nginx -t` OK; app/api/admin/auth healthy |
| Redis / Postgres private | Verified | Not on public listeners |
| Disk | ~30% | ok (warn 80 / crit 90 / emerg 95) |
| **POS Quick PIN vs JWT** | **No impact** | Production `POS_PIN_PEPPER` dedicated (len≥16) — JWT fallback unused |
| **ws** | **Patched to 8.22.0** | `npm audit`: ws **CLEARED**; backend image rebuilt & API 200 |
| **xlsx upload mitigations** | **Applied (backend)** | AuthZ roles, ext/MIME checks, size/row/col limits, formula soft-sanitize, no content logging; deployed |
| **Next.js 15.5.26 (branch)** | Critical advisories addressed in **local** builds | Web + Admin `next build` exit 0; audit severity Critical→**Moderate** (remaining needs Next 16 major — not forced) |
| Offsite backup **script** | Installed (dormant) | Exits 2 without AWS keys — no invented credentials |

---

## Pending

```text
Auth recovery password:
PENDING — approved password manager / CLI required
(Local offline copy still on operator workstation under ~/.hexalyte-secure/
 — do NOT delete until imported; value not recorded here)

OFFSITE BACKUP:
PENDING — destination/credentials required
Present: AWS_REGION, AWS_S3_BUCKET
Missing: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
Also needed: aws CLI on host; optional OFFSITE_S3_ENDPOINT / OFFSITE_S3_PREFIX

Next.js production deploy (web/admin images):
PENDING — no staging environment; local builds OK on 15.5.26
Do not force Next 16 (audit --force path)

nodemailer:
PENDING — major upgrade to 10.x requires SMTP staging regression
(Usage: apps/backend/src/utils/mailer.ts — HTML warranty mail only; no attachments)

Full Super-Admin / Admin / User / Tenant A↔B auth matrix:
PENDING — no vaulted test-creds file on server

tar / electron-builder (desktop tooling):
PENDING review for desktop pipeline only (not API runtime)

sharp / postcss (transitive):
PENDING controlled non-force upgrades with Next deploy

Disk external alerting sink:
PENDING
```

---

## Dependency status

| Package | Prior | Now | Notes |
|---------|-------|-----|-------|
| next | 15.5.18 (Critical) | **15.5.26** in branch + local builds | Production web/admin images **not yet** rebuilt on 15.5.26 |
| ws | 8.20.x (High) | **8.22.0 CLEARED** | Backend production rebuilt |
| nodemailer | ≤9.x High | Unchanged 6.x | Major breaking → staging |
| xlsx | High, no fix | Unchanged lib; **mitigations applied** | Report: `xlsx — no upstream fix; mitigation controls applied` |
| tar | Critical via electron-builder | Desktop/dev tooling only | Not in API/web runtime image path |
| postcss / sharp | High transitive | Partial; next embeds postcss 8.4.31 | Bundle with Next prod deploy |

**Never used:** `npm audit fix --force`

---

## POS Quick PIN

```text
JWT rotation does not affect POS PIN derivation
```

Verified: production `.env` has dedicated `POS_PIN_PEPPER` (length ≥ 16). Code path in `pos-pin.crypto.ts` uses pepper first; JWT_SECRET hash is only a fallback when pepper is missing/short.

---

## Offsite backup — operator requirements

To activate (script already at `/opt/hexalyte/scripts/offsite-backup-hexalyte-db.sh`):

1. Approved IAM user/role with **PutObject/HeadObject** on the target bucket only (no public ACL).  
2. Set in `/opt/hexalyte/.env` (mode 600): `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (region + bucket already present).  
3. Install `aws` CLI on the host.  
4. Optional: `OFFSITE_S3_PREFIX`, `OFFSITE_S3_ENDPOINT` (S3-compatible).  
5. Re-run install cron or add 02:30 offsite job; verify upload size + sha256 meta.  
6. Never upload `.env` or `/root/.hexalyte-backup.key`.

Until then status remains:

```text
OFFSITE BACKUP: PENDING — destination/credentials required
```

---

## Authentication / tenant regression

| Check | Result |
|-------|--------|
| API / Web / Admin / KC health | 200 / 200 / 307 / 200 |
| Missing / forged JWT | 401 (prior + still enforced) |
| Live tenant sessions after backend recreate | Healthy (`tenants/me` 200 across tenants) |
| Dedicated multi-role matrix | **PENDING** test identities |

---

## Security risks (open)

| Risk | Severity | Status |
|------|----------|--------|
| Offsite backup missing secrets | High | PENDING credentials |
| Auth root pw still on operator disk | Medium | PENDING password-manager import |
| Next 15.5.26 not yet in prod web/admin images | Medium | PENDING staging→prod deploy |
| Remaining Next moderate (needs 16.x) | Medium | Deferred — no force major |
| nodemailer High | High | PENDING major + SMTP test |
| xlsx High (library) | High | Mitigated; no upstream fix |
| tar Critical (electron-builder) | Medium* | Desktop tooling only |
| Auth matrix automation | Medium | PENDING test accounts |
| Disk pager/alerting | Low–Med | Thresholds only |

\*Critical CVSS for tar, but not exposed in production Docker API/web runtime.

---

## Verification evidence (26 Sep 2026)

| Check | Result |
|-------|--------|
| `docker compose ps` | All Up; postgres healthy; app ports 127.0.0.1 |
| `nginx -t` | OK |
| `ufw status` | active; 22/80/443 |
| `ss` public | 22/80/443 only |
| HTTPS health | app 200, api/health 200, admin2 307, KC OIDC 200 |
| Backend rebuild (xlsx/ws) | Build OK; API health 200; live tenant traffic OK |
| Web local build (Next 15.5.26) | exit 0 |
| Admin local build (Next 15.5.26) | exit 0 |
| Offsite script dry-run | Exit 2 — missing AWS keys (expected) |
| Disk | 30% |

**Production impact this follow-up:** brief backend recreate for xlsx/ws; no DB changes; no secret rotation; no UFW/SSH changes; users/data unaffected beyond momentary API reconnect.

---

## Rollback

- **Backend image:** redeploy previous `hexalyte-backend` image tag / prior compose build from last known-good commit.  
- **Next branch:** do not promote to prod until staging sign-off; revert package pins to prior lockfile if needed.  
- **Offsite script:** remove cron line / script; local encrypted backups unaffected.  
- **JWT/KC:** do not re-rotate; prior rollback guidance in earlier report section still applies.

---

## Auth recovery (operator action)

```text
Auth recovery password: PENDING PASSWORD MANAGER IMPORT
Local copy: present under operator ~/.hexalyte-secure/ (not in Git / not in chat)
After import + verify in password manager: securely delete local file + empty Recycle Bin
Then report: MOVED TO PASSWORD MANAGER — LOCAL COPY REMOVED
```

No Bitwarden / 1Password / `pass` CLI was available on the operator machine to complete the import automatically.

---

**Do not claim 100% secure / fully secure.**  
Status remains **HARDENED WITH FOLLOW-UPS** until offsite credentials, password-manager import, Next prod deploy, and nodemailer staging upgrade are completed.
