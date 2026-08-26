# Hexalyte HR Engine — Post-Implementation Extraction Report

**Date:** 2026-08-26  
**Principle:** Existing Phase-1 HR module is the source of truth · extract only reusable business rules · additive · no Mobile Shop regression  
**Bible:** [HEXALYTE_MOBILE_SHOP_HR_PAYROLL_ARCHITECTURE_PLAN.md](./HEXALYTE_MOBILE_SHOP_HR_PAYROLL_ARCHITECTURE_PLAN.md) · [adr/002-shared-engines.md](./adr/002-shared-engines.md) · [ENGINES_PHASE1_REPORT.md](./ENGINES_PHASE1_REPORT.md)

---

## 1. Current HR implementation analysis

### Verdict

**Only HR Phase 1 is implemented in code.** Attendance, shifts, leave, compensation packages, HR payroll runs, payslips, advances, loans, and HR reports **do not exist** as domain modules/tables.

| Capability | Status in repo |
|------------|----------------|
| Employee CRUD + User link | ✅ Implemented |
| Departments / Designations | ✅ Implemented |
| EmploymentEvent history | ✅ Implemented |
| Feature flag `HR_PAYROLL` | ✅ Opt-in, default OFF |
| RBAC `HR` / `HR_SALARY` / `HR_PAYROLL` | ✅ Module keys present |
| HR UI (overview, employees, dept, designation, settings placeholder) | ✅ Implemented |
| Attendance / Shifts | ❌ Not implemented |
| Leave | ❌ Not implemented |
| Salary structure / compensation | ❌ Not implemented |
| Staff sales commission | ❌ Not implemented (only reload *provider* commission) |
| HR Payroll calculation / payslips | ❌ Not implemented |
| Accounting payroll journals | ✅ Exists under **Accounting** (manual, User-based) |
| Advances / Loans | ❌ Not implemented |
| HR Reports | ❌ Not implemented |

---

## 2. Implementation inventory (actual paths)

### Backend — `apps/backend/src/modules/hr/`

| File | Role |
|------|------|
| `hr.routes.ts` | `/api/v1/hr/*` — auth + `requireHrFeature` + `enforceModuleAccess('HR')` |
| `hr.middleware.ts` | Feature gate `HR_PAYROLL` |
| `hr.controller.ts` | HTTP → service |
| `hr.schema.ts` | Zod validation |
| `hr.util.ts` | Branch ACL, employee code, default masters seed |
| `employees.service.ts` | Employee overview/list/CRUD/linkUser + audit |
| `organization.service.ts` | Dept/designation CRUD + `recordEmploymentEvent` |

### Data — Prisma

| Model | Table | Notes |
|-------|-------|-------|
| `HrDepartment` | `HrDepartment` | Tenant-scoped masters |
| `HrDesignation` | `HrDesignation` | Tenant-scoped masters |
| `Employee` | `Employee` | Optional `userId` 1:1; `primaryBranchId` required |
| `EmploymentEvent` | `EmploymentEvent` | Lifecycle audit trail |

Migration: `apps/backend/prisma/migrations/20260826100000_hr_phase1/`

### Frontend — `apps/web`

| Area | Path |
|------|------|
| Sidebar dropdown | `components/layout/Sidebar.tsx` (`hrSubmenu`) |
| Pages | `app/(dashboard)/dashboard/hr/**` |
| UI kit / modals | `components/hr/hr-ui.tsx` |
| API client | `lib/api.ts` → `hrApi` |
| Feature / RBAC | `lib/tenant-features.ts`, `lib/role-permissions.ts` |

### Related (not HR module)

| System | Path | Relation |
|--------|------|----------|
| Accounting payroll | `modules/accounting/payroll/payroll.service.ts` | Manual GL accrual/pay over **Users** |
| Reload commission | daily-closing / profit-allocation | Shop income, **not** staff commission |
| Audit Engine | `modules/audit-engine/` | Used by HR services via `recordAuditEventSafe` |
| Workflow Validators | `modules/workflow-validators/` | Repair/PO only today — **not** wired to HR |
| Notification Engine | `modules/notification-engine/` | **Not** used by HR Phase 1 |
| Configuration Engine | `modules/configuration-engine/` | **No** HR policy domain yet |

---

## 3. Business logic map (what exists to extract)

| Logic | Location (before) | Pure? | Side effects |
|-------|-------------------|-------|--------------|
| Resign/terminate → `leftAt` + `isActive=false` | `employees.service` update | Yes (derivable) | DB write in service |
| Status / branch / update employment events | `employees.service` | Yes (event plan) | Persist in service |
| Create JOINED + USER_LINKED events | `employees.service` | Yes | Persist in service |
| User link uniqueness | `employees.service` | No (needs DB) | Keep in service |
| Branch ACL | `hr.util` | No (needs req/DB) | Keep in HR module |
| Employee code sequence | `hr.util` | No (needs DB) | Keep in HR module |
| Default dept/designation seed | `hr.util` | Constants yes; seed no | Keep seed in module |
| Dept/designation CRUD | `organization.service` | CRUD | **Keep in module** |
| Accounting payroll statutory math | `accounting/payroll` | Partially pure | **Keep in Accounting** until HR payroll exists |

---

## 4. Reuse / Extract / Keep matrix

| Existing logic | Current location | Action | Reason |
|----------------|------------------|--------|--------|
| Employee status exit patches | `hr/employees.service.ts` | **MOVE → HR Engine** | Reusable lifecycle rule |
| Employment event planning (create/update/link) | `hr/employees.service.ts` | **MOVE → HR Engine** | Deterministic event set |
| Employee / dept / designation CRUD | `hr/*` | **KEEP** | Application/persistence layer |
| Branch ACL + feature flag | `hr.util` / middleware | **KEEP** | Security/HTTP boundary |
| Audit writes | `audit-engine` via service | **KEEP** | Do not audit inside engine |
| Accounting payroll journals | `accounting/payroll` | **KEEP** | Different aggregate (User + GL) |
| Reload commission | finance/daily-closing | **KEEP** | Not employee commission |
| Attendance / leave / payroll calc | — | **NOT NEEDED yet** | Domain not implemented |
| Hard status transition graph | — | **NOT NEEDED yet** | Would regress open Phase-1 edits |

---

## 5. HR Engine architecture (implemented foundation)

```
HR UI
  ↓
HR Routes / Controller          (HTTP, auth, feature, RBAC)
  ↓
HR Application Services         (tenant/branch, Prisma, audit)
  ↓
HR Engine                       (pure domain plans — Phase 1)
  ↓
Domain results consumed by services → DB + Audit Engine
```

**Module path:** `apps/backend/src/modules/hr-engine/`

| File | Role |
|------|------|
| `hr-engine.types.ts` | Contracts + version |
| `hr-engine.employment.ts` | Pure employment lifecycle |
| `hr-engine.service.ts` | Facade + future stubs |
| `hr-engine.employment.test.ts` | Deterministic unit tests |

**Engine must not:** talk HTTP, Prisma, Keycloak, React, send notifications, post GL, or trust raw client tenant/branch IDs.

---

## 6. Engine responsibility boundaries

| In HR Engine (now) | In HR Module | In other engines | Future HR Engine |
|--------------------|--------------|------------------|------------------|
| Status exit field patches | CRUD persistence | Audit recording | Attendance calc |
| Employment event plans | Branch ACL | Accounting journals | Leave balance |
| Create/link event plans | Feature flag | Notifications | Compensation / payroll |

---

## 7. Engine API (minimal, actual)

### Implemented (pure)

| API | Input | Output | Side effects |
|-----|-------|--------|--------------|
| `planEmploymentStatusChange(from,to,now?)` | statuses + clock | patches + event type \| null | none |
| `planEmploymentUpdateEvents(...)` | before snapshot + optional next status/branch | events + fieldPatches | none |
| `planEmploymentCreateEvents(...)` | code, name, status, userId? | events[] | none |
| `planUserLinkEvents(...)` | previous/next userId | events[] | none |

### Stubs (throw until domain exists)

`calculateAttendanceResult` · `calculateLeaveResult` · `calculateCompensationResult` · `calculatePayrollResult`

---

## 8–11. Payroll / Attendance / Leave / Compensation / Commission

**Not extractable today** — no HR domain implementation.

| Topic | Design stance |
|-------|----------------|
| **Payroll calc** | Future pure `calculatePayrollResult(input) → lines/gross/net/hash`. Persistence + GL stay in HR service → Accounting. |
| **Accounting boundary** | Keep `accounting/payroll` as manual User-based path until HR payroll posts via existing journal helpers. |
| **Attendance / Shift / Leave** | Implement domain first (Phases 2–3), then extract pure calculators. |
| **Compensation** | Phase 4 salary components — engine evaluates components; service stores packages. |
| **Commission** | Do **not** duplicate reload commission. Staff sales commission (future) should read `Sale.cashierId` / repair tech / HP salesperson as **inputs** into payroll earnings — Sales code stays unchanged. |

---

## 12–16. Configuration / Accounting / Audit / Notification / Workflow / Security

| Concern | Rule |
|---------|------|
| Configuration | When policies exist, load via Configuration Engine in **service**, pass resolved policy into engine. |
| Accounting | Engine → PayrollResult → HR service → existing journal/outbox. Never post GL from engine. |
| Audit | Engine may attach `engineVersion` / `ruleId`; service calls Audit Engine. |
| Notifications | Service → Notification Engine only. |
| Workflow | Optional later: register Employee/Leave/Payroll graphs in Workflow Validators; Phase 1 remains permissive. |
| Security | Controllers + `requireHrFeature` + `enforceModuleAccess('HR')` + branch ACL unchanged. Engine receives already-authorized domain snapshots. |
| Feature flag | `HR_PAYROLL` semantics unchanged (opt-in OFF). |

---

## 17. Database impact

**None.** No schema changes for this extraction.

---

## 18. Performance

Phase-1 volumes are small (per-employee CRUD). Engine calls are O(1) pure functions — no N+1 risk introduced. Future payroll batches must pre-load attendance/leave/salary and run pure calc in memory.

---

## 19. Test strategy

| Suite | Coverage |
|-------|----------|
| `hr-engine.employment.test.ts` | Resign/terminate patches; event parity (profile / status / branch / both); create + link |
| Future | Attendance matrix, leave balance/overlap, payroll deterministic hash |

Regression rule: identical inputs → identical event types + field patches as pre-extraction Phase-1.

---

## 20–21. Migration / refactor / compatibility

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Engine foundation + employment extract | ✅ Done |
| 2 | Attendance/shift calculators when models land | Planned |
| 3 | Leave rules | Planned |
| 4 | Compensation + commission input contract | Planned |
| 5–6 | Deterministic payroll engine + GL post via Accounting | Planned |
| 7 | Broader regression harness | Planned |

**Backward compatibility:** APIs unchanged · flag unchanged · schema unchanged · event types unchanged · exit behavior unchanged.

---

## 22. Implementation changes (this pass)

1. Added `apps/backend/src/modules/hr-engine/*`
2. Wired `employees.service` create/update/linkUser through engine planners
3. Audit `afterJson` includes `hrEngineVersion` on update
4. Unit tests for employment planners

---

## 23. Final architecture diagram

```
                 HR UI
                   ↓
             HR API / Routes
                   ↓
          HR Application Services     ← tenant, branch, Prisma, Zod
                   ↓
               HR Engine              ← pure employment plans (v1.0.0-phase1)
                   ↓
        ┌──────────┼──────────┐
        ↓          ↓          ↓
   (future)    Audit Engine   Domain models
 Configuration                Employee / Events
        │
        └──► Accounting (payroll journals) — NOT inside HR Engine
```

---

## Adoption note

See [hr-engine-adoption.md](./hr-engine-adoption.md).
