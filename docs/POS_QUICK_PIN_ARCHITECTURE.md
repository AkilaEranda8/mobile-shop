# Hexalyte POS Quick PIN Authentication — Architecture Design

**Status:** Design only — no implementation yet  
**Date:** 25 August 2026  
**Source of truth:** Live monorepo (`apps/backend`, `apps/web`, `apps/admin`, Prisma, Redis, Keycloak docs)

> **Rules applied:** Keycloak remains identity issuer · No plaintext PINs · No parallel auth authority · Additive + feature-flagged · Tenant / branch / RBAC / Audit Engine must not be bypassed.

---

## 1. Current Authentication Analysis

### What Hexalyte actually does today

| Layer | Implementation |
|-------|----------------|
| Login UI | `apps/web` email + password → `POST /auth/login` |
| Password verify | bcrypt against `User.password` (Postgres) |
| Token issue (KC on) | Keycloak **Resource Owner Password Credentials** via `kcPasswordGrant` after `ensureKcUser` sync (`auth.service.ts`) |
| Token issue (KC off) | App JWT HS256 (`signAccessToken` / `signRefreshToken`) + `RefreshToken` row |
| Access TTL (app JWT) | `JWT_EXPIRES_IN` default **`1d`** (`env.ts`); PLATFORM_ADMIN **`30d`** |
| Refresh TTL (app JWT) | `JWT_REFRESH_EXPIRES_IN` default **`7d`**; PLATFORM_ADMIN **`30d`** |
| KC token TTL | **Configuration decision** — set in Keycloak realm/client (not hardcoded in Hexalyte). Treat as unknown until read from KC admin. |
| Middleware | `authenticate` in `auth.middleware.ts` |
| KC verify | JWKS RS256 → map `db_user_id` / email → **DB user is source of truth** for id/tenant/role |
| Fallback | When `KEYCLOAK_AUTH_ENABLED=true`, plain app JWTs are **rejected** except `impersonation: true` support tokens |
| Blacklist | Redis `blacklist:{accessToken}` TTL 1h on logout |
| Refresh | KC: `kcRefresh`; local: rotate access from stored refresh |
| Web client | `localStorage` tokens (`hx_access_token`, `hx_refresh_token`, `hx_user`); 401 → `/auth/refresh` retry once then clear |

### Current happy path (as implemented)

```
Browser (tenant subdomain / X-Tenant-Slug)
  → POST /auth/login { email, password }
  → bcrypt verify User
  → ensureTenantAccess(tenantId)
  → [KC ON] ensureKcUser + password grant → KC access + refresh
  → [KC OFF] issueLocalTokens → HS256 access + refresh (+ RefreshToken row)
  → authStorage.save(...)
  → API calls: Authorization: Bearer <access>
       + x-active-branch-id / x-tenant-id headers
  → authenticate middleware:
       Redis blacklist → verifyKcToken | app JWT
       → req.user / req.tenantId
       → ensureTenantAccess
       → resolveActiveBranch (UserBranch)
  → authorize(...) / requireModuleAccess(...)
  → domain service (e.g. sales.create(cashierId from req.user))
```

### Existing special session patterns (reuse carefully)

| Pattern | Purpose | Notes |
|---------|---------|-------|
| Impersonation JWT (`impersonation: true`, 2h) | Admin “login as shop” | Middleware exception when KC on |
| Session exchange codes | Post-register handoff | Short-lived code → tokens |
| POS cashier attribution | `Sale.cashierId` / `cashierName` from `authStorage.getUser()` | Already binds sales to JWT identity |

**There is no PIN, no POS lock, no cashier switch today.**

---

## 2. Existing Hexalyte Architecture Reuse

| Concern | Reuse |
|---------|--------|
| Identity issuer | Keycloak (`hexalyte` realm, client `hexalyte-backend`) |
| User row | `User` (+ `UserBranch`) — extend, do not duplicate |
| Tenant isolation | `tenantId` on User + JWT + `ensureTenantAccess` |
| Branch isolation | `resolveActiveBranch` + `x-active-branch-id` |
| RBAC | `authorize(roles)` + `requireModuleAccess` + `tenant.rolePermissions` matrix |
| Features | `TenantFeature` + `OPT_IN_FEATURES` / `isTenantFeatureEnabled` |
| Settings | Configuration Engine (`ConfigDomain`) — add `posPin` domain |
| Audit | `recordAuditEvent` / `recordAuditEventSafe` (`audit-engine`) |
| Rate limits / locks | Redis (same family as JWT blacklist) |
| Password hashing precedent | bcryptjs cost 12 |
| POS UI | `POSOverlay` + `POS_THEME` / existing Tailwind dark POS patterns |
| API client | `api.ts` Bearer + 401 refresh — PIN login returns same token shape |

---

## 3. Recommended PIN Architecture

### Decision summary

| Option | Verdict |
|--------|---------|
| **A. Establish Keycloak session using PIN as KC password** | **Reject** — violates requirement; weak; conflates PIN with account password |
| **B. Unlock already authenticated KC session** | **Required for idle lock**; insufficient alone for cold “PIN-only identify user” |
| **C. Dedicated backend PIN exchange that still obtains Keycloak-issued tokens** | **Adopt as primary auth path** |
| Hybrid B+C | **Adopt** |

### Chosen model: **PIN-gated Keycloak Token Exchange (+ local JWT fallback)**

```
PIN (digits only)
  → resolve tenant from subdomain / X-Tenant-Slug (never global PIN lookup)
  → Redis rate-limit + lockout check
  → tenant-scoped PIN verify (bcrypt/argon2id hash on User)
  → load User (isActive) + UserBranch + role
  → ensureTenantAccess
  → assert POS_QUICK_PIN feature + posPin settings enabled
  → [KC ON] Keycloak Token Exchange / Impersonation grant
        requested_subject = KC user id (db_user_id attribute)
        → KC access_token + refresh_token  (Keycloak remains issuer)
  → [KC OFF] existing issueLocalTokens(user)
  → return same shape as /auth/login { accessToken, refreshToken, user }
  → client authStorage.save → open POS
```

**Why this fits Hexalyte:**

1. When `KEYCLOAK_AUTH_ENABLED=true`, middleware **rejects** ordinary app JWTs. Issuing only HS256 after PIN would create a parallel authority or force a dangerous middleware exception.
2. Hexalyte already syncs every staff user to Keycloak (`ensureKcUser`) with `db_user_id` / `tenant_id` / `user_role` attributes.
3. PIN never becomes the Keycloak password; PIN is a **shop-local shared-terminal factor** verified only in Hexalyte DB/Redis.
4. After exchange, the rest of the stack is unchanged: blacklist, refresh, tenant, branch, module permissions, `cashierId`.

**Keycloak prerequisites (Phase 0):** enable **Token Exchange** (or fine-grained admin impersonation) for client `hexalyte-backend`. Document as configuration gate — do not ship PIN cold-start against production KC until this is verified.

**Fallback if Token Exchange cannot be enabled in time:**  
Do **not** invent a permanent PIN→app-JWT bypass. Instead ship **idle unlock + switch only after a password-authenticated POS session** (model B) until Token Exchange is ready. Cold “PIN-only login” stays behind the same feature flag and is disabled until KC exchange works.

---

## 4. Authentication / Token Flow

### Cold PIN login (shared POS terminal)

```
PIN
 → POST /auth/pos-pin/login { pin }   (+ tenant from slug header)
 → PIN verify (tenant scoped)
 → KC Token Exchange (or local tokens)
 → Access Token (KC or app JWT)
 → Refresh Token
 → authStorage.save
 → GET /auth/me (optional) / use returned user
 → resolveActiveBranch via existing header + UserBranch
 → POSOverlay opens with cashierName = user.name
```

### API request lifetime (unchanged)

```
API request + Bearer access
 → blacklist check
 → verify KC | app JWT
 → tenant + branch + RBAC
 → handler

401
 → POST /auth/refresh { refreshToken }
 → new access (+ maybe refresh from KC)
 → retry once
 → else clear storage → login / PIN screen
```

### Lifetimes

| Token | Source | Lifetime |
|-------|--------|----------|
| Access (app JWT mode) | `JWT_EXPIRES_IN` | default **1 day** |
| Refresh (app JWT mode) | `JWT_REFRESH_EXPIRES_IN` / DB row | default **7 days** |
| Access/Refresh (KC mode) | Keycloak realm/client | **Configuration decision** — read from KC; recommend shorter access (e.g. 5–15m) for POS if feasible |
| Redis blacklist | logout | **1 hour** (existing) |
| PIN lockout | Redis + optional DB | settings-driven (default 15m after N fails) |
| Idle lock | client + optional server flag | settings-driven (default 2–5m) — **does not expire KC session by itself** |

### Logout / revocation

- Existing `POST /auth/logout`: blacklist access, delete app refresh rows, `kcLogout` when configured.
- **PIN disable / admin reset PIN:** does **not** instantly kill active KC sessions unless we also call logout / revoke refresh. Design: on PIN disable or admin reset, optionally `prisma.refreshToken.deleteMany` + best-effort KC logout for that user; document as “active POS session may continue until access expires unless force-logout is called.”
- Prefer explicit **Force logout all sessions** admin action when resetting PIN after compromise.

### PIN auth revoked mid-shift

1. `pinEnabled=false` or user `isActive=false` → next PIN login/switch fails.
2. Existing Bearer tokens remain valid until expiry/blacklist unless force-logout.
3. Idle unlock for **same user** may still succeed client-side until tokens die — mitigate by storing `pinEpoch` in Redis and checking on unlock/switch APIs.

---

## 5. Tenant / Branch Security

### Tenant context (mandatory)

PIN lookup **must** include `tenantId` from:

1. Subdomain slug → tenant id (nginx `X-Tenant-Slug` / existing tenant resolution), or  
2. Explicit authenticated manager context when setting PINs  

**Never** `findFirst({ where: { pinHash } })` globally.

Platform admins: **no POS PIN login** (out of scope).

Suspended / cancelled tenants: blocked by existing `ensureTenantAccess` before token issue.

Disabled users (`isActive=false`): reject PIN even if hash matches.

### PIN uniqueness scope: **tenant-scoped**

| Scope | Why not / why |
|-------|----------------|
| Global | Cross-tenant collision + enumeration risk — **forbidden** |
| Tenant + branch | Same cashier often works multiple branches (`UserBranch`); would force duplicate PINs |
| **Tenant** | Matches `@@unique([tenantId, email])`, feature flags, and shop-local staff set |

Uniqueness enforced on **enabled** PINs only (`pinEnabled=true` AND `pinHash IS NOT NULL`).

### Branch after PIN login

1. Build session via existing `buildUserSession` (branchIds, suggestedBranchId).
2. **Cold PIN login UI:** if the user has **2+ assigned branches**, show a **Select branch** step before dashboard; if 1 branch, auto-select it.
3. Client sets `x-active-branch-id` using existing active-branch helpers (`setActiveBranchId` / `initializeSessionBranch`).
4. Middleware `resolveActiveBranch` still runs — PIN cannot select a branch outside `UserBranch` (OWNER sees all active branches per existing rules).

PIN identifies the **person** (tenant-scoped). Branch is chosen **after** identity — never encoded in the PIN.

### Roles after PIN login

Any active shop role with a PIN may cold-login: **OWNER, MANAGER, CASHIER, TECHNICIAN**.  
`PLATFORM_ADMIN` is excluded. Permissions after login still come from `User.role` + `rolePermissions` — PIN does not elevate access.
4. Sales continue to pass `cashierId` from `req.user.userId`.

---

## 6. RBAC Integration

```
PIN Authentication  →  identity only (who is the cashier)
Role (User.role)    →  authorize('CASHIER'|…)
rolePermissions     →  requireModuleAccess('POS'|'SALES'|…)
Branch              →  resolveActiveBranch / record access
```

Example: Cashier PIN login

| Allowed (if matrix allows) | Not allowed |
|----------------------------|-------------|
| POS overlay, create sale | Accounting settings |
| Customer lookup | Staff / user management |
| Basic sales returns (if permitted) | Payroll, tenant config, role-permissions edit |

PIN must **not** grant elevated roles. Token claims / DB role after exchange must equal the target user’s role.

---

## 7. PIN Security

### Length

| Digits | Space | Recommendation |
|--------|-------|----------------|
| 4 | 10 000 | Acceptable only with strict lockout; too weak alone on shared LAN |
| **6** | **1 000 000** | **Default** — better for PIN-only identification without username |

Configurable `pinLength: 4 | 6` in `posPin` settings; default **6**.

### Storage

- Algorithm: **bcrypt** cost ≥ 12 (match passwords) or argon2id if added project-wide later.
- Columns: `pinHash`, never return hash in API.
- Do not log raw PIN, request bodies with PIN must be redacted in any HTTP logs.

### Controls

| Control | Design |
|---------|--------|
| Unique PIN | Per tenant among enabled PINs |
| Failed attempts | Redis `pospin:fail:{tenantId}:{pinBucket}` + `User.pinFailedAttempts` |
| Lockout | After N fails (default 5): Redis lock `pospin:lock:{tenantId}:{userId}` OR tenant-wide soft lock on that PIN; duration default 15m |
| Rate limit | IP + tenant: e.g. 30 PIN posts / 5 min (Redis) |
| Brute force | Constant-time compare path; generic error `"Invalid PIN"` (no user enumeration) |
| Reset / change | Owner/Manager reset; user change requires current PIN (or password) |
| Disable | `pinEnabled=false`, clear lock counters |
| Rotation | Optional `pinMustChange` flag after admin reset |
| Shoulder surfing | UI masks digits; no echo of full PIN in DOM longer than needed |

---

## 8. Session Security

- Prefer short KC access TTL for POS clients when configurable.
- Idle lock is **UI + optional server “posLocked” flag**; unlock with PIN for **same userId** without new tokens.
- User switch always **issues new tokens** and replaces `authStorage` so `Sale.cashierId` cannot stay sticky to the previous cashier.
- Concurrent devices: allowed (existing model); each PIN login gets its own refresh; logout deletes all app refresh rows for user (existing behavior — document impact).
- Session hijacking: existing Bearer-in-localStorage risk unchanged; PIN does not worsen if HTTPS + existing headers remain. Future hardening (httpOnly cookies) is out of scope for this design.

---

## 9. Database Impact

### EXISTING (reuse)

- `User`, `UserBranch`, `RefreshToken`, `TenantFeature`, `AuditEvent`, `Tenant` JSON settings columns / configuration-engine pattern  
- Auth middleware, sales cashier fields  

### EXTENSION (User)

```
pinHash            String?
pinEnabled         Boolean  @default(false)
pinFailedAttempts  Int      @default(0)
pinLockedUntil     DateTime?
pinUpdatedAt       DateTime?
pinMustChange      Boolean  @default(false)
```

Optional unique partial index strategy: enforce uniqueness in service layer first; add DB constraint later if Prisma/Postgres partial unique on hash is practical (hashes are unique per PIN value with salt — **uniqueness must compare PIN verify across users**, not unique on hash column). Implement as: on set/change PIN, iterate enabled users in tenant and bcrypt-compare (or store `pinLookup` HMAC with tenant pepper for equality index — prefer **HMAC-SHA256(tenantPepper, pin)` unique per tenant** + separate bcrypt/argon2 `pinHash` for verification).  

**Recommended storage pair:**

- `pinDigest` = HMAC-SHA256(server_pepper + tenantId, pin) — unique `@@unique([tenantId, pinDigest])` for fast uniqueness  
- `pinHash` = bcrypt(pin) — verification  

Pepper from env (`POS_PIN_PEPPER`) — configuration decision; never commit.

### NEW

- Config domain `posPin` (Tenant JSON column e.g. `posPinSettings`) via configuration-engine  
- Feature `POS_QUICK_PIN` in `OPT_IN_FEATURES`  
- Redis key namespace `pospin:*`  
- No new User table  

---

## 10. API Design

Base: `/api/v1/auth/pos-pin` and `/api/v1/users/:id/pos-pin` (or `/staff/...`). All PIN bodies validated with Zod; never echo PIN.

### Public / tenant-scoped (no Bearer) — cold login

| API | Auth | Authz | Notes |
|-----|------|-------|-------|
| `POST /auth/pos-pin/login` | None (tenant slug required) | Feature `POS_QUICK_PIN` | Rate limit; returns tokens+user; audit success/fail |

### Authenticated

| API | Auth | Authz | Audit |
|-----|------|-------|-------|
| `POST /auth/pos-pin/switch` | Bearer | Feature + any POS role | New tokens for target user; audit switch |
| `POST /auth/pos-pin/unlock` | Bearer (same user) | Feature | Verify PIN matches `req.user`; no token rotate by default |
| `POST /users/me/pos-pin` | Bearer | Self | Set/change own PIN (current PIN or password) |
| `POST /users/:id/pos-pin/reset` | Bearer | OWNER/MANAGER + SETTINGS edit | Admin set temp PIN + `pinMustChange` |
| `POST /users/:id/pos-pin/disable` | Bearer | OWNER/MANAGER | Disable |
| `GET /tenants/:id/pos-pin-settings` | Bearer | SETTINGS view | Config |
| `PATCH /tenants/:id/pos-pin-settings` | Bearer | OWNER/MANAGER SETTINGS edit | Config |

### Common errors

| Code | Meaning |
|------|---------|
| 400 | Validation / PIN length |
| 401 | Invalid PIN / locked |
| 403 | Feature off / tenant suspended / no branch / forbidden role |
| 429 | Rate limit |
| 503 | Keycloak exchange unavailable |

Responses never include `pinHash` / digest.

---

## 11. Frontend Design

### POS PIN screen (cold)

- Full-screen dark POS theme (`POS_THEME`)
- Masked dots + numeric keypad
- States: idle, loading, error (generic), lockout (show retry-after), success → POS
- No username list (prevents enumeration UX)

### User switch

- Header control “Switch cashier” on `POSOverlay` / HexaPosLayout
- Clears cart optionally (config: warn if cart non-empty)
- PIN modal → `switch` API → `authStorage.save` → refresh permissions/features hooks → update cashier label

### Idle lock

- Timer from `posPin.idleTimeoutSec` (local activity listeners on POS overlay)
- Overlay blocks UI; session tokens remain
- Unlock: PIN for **current** userId via `/unlock`
- Wrong user PIN: offer “Switch user” path instead of unlocking

### Settings UI

- Staff card: enable PIN / set PIN / disable  
- Settings → POS PIN: length, attempts, lock duration, idle timeout, require password to open shift (optional)

Use existing Tailwind / card patterns — no new UI framework.

---

## 12. POS User Switching

```
Cashier A (tokens A) → sale #1001 (cashierId=A)
Switch User → PIN for B
 → tokens B replace storage
 → sale #1002 (cashierId=B)
```

Rules:

- Always new token set (no shared Bearer across cashiers).
- Cart: block switch if lines present unless confirmed clear.
- Offline POS queue: flush or block switch while offline sales pending (tie to existing offline queue behavior).

---

## 13. POS Idle Lock

| Approach | Use |
|----------|-----|
| Unlock existing session with same-user PIN | **Default** — fast; KC session preserved |
| Full re-auth / switch | If PIN belongs to another user or `requirePasswordAfterLock` |

Trade-off: idle unlock is weaker than full re-login (stolen unlocked browser after shoulder-surfed PIN) but appropriate for attended shop counters; mitigate with short idle timeout and optional “require password after N unlocks”.

Do **not** call KC logout on idle lock.

---

## 14. Audit Design

Use `recordAuditEventSafe` with `entityType: 'PosPin'` / `'User'`.

| eventType | when |
|-----------|------|
| `POS_PIN_ENABLED` | enable |
| `POS_PIN_DISABLED` | disable |
| `POS_PIN_CHANGED` | self change |
| `POS_PIN_RESET` | admin reset |
| `POS_PIN_LOGIN_SUCCESS` | cold login |
| `POS_PIN_LOGIN_FAILED` | fail (no PIN value; optional attempt count) |
| `POS_PIN_LOCKOUT` | lockout triggered |
| `POS_PIN_SWITCH` | switch A→B (`beforeJson`/`afterJson` user ids) |
| `POS_PIN_UNLOCK` | idle unlock |

Never store PIN in `beforeJson` / `afterJson`.

---

## 15. Threat Model

| Threat | Risk | Mitigation |
|--------|------|------------|
| Brute force | High | 6-digit default, rate limit, lockout, Redis |
| PIN guessing / shared PINs | High | Unique per tenant; staff training; audit |
| Shoulder surfing | Medium | Masked UI; idle lock |
| Session theft (XSS/localStorage) | High (pre-existing) | Unchanged; CSP/HTTPS; future cookie auth |
| Token theft | High | Short access TTL; blacklist on logout |
| Device theft | High | Idle lock; optional shift password |
| Cross-tenant lookup | Critical | Tenant-required PIN query |
| User enumeration | Medium | Generic errors; no user list on PIN screen |
| Replay | Medium | Standard TLS + one-time KC tokens |
| API abuse | Medium | Rate limits, feature flag |
| Redis failure | Medium | Fail closed on lockout counters for login; optional DB fallback attempts |
| Keycloak failure | High | Return 503; do not fall back to unsigned local auth when KC mode is on |

---

## 16. Failure Handling

| Scenario | Behavior |
|----------|----------|
| KC unavailable | 503 on PIN login/switch; show “Auth service unavailable” |
| Redis unavailable | Fail closed for PIN login (deny) or use DB locks only — prefer deny |
| Invalid PIN | 401 generic |
| Locked PIN | 401/429 with retry-after |
| Disabled user | 403 |
| Suspended tenant | 403 via `ensureTenantAccess` |
| No active branch | 403 after login if assigned branches empty |
| Expired access | Existing refresh |
| Expired refresh | Clear storage → PIN/password screen |
| Network failure | Client retry; keep lock overlay |
| Concurrent sessions | Allowed; switch on one device does not auto-lock others |

---

## 17. Feature Flag Design

- Add **`POS_QUICK_PIN`** to web + backend `OPT_IN_FEATURES` (default off).
- Gate all PIN APIs and POS PIN UI.
- No existing feature covers cashier PIN — new flag is required.
- Optional dependency: tenant must already have `POS` enabled.

---

## 18. Testing Strategy

| Area | Cases |
|------|-------|
| Functional | Valid/invalid PIN; lockout; reset; disable; must-change |
| Isolation | Wrong tenant slug; other tenant same PIN digits; suspended tenant |
| Branch | User without branch; switch branch header after PIN |
| RBAC | Cashier cannot open accounting; manager can |
| Tokens | Refresh after PIN login; logout blacklist; KC on/off modes |
| Switch | Sale cashierId changes A→B |
| Idle | Unlock same user; other user PIN does not unlock |
| Outage | KC 503; Redis deny |
| Security | No hash in responses; no PIN in audit; rate limit |
| Regression | Email/password login unchanged; impersonation unchanged |

---

## 19. Rollout Strategy

1. Flag off for all tenants.  
2. Staging: enable Token Exchange on KC; dry-run PIN for one test shop.  
3. Pilot: one production tenant with 6-digit PINs.  
4. Monitor audit fail/lockout rates.  
5. GA: document in release notes; Owner enables `POS_QUICK_PIN` in features.

---

## 20. Implementation Plan

| Phase | Work |
|-------|------|
| **0** | Confirm KC Token Exchange; define `POS_PIN_PEPPER`; security review of this doc |
| **1** | Prisma User fields + `posPin` config domain + `POS_QUICK_PIN` flag |
| **2** | PIN verify service + KC exchange helper + `/auth/pos-pin/login` |
| **3** | Redis rate limit/lockout + hashing/digest uniqueness |
| **4** | POS PIN screen + wire into POS open path |
| **5** | Switch user API + POSOverlay control |
| **6** | Idle lock overlay + unlock API |
| **7** | Audit events + admin reset UI |
| **8** | Automated + manual security tests |
| **9** | Staging rollout |
| **10** | Production pilot → GA |

---

## 21. Risks and Trade-offs

| Risk / trade-off | Notes |
|------------------|-------|
| Token Exchange dependency | Cold PIN-only login blocked until KC configured; interim = password open + PIN switch/idle only |
| PIN weaker than password | Acceptable for attended POS with lockout + 6 digits + tenant scope |
| localStorage sessions | Pre-existing XSS risk; PIN does not fix it |
| Unique PIN UX | Staff cannot share PINs; support burden on reset |
| bcrypt verify across tenant for uniqueness without digest | Slow — hence HMAC digest recommendation |
| Dual hash (digest + bcrypt) | Slight complexity; needed for indexed uniqueness without storing reversible PIN |
| Idle unlock without re-auth to KC | Faster UX; slightly weaker — timeout must be short |

---

## Appendix A — Explicit non-goals

- Replacing Keycloak  
- Using PIN as Keycloak password  
- Global PIN directory  
- Changing Mobile Shop customer-facing auth  
- Implementing in this design phase  

## Appendix B — Key code references

- `apps/backend/src/middleware/auth.middleware.ts` — `verifyKcToken`, `authenticate`  
- `apps/backend/src/modules/auth/auth.service.ts` — login, refresh, logout, `issueKcSession`  
- `apps/backend/src/utils/jwt.ts` — TTLs, impersonation  
- `apps/backend/src/utils/active-branch.ts` — branch resolution  
- `apps/web/src/lib/auth.ts` / `api.ts` — storage + 401 refresh  
- `apps/web/src/components/pos/POSOverlay.tsx` — cashier identity on sales  
- `docs/KEYCLOAK_AUTH_SETUP.md`, `docs/ARCHITECTURE.md`  

---

**Status:** Phase 0 approved (2026-08-25). Backend foundation + web Phases 4–6 (keypad, cold PIN login, switch, idle lock, staff/settings PIN UI) implemented behind `POS_QUICK_PIN`. Production still needs migration, `POS_PIN_PEPPER`, and Keycloak Token Exchange before cold PIN works with KC auth on.
