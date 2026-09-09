# Hexalyte EMI Device Locker — Architecture & Implementation Plan

> **Status:** Phase 1 in progress  
> **Date:** 2026-09-09  
> **Principle:** Reuse Hire Purchase for finance; build device management as a sibling module.

---

## 1. Current architecture analysis

### Stack (as implemented)

| Layer | Tech |
|-------|------|
| Web | Next.js 15 / React 19 / Tailwind (`apps/web`) |
| Admin | Next.js 15 (`apps/admin`) |
| API | Express 4 / Prisma 5 / Zod (`apps/backend`) |
| DB | PostgreSQL, row-level `tenantId` |
| Cache | Redis (ioredis) — not BullMQ |
| Auth | App JWT + optional Keycloak; roles + module matrix |

### What already exists (reuse)

| Spec area | Existing |
|-----------|----------|
| EMI agreements / installments / payments / grace / late fee / reminders | `HirePurchase*` models + `/api/v1/hire-purchase` + HP UI + maintenance job |
| Customers / sales / products | `Customer`, `Sale`, `Product` |
| Device unit identity | `ImeiRecord` (`UNDER_HIRE_PURCHASE` status) |
| Audit | `AuditEvent` + `recordAuditEvent` |
| Notifications | SMS / WhatsApp / in-app + HP reminder templates |
| Feature gating | `TenantFeature` + branch opt-out |
| RBAC | `UserRole` + `rolePermissions` matrix |

### What does **not** exist (create)

- Managed Android device fleet (`ManagedDevice`)
- Enrollment tokens / QR flow (`DeviceEnrollment`)
- Restriction / active policies (`DevicePolicy`)
- Command queue (`DeviceCommand`) + events (`DeviceEvent`)
- Android Management API integration
- EMI-locker-specific settings (auto vs manual restriction)
- Customer consent capture for device management

### Role mapping (do not invent parallel role enums)

| Spec | Hexalyte |
|------|----------|
| SUPER_ADMIN | `PLATFORM_ADMIN` |
| COMPANY_ADMIN | `OWNER` |
| BRANCH_MANAGER | `MANAGER` |
| EMI_OFFICER | `MANAGER`/`CASHIER` with `HIRE_PURCHASE` + `EMI_LOCKER` edit |
| SHOP_STAFF | `CASHIER` |
| VIEWER | matrix `view` |

Feature / module key: **`EMI_LOCKER`** (opt-in; requires `HIRE_PURCHASE` for finance linkage).

---

## 2. Database changes

### New models

- `ManagedDevice` — enrolled unit linked to tenant/branch/customer/HP agreement/`ImeiRecord`
- `DeviceEnrollment` — short-lived one-time enrollment tokens + state machine
- `DevicePolicy` — active vs restriction policy templates (AMAPI policy name + JSON)
- `DeviceCommand` — `APPLY_RESTRICTION` | `REMOVE_RESTRICTION` | `SYNC_POLICY` | `REFRESH_STATUS` | `RELEASE`
- `DeviceEvent` — management / heartbeat / webhook events
- `EmiLockerSettings` — per tenant/branch: auto restriction, manual approval, offline grace, consent text version

### Extend (minimal)

- `HirePurchaseAgreement`: optional device-management consent fields + link to managed device
- Indexes: `tenantId`, `agreementId`, `imei1`, `status`, `dueDate` (HP already), `lastSeenAt`

### Explicitly **not** duplicated

No second `EMIAgreement` / `EMIInstallment` / `EMIPayment` / `AuditLog` tables.

### Payment verification rule

Shop HP payments are created as `COMPLETED` when staff records them — treat as verified.  
Future online/`PENDING` channel must not unlock until verified. Restore eligibility is computed from **server-side** outstanding + overdue installments.

---

## 3. API plan

Base: `/api/v1/emi-locker`

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/dashboard` | Aggregates (active EMI, overdue, restricted, collection %) |
| GET/POST | `/devices` | List / register device |
| GET | `/devices/:id` | Detail |
| POST | `/devices/:id/enrollment` | Create enrollment token + QR payload |
| POST | `/devices/:id/sync` | Refresh status |
| POST | `/devices/:id/restrict` | Queue APPLY_RESTRICTION (RBAC + rules) |
| POST | `/devices/:id/restore` | Queue REMOVE_RESTRICTION if eligible |
| POST | `/devices/:id/release` | Complete agreement release |
| GET | `/devices/:id/commands` | Command history |
| GET | `/devices/:id/events` | Events |
| GET/PATCH | `/settings` | Locker settings |
| GET | `/reports/devices` | Device fleet report |
| GET | `/reports/overdue` | Overdue + restriction status |
| POST | `/webhooks/android-management` | Authenticated AMAPI pub/sub (Phase 3) |

Finance remains at `/api/v1/hire-purchase/*`.

All routes: `authenticate` → feature `EMI_LOCKER` → module access → Zod → tenant isolation.

---

## 4. Android Enterprise integration plan

### Official capabilities (verified)

- Enrollment via `enterprises.enrollmentTokens.create` + QR / zero-touch / DPC
- Policies applied by linking `policyName` to devices
- Company-owned fully managed or COPE modes
- Default new-project **device quota is 0** until Google approves increase ([Permissible Usage](https://developers.google.com/android/management/permissible-usage))
- API restricted to commercial EMM / Device Trust providers — Hexalyte must qualify before production scale

### Service: `AndroidManagementService`

Methods (server-only):

`createEnterprise`, `createEnrollmentToken`, `getEnrollmentInformation`, `registerDevice`, `getDevice`, `issueDeviceCommand`, `updateDevicePolicy`, `removeDevicePolicy`, `deleteDevice`

### Modes

| Mode | Behavior |
|------|----------|
| `dry-run` (default until credentials+quota) | Persist commands; simulate AMAPI success; no Google calls |
| `live` | Call AMAPI with service-account JSON from env/secret manager |

### Restriction policy (non-destructive)

Configurable lock-task / allowed-apps policy that shows an EMI payment-required screen.  
**Forbidden as EMI enforcement:** factory reset wipe, permanent brick, credential theft, surveillance.

### QR payload

Only: enrollment id, short-lived one-time token, expiry, enterprise signup URL / AMAPI enrollment value.  
Never: passwords, JWT access tokens, DB credentials, customer PII.

---

## 5. UI page plan (`apps/web`)

| Route | Purpose |
|-------|---------|
| `/dashboard/emi-locker` | Dashboard KPIs |
| `/dashboard/emi-locker/devices` | Fleet list |
| `/dashboard/emi-locker/devices/[id]` | Detail + actions |
| `/dashboard/emi-locker/enrollment` | QR enrollment wizard |
| `/dashboard/emi-locker/commands` | Command audit |
| `/dashboard/emi-locker/reports` | Device / overdue reports |
| `/dashboard/emi-locker/settings` | Auto/manual restriction, consent text |

Deep-link into existing HP agreement / payment pages for finance actions.  
Customer portal (later): read-only agreement + schedule; no management credentials.

---

## 6. Implementation phases

| Phase | Deliverables |
|-------|----------------|
| **1** | Prisma + migrations, APIs, RBAC, audit, settings, enrollment tokens, dry-run AMAPI, enforcement job skeleton |
| **2** | Admin UI pages + sidebar + empty/loading/error states |
| **3** | Live Google Cloud / AMAPI (after enterprise + quota approval) |
| **4** | Full enforcement + restore + manual approval + release |
| **5** | Notification templates for DEVICE_* events |
| **6** | Security review, monitoring, rate limits, DR, performance |

### Enforcement flow

```
Scheduler → overdue HP installments past grace
  → settings.automaticRestriction?
  → else Pending Restriction (manual approval)
  → DeviceCommand APPLY_RESTRICTION (idempotent)
  → AMAPI policy update
  → AuditEvent + notify
```

### Restore flow

```
HP payment COMPLETED/VERIFIED
  → recalculate outstanding / overdue
  → eligible per settings?
  → REMOVE_RESTRICTION
  → device ACTIVE
  → AuditEvent
```

### Offline

Backend is source of truth. No immediate default on connectivity loss.  
Admins see `lastSeenAt` / ONLINE|OFFLINE|UNKNOWN from management confirmation only.

---

## 7. Security checklist

- [x] Tenant isolation on all locker queries
- [x] No secrets in QR / frontend
- [x] Short-lived one-time enrollment tokens
- [x] Device commands require RBAC + business rules
- [x] Idempotency keys on commands
- [x] Prisma transactions for payment-linked restore
- [ ] Live AMAPI credentials in secret manager only
- [ ] Legal consent text reviewed per jurisdiction before production
- [ ] Google Permissible Usage + quota approval before live enrollments

---

## 8. Documentation & ops

- Env vars: `ANDROID_MANAGEMENT_MODE=dry-run|live`, `ANDROID_MANAGEMENT_ENTERPRISE_NAME`, `GOOGLE_APPLICATION_CREDENTIALS` / JSON secret
- Feature flag: enable `EMI_LOCKER` per tenant (and keep `HIRE_PURCHASE` on)
- Consent version stored at enrollment time
