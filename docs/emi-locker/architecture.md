# EMI Locker — Architecture & Reuse Map

> Source of truth inspection for Hexalyte production codebase (2026-09-09).

## Inspection summary

| Layer | Actual stack |
|-------|----------------|
| Web | `apps/web` — Next.js 15 App Router, Tailwind, design-system (`PageHeader`, `StatCard`) |
| Admin | `apps/admin` — tenant feature toggles |
| API | `apps/backend` — Express 4, Zod, `authenticate` / `authorize` / `requireModuleAccess` |
| DB | Prisma 5 + PostgreSQL, row-level `tenantId` |
| Jobs | In-process timers in `server.ts` (not BullMQ) |
| Auth | JWT (+ optional Keycloak), Redis blacklist |
| RBAC | `UserRole` + tenant `rolePermissions` matrix (`hide`/`view`/`edit`) |
| Features | `TenantFeature` string keys + branch `disabledFeatures` |

## Reuse map (do not duplicate)

| Concern | Existing module / entity | Path |
|---------|--------------------------|------|
| Finance EMI | `HirePurchaseAgreement`, `Installment`, `Payment`, `Settings`, `Log` | `prisma` + `modules/hire-purchase/` |
| Customer | `Customer` | `modules/customers/` |
| Sale / POS | `Sale`, `SalePayment` | `modules/sales/` |
| Product | `Product` | `modules/products/` |
| IMEI | `ImeiRecord` (`UNDER_HIRE_PURCHASE`) | `modules/products/imei.routes.ts` |
| Branch / Tenant | `Branch`, `Tenant`, `TenantFeature` | `modules/tenants/` |
| Users / RBAC | `User`, `role-permissions.util.ts`, `module-access.middleware.ts` | middleware + tenants |
| Audit | `AuditEvent` via `recordAuditEvent` | `modules/audit-engine/` |
| HP ops log | `HirePurchaseLog` | hire-purchase routes |
| SMS | `notifyHpReminderSms` / sms module | `modules/sms/` |
| WhatsApp | `whatsappService` | `modules/whatsapp/` |
| In-app notify | `UserNotification` | feature-suggestions / notifications |
| Jobs | `hire-purchase-maintenance.job.ts` pattern | `jobs/` |
| Validation | `validate()` Zod middleware | `middleware/validate.middleware.ts` |
| Responses | `sendSuccess` / `sendPaginated` | `utils/response.ts` |
| Branch scope | `effectiveBranchId`, `resolveMutationBranchId` | `utils/active-branch.ts` |

## EMI Locker owns (new)

| Entity | Responsibility |
|--------|----------------|
| `ManagedDevice` | Fleet state linked to HP + IMEI + customer |
| `DeviceEnrollment` | Short-lived one-time QR enrollment |
| `DevicePolicy` | ACTIVE / WARNING / RESTRICTED / RELEASED templates |
| `DeviceCommand` | Idempotent APPLY/REMOVE/SYNC/REFRESH/RELEASE_DEVICE |
| `DeviceEvent` | Operational timeline |
| `EmiLockerSettings` | Dry-run, auto/manual restriction, grace extras |

Financial balances are **never** recalculated in EMI Locker — only read from Hire Purchase.

## Module location

```text
apps/backend/src/modules/emi-locker/
apps/backend/src/jobs/emi-locker-enforcement.job.ts
apps/web/src/app/(dashboard)/dashboard/emi-locker/
apps/web/src/components/emi-locker/
```

API base: `/api/v1/emi-locker`  
Feature key: `EMI_LOCKER` (opt-in; requires `HIRE_PURCHASE` for finance linkage)

## Phase 2 Admin UI

| Route | Purpose |
|-------|---------|
| `/dashboard/emi-locker` | Counts + HP finance snapshot + status distribution |
| `/dashboard/emi-locker/devices` | Searchable device table |
| `/dashboard/emi-locker/devices/:id` | Detail, actions, commands/events/audit |
| `/dashboard/emi-locker/enrollment` | HP → ManagedDevice → enrollment QR |
| `/dashboard/emi-locker/commands` | Global command history |
| `/dashboard/emi-locker/policies` | Policy templates CRUD |
| `/dashboard/emi-locker/settings` | Branch locker settings (AMAPI not togglable by shop users) |
| `/dashboard/emi-locker/reports` | Device / restriction / collection reports |

UI uses real API data only (no hardcoded device counts or balances).

