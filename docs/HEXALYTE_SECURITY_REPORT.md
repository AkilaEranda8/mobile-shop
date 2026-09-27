# Hexalyte Security Report

**Date:** 26 September 2026 (Asia/Colombo)  
**Scope:** Production stack at `157.180.113.249` (`/opt/hexalyte`) — Postgres, Redis, API, Web, Admin, Nginx/TLS, host firewall  
**Classification:** Internal — operations & leadership  
**Overall posture:** **Hardened baseline (Good)** — DB and host edge controls verified live; secret rotation and SSH lockdown remain recommended follow-ups

---

## 1. Executive summary

Hexalyte production is **not exposing the database or app runtimes to the public internet**. Public entry is limited to **SSH (22)**, **HTTP (80)**, and **HTTPS (443)**. Postgres and Redis listen only on **loopback (`127.0.0.1`)**, are denied by **UFW**, and Postgres uses a **deny-by-default `pg_hba`** with **SCRAM-SHA-256** for TCP auth.

TLS certificates are in place for app / API / admin hostnames via Let’s Encrypt. Application secrets live in `/opt/hexalyte/.env` with mode **`600`**.

**Immediate residual risks (priority):** rotate long-lived DB/JWT/Keycloak secrets on a maintenance window; tighten SSH (keys-only, optional fail2ban); consider removing host publish of Postgres entirely if SSH tunnel is not needed.

---

## 2. Live production verification (26 Sep 2026)

| Control | Status | Evidence |
|--------|--------|----------|
| UFW active | **Pass** | Default deny incoming; allow 22/80/443 |
| Public DB ports | **Pass** | UFW **DENY** 5432, 5434; Redis **DENY** 6379 |
| App ports public | **Pass** | UFW **DENY** 3000–3002 |
| Postgres bind | **Pass** | `127.0.0.1:5432` only |
| Redis bind | **Pass** | `127.0.0.1:6379` only |
| API/Web/Admin bind | **Pass** | `127.0.0.1:3000–3002` (Nginx reverse proxy) |
| Postgres auth | **Pass** | `password_encryption = scram-sha-256` |
| Postgres HBA | **Pass** | Private ranges SCRAM; `0.0.0.0/0` / `::/0` **reject** |
| Postgres logging | **Pass** | `log_connections=on`, `log_statement=ddl` |
| `.env` permissions | **Pass** | `-rw-------` (root, mode 600) |
| Containers healthy | **Pass** | postgres healthy; backend/web/admin/redis up |
| TLS certificates | **Pass** | Let’s Encrypt live dirs for app/api/admin/shop hosts |

---

## 3. Network & perimeter

```
Internet
   │
   ├─ :22  SSH          (UFW ALLOW)
   ├─ :80  HTTP → Nginx (UFW ALLOW, TLS redirect expected)
   └─ :443 HTTPS → Nginx (UFW ALLOW)
            │
            ├─ 127.0.0.1:3000  Web
            ├─ 127.0.0.1:3001  API
            └─ 127.0.0.1:3002  Admin
                    │
                    ├─ Docker net → Postgres (SCRAM)
                    └─ Docker net → Redis (password + renamed dangerous cmds)
```

**Explicitly blocked from the internet:** Postgres, Redis, Next.js/API direct ports.

**Admin DB access paths (allowed by design):**
1. `docker compose exec -T postgres psql -U hexalyte -d hexalyte`
2. SSH tunnel to `127.0.0.1:5432` (never open 5432 publicly)

---

## 4. Database security

| Topic | Implementation |
|-------|----------------|
| Host publish | `127.0.0.1:5432:5432` only (`docker-compose.yml`) |
| Auth method (TCP) | SCRAM-SHA-256 |
| HBA file | `deploy/postgres/pg_hba.conf` → `/etc/hexalyte/pg_hba.conf` |
| Allowed TCP sources | localhost + Docker private ranges (`10/8`, `172.16/12`, `192.168/16`) |
| Denied TCP sources | All other IPv4/IPv6 |
| Local socket | `trust` **inside container only** (for `docker exec`; not host-reachable) |
| Audit logging | Connections + DDL statements |
| Data volume | Named volume retained across recreate |
| Firewall | UFW deny 5432/5434 |

**Not yet done (recommended):**
- Rotate `POSTGRES_PASSWORD` / `DATABASE_URL` (maintenance window)
- Postgres TLS between containers (optional; traffic stays on Docker bridge today)
- Managed Postgres / private VPC for multi-host scale-out

---

## 5. Redis security

| Topic | Implementation |
|-------|----------------|
| Host publish | `127.0.0.1:6379` only |
| Auth | `requirepass` from `.env` |
| Dangerous commands | `CONFIG` renamed; `DEBUG` / `SLAVEOF` / `REPLICAOF` disabled |
| Protected mode | On |
| Firewall | UFW deny 6379 |

---

## 6. Application & platform controls (codebase)

| Area | Status |
|------|--------|
| Secrets in Compose | Required via `.env` — not hard-coded in compose |
| Deploy SSH password | Env var `HEXALYTE_SSH_PASS` — not committed |
| Password hashing | bcrypt (cost 12) for local users / platform admin |
| Auth | JWT + optional Keycloak; role middleware on APIs |
| POS PIN | Tenant feature + policy; cold login gated; PIN hashed/digested |
| Rate limiting | Auth / POS PIN routes use limiters |
| Support impersonation | One-time support-session codes (not raw JWT in URL) |
| Production seed | Blocked when `NODE_ENV=production` |
| Platform admin bootstrap | Rejects weak passwords |
| Module / feature flags | Tenant-scoped access controls |
| Finance UI (admin) | Staff roles cannot see subscription/MRR surfaces |

---

## 7. TLS / web edge

- Nginx terminates TLS for `app.hexalyte.com`, `api.shop.hexalyte.com`, admin hosts, shop hosts, etc.
- Certificates under `/etc/letsencrypt/live/…`
- Auto-renew process documented in `docs/SSL_AUTO_RENEW.md`

---

## 8. Changes applied in this hardening pass

| Change | Commit / artifact |
|--------|-------------------|
| Postgres HBA + SCRAM + logging | `deploy/postgres/pg_hba.conf`, `docker-compose.yml` |
| Host firewall script | `scripts/harden-server-firewall.sh` |
| Docs | `docs/SECURITY_HARDENING.md` |
| Live apply | Postgres recreate + UFW enable on production |

---

## 9. Risk register

| ID | Risk | Severity | Likelihood | Mitigation status |
|----|------|----------|------------|-------------------|
| R1 | DB reachable from internet | Critical | Low | **Mitigated** (bind + UFW + HBA reject) |
| R2 | Weak / leaked DB password | High | Medium | **Open** — rotate on schedule |
| R3 | JWT / Keycloak secret age | High | Medium | **Open** — rotate recommended |
| R4 | SSH password auth / brute force | High | Medium | **Partial** — UFW allows 22; prefer keys + fail2ban |
| R5 | `.env` leakage via backups/git | High | Low | **Partial** — mode 600; never commit `.env` |
| R6 | Insider with SSH root | Critical | Low | Process / least privilege (ops) |
| R7 | Redis without password on loopback | Medium | Low | **Mitigated** (password + UFW) |
| R8 | Dependency CVEs | Medium | Medium | Ongoing `npm audit` / image updates |
| R9 | Tenant data isolation bug | High | Low | Rely on `tenantId` scoping + reviews |
| R10 | Backup encryption / offsite | Medium | Medium | **Open** — confirm encrypted offsite backups |

---

## 10. Recommendations (next 30 days)

### P0 — this week
1. Confirm automated **encrypted DB backups** and a restore drill.
2. Plan **password rotation** for `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET`, `KC_CLIENT_SECRET`.
3. SSH: **disable password login**, keys only; consider `fail2ban` on port 22.

### P1 — this month
4. Remove host publish of Postgres if DBeaver tunnel is unused (`ports:` omit) — access only via `docker exec`.
5. Quarterly dependency + base-image updates (`postgres:16-alpine`, Node 20).
6. Review admin impersonation audit logs retention.

### P2 — backlog
7. Postgres TLS or managed DB.
8. WAF / Cloudflare bot protections in front of login.
9. Formal penetration test / Bugbot-style security review before major releases.

---

## 11. How to re-check (ops)

```bash
ssh root@<server>
cd /opt/hexalyte
ufw status verbose
ss -lnt | grep -E '5432|6379|3000|3001|3002|443|22'
docker compose exec -T postgres psql -U hexalyte -d hexalyte \
  -c "SHOW password_encryption; SHOW log_connections; SHOW hba_file;"
docker compose exec -T postgres cat /etc/hexalyte/pg_hba.conf
ls -la .env
```

Re-apply firewall after OS reset:
```bash
bash scripts/harden-server-firewall.sh
```

---

## 12. Verdict

| Layer | Grade |
|-------|-------|
| Network perimeter | **A−** |
| Database exposure | **A** |
| Database auth/HBA | **A−** |
| Secrets hygiene | **B+** (perms good; rotation pending) |
| App auth model | **B+** |
| Ops / backup / SSH | **B** (process follow-ups) |

**Bottom line:** Public DB exposure risk is under control. Focus next on **secret rotation**, **SSH hardening**, and **backup verify** — not on opening database ports for convenience.

---

*Report generated from live server audit + repo hardening (`docs/SECURITY_HARDENING.md`, `deploy/postgres/`, `scripts/harden-server-firewall.sh`).*
