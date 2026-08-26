# Hexalyte Mobile Shop — HR & Payroll  
# Architecture & Implementation Plan

> **Status:** Phase 0 — Architecture analysis complete. **No HR feature code in this document.**  
> **Source of truth:** Repository implementation (`apps/backend`, `apps/web`, Prisma), not aspirational docs.  
> **Date:** 2026-08-26  
> **Rule:** Additive · feature-flagged · reuse existing engines · zero behavior change when OFF.

---

## 0. Executive verdict

| Finding | Reality in code today |
|--------|------------------------|
| Application identity | `User` + optional Keycloak (`db_user_id` attribute). No second auth system. |
| “HR” in UI | Sidebar group **HR & Staff** → today only **Staff & Roles** (flat). **Target:** one **HR** parent with **dropdown submenu** (Accounting pattern) when `HR_PAYROLL` is ON. |
| Employee master / attendance / leave / salary structure / payslips | **Absent** |
| Sales staff commission | **Absent** (only reload *provider* commission = shop income) |
| Accounting payroll | **Exists** as manual journal accrual/pay over **active Users** (`sourceModule: PAYROLL`) |
| Correct HR approach | New opt-in `HR_PAYROLL` domain: `Employee` profile **linked optionally** to `User`; consume sales attribution later; **post into existing GL payroll / expense paths** |

**Do not** replace User, Role, Branch, Sales, Accounting, Audit, or Permissions.  
**Do not** invent sales commission by rewriting POS — commission is a **Phase 4+ additive** HR calculation consuming `Sale.cashierId` / `RepairTicket.technicianId` / `HirePurchaseAgreement.salesPersonId`.

---

## 1. Existing architecture analysis

### Platform shape (verified)

| Layer | Implementation |
|-------|----------------|
| Tenancy | Shared Postgres schema, `tenantId` on rows |
| Apps | `apps/web` (Next 15), `apps/backend` (Express), `apps/admin` |
| Auth | App JWT HS256 **and/or** Keycloak RS256 (`KEYCLOAK_AUTH_ENABLED`) |
| Branch | `Branch` + `UserBranch`; `x-active-branch-id` / `resolveActiveBranch` |
| RBAC | `Tenant.rolePermissions` matrix (`hide`/`view`/`edit`) + `authorize(roles)` + `requireModuleAccess` |
| Features | `TenantFeature` + `OPT_IN_FEATURES` (default OFF) / always-on modules |
| Engines | Audit, Notification, Configuration, Template, Report, Workflow Validators, Business Rules, Accounting outbox |

Canonical docs: `docs/ARCHITECTURE.md`, `docs/ENTERPRISE_PLATFORM_ARCHITECTURE_BLUEPRINT_10Y.md`.

### What “HR” already means in the product

```
Sidebar group: HR & Staff
  ├── Staff & Roles     →  /dashboard/staff          (flat link — STAFF module, always on)
  └── HR                →  /dashboard/hr             (parent + ChevronDown dropdown — HR_PAYROLL opt-in)
        ├── Overview
        ├── Employees
        ├── Departments & Designations
        ├── Attendance / Shifts / Leave / …         (phased submenu items)
        └── HR Reports

Accounting (unchanged until Phase 6)
  └── Payroll           →  manual GL payroll (ACCOUNTING module)
Finance
  └── Expenses          →  category “Salary” (cash OpEx)
```

There is **no** Employee / Attendance / Leave / SalaryComponent / Payslip model in Prisma yet. The **HR dropdown is a UI/navigation contract** — routes appear as each phase ships; entire **HR** parent is hidden when `HR_PAYROLL` is OFF.

---

## 2. Current User / Role / Branch analysis

### User (Prisma)

| Field | Role |
|-------|------|
| `id`, `tenantId`, `email`, `name`, `password` | Identity + local credential (kept even with KC) |
| `role` ∈ `PLATFORM_ADMIN \| OWNER \| MANAGER \| CASHIER \| TECHNICIAN` | App RBAC role |
| `isActive` | Login gate (no employment lifecycle enum) |
| PIN fields | POS Quick PIN only |
| `UserBranch` | M:N branch assignment (no employment dates) |

**Keycloak:** no `keycloakId` column; linkage via KC attributes `db_user_id`, `tenant_id`, `user_role`.

### Roles vs shop jobs

| App role | Typical shop job | Sales attribution today |
|----------|------------------|-------------------------|
| OWNER | Owner / admin | Can run POS; `Sale.cashierId` = logged-in user |
| MANAGER | Manager | Same |
| CASHIER | Cashier / counter | Primary POS cashier |
| TECHNICIAN | Repair tech | `RepairTicket.technicianId`; may also POS |

There is **no** dedicated `SALESPERSON` role. Hire Purchase has optional `salesPersonId` → `User`.

### Permissions relevant to HR

| Mechanism | Notes |
|-----------|--------|
| Module `STAFF` | Staff list + role matrix |
| Module `ACCOUNTING` | Includes accounting payroll UI (edit for process) |
| Module `FINANCE` | OpEx including free-text Salary |
| Fine-grained `PERMISSIONS` | Almost unused (traceability only) |

**Implication:** HR needs **new module keys** (or a nested permission set) for salary secrecy — do not overload `STAFF` view with full salary access.

### Branch isolation

- Non-owner staff: only assigned branches; zero branches → 403.
- Owner: all active branches; optional scope `all`.
- Staff list already filters non-owners by shared branches.

HR Employee queries must reuse the same branch filters (`assignedBranchIds` / OWNER all).

---

## 3. Current sales commission analysis

### EXISTS — attribution

| Entity | Field | Meaning |
|--------|-------|---------|
| `Sale` | `cashierId`, `cashierName` | Authenticated POS user |
| `RepairTicket` | `technicianId`, `technicianName` | Assigned tech |
| `HirePurchaseAgreement` | `salesPersonId` | Optional HP salesperson |

### EXISTS — “commission” that is **not** employee pay

Daily Reload / recharge-card **provider** commission = **shop income** (COA ~4040), settings in configuration domain `reload`. Must **never** be confused with HR commission.

### MISSING — employee sales / tech commission

No rates, approval, payout, or payroll line generation for staff.

**HR design rule:** Phase 1–3 do **not** invent commission. Phase 4 introduces **HR CommissionRule** that *reads* historical sales/repairs by `userId` / linked `employee.userId` and produces **payroll earnings lines**. POS/sales services stay unchanged.

---

## 4. Current accounting analysis

### Journal-based payroll (exists)

| API | Behavior |
|-----|----------|
| `GET /accounting/payroll/employees` | Active `User`s |
| `POST /accounting/payroll/runs` | Manual lines → `PAYROLL_ACCRUED` journals (optional EPF/ETF) |
| `POST /accounting/payroll/runs/:id/pay` | `PAYROLL_PAID` vs cash/bank |
| Statutory remittance | EPF/ETF remittance journals |

**No `PayrollRun` table** — runs are inferred from `JournalEntry` (`sourceModule: PAYROLL`, `sourceRefId`).

### Dual salary paths (today)

1. **Accounting payroll** — accrual then pay (proper payable).  
2. **Finance expense “Salary”** — immediate cash OpEx in daily closing.

**HR design rule:** Formal payroll posts through **accounting payroll / journals** (extend or wrap existing service). Avoid double-booking via Finance Salary unless tenant explicitly uses cash-only mode (documented setting).

### GL mappings to reuse

`AccountingSettings.defaultAccounts`: `opex`, `salaryPayable`, `epfPayable`, `etfPayable`, payment GL via cash/bank resolvers.

---

## 5. HR requirements (Mobile Shop–focused)

### Must support

- Employees **with** login (`Employee.userId` → `User`) and **without** (cleaners, store helpers, drivers).
- Multi-branch shops; primary branch + optional multi-branch assignment.
- Attendance / shifts suited to counter + repair floor (not enterprise biometric Phase 1).
- Leave with manager approval.
- Configurable salary components + monthly payroll.
- Optional commission from sales/repairs (later).
- Advances / loans separate from Customer Credit / Hire Purchase.
- Payslips via Template Engine.
- Strict salary RBAC + Audit Engine.

### Explicit non-goals (Phase 1–3)

- Biometric devices, geofencing apps, ATS/recruitment CRM, performance OKRs, tax e-filing portals.
- Replacing Staff & Roles or Keycloak.
- Changing reload provider commission.

---

## 6. Reuse vs Extend vs New matrix

| Capability | Classification | Action |
|------------|----------------|--------|
| `User` / Keycloak / JWT | **EXISTING** | Link only; never duplicate login |
| `UserRole` / `rolePermissions` | **EXISTING** | Add module keys `HR`, `HR_SALARY`, `HR_PAYROLL` (or equivalent) |
| `Branch` / `UserBranch` | **EXISTING** | Employee primaryBranch + optional EmployeeBranch; keep UserBranch for app access |
| Staff UI `/dashboard/staff` | **EXISTING** | Remains auth/access admin (flat link); HR ops live under **HR** dropdown when flag ON |
| Accounting payroll journals | **EXISTING** | **Extend** — HR PayrollRun posts via same GL events / wraps `payroll.service` |
| Finance Salary expense | **EXISTING** | Optional legacy path; discourage when HR payroll ON |
| Audit / Notification / Config / Template / Report / Workflow validators / ApprovalRequest | **EXISTING** | Reuse |
| Sales commission engine | **NEW** (additive) | Phase 4 rules consuming attribution FKs |
| `Employee`, dept, designation, attendance, leave, salary masters, payroll entities, advances, loans | **NEW** | Minimum set below |
| Feature `HR_PAYROLL` | **NEW** opt-in | Default OFF |

---

## 7. HR architecture

### Identity split

```
Tenant
  ├── User              ← login, role, UserBranch, POS PIN
  └── Employee          ← HR profile (optional userId)
        ├── Department (tenant master)
        ├── Designation (tenant master)
        ├── primaryBranchId → Branch
        ├── EmploymentStatus + history
        ├── Attendance / Leave / Salary
        └── Payroll lines
```

| Case | Pattern |
|------|---------|
| Cashier with POS | `Employee.userId = User.id`, User.role = CASHIER |
| Cleaner, no app | `Employee.userId = null` |
| Owner | Usually both; Owner may skip attendance |

**Invariant:** Deleting/deactivating User must **not** delete Employee history; unlink or mark User inactive independently of employment status.

### Domain modules (backend)

```
apps/backend/src/modules/hr/
  employees/
  organization/     # department, designation
  attendance/
  shifts/
  leave/
  compensation/     # salary structure, components, employee salary
  payroll/          # runs, lines, payslips — posts to accounting
  advances/
  loans/
  reports/
```

Mount under `/api/v1/hr/*` gated by `HR_PAYROLL` feature + module permissions.

### Configuration domains (Configuration Engine)

| Domain | Purpose |
|--------|---------|
| `hrPolicy` | PIN-less: leave year start, attendance grace defaults, payroll lock day |
| `hrPayslip` | Template key binding |
| `hrCommission` | Phase 4 rule defs (JSON) |

---

## 8. Database impact

### Minimum Phase 1 models (recommended)

| Model | Purpose |
|-------|---------|
| `HrDepartment` | Tenant masters (Sales, Repairs, …) — **configurable**, seeded defaults |
| `HrDesignation` | Tenant masters (Cashier, Technician, …) |
| `Employee` | Profile, codes, links, employment fields |
| `EmployeeDocument` | Metadata + storage key (S3/uploads) |
| `EmploymentEvent` | Auditable lifecycle history (join, transfer, promote, terminate, salary change refs) |

### Phase 2–3

| Model | Purpose |
|-------|---------|
| `HrShift` | Branch-scoped shift definition |
| `EmployeeShift` | Assignment |
| `AttendanceRecord` | Per employee per business date |
| `LeaveType`, `LeaveBalance`, `LeaveRequest` | Leave |

### Phase 4–7

| Model | Purpose |
|-------|---------|
| `SalaryComponent` | Earning/deduction catalog (configurable) |
| `EmployeeSalary` | Current package + effective dates |
| `PayrollPeriod`, `PayrollRun`, `PayrollLine` | Deterministic runs |
| `Payslip` | Snapshot for print |
| `EmployeeAdvance`, `EmployeeLoan`, `LoanInstallment` | Recoveries |

### Explicitly deferred / avoid early

- Full biometric device registry  
- Rotating roster optimizer  
- Multi-currency payroll  
- Parallel COA for HR  

### Employee core fields (Phase 1)

- `tenantId`, `employeeCode` (unique per tenant)  
- `userId?` (unique when set)  
- `fullName`, contacts, emergency contact  
- `departmentId?`, `designationId?`  
- `primaryBranchId`  
- `employmentType` (FULL_TIME / PART_TIME / CONTRACT / CASUAL)  
- `status` (CANDIDATE / ACTIVE / ON_LEAVE / SUSPENDED / RESIGNED / TERMINATED)  
- `joinedAt`, `confirmedAt?`, `leftAt?`  
- `notes?`  

Indexes: `(tenantId, status)`, `(tenantId, primaryBranchId)`, `(tenantId, userId)`.

---

## 9. API design (conventions only — not implement yet)

Match existing: Zod validate · `authenticate` · `ensureTenantAccess` · `requireModuleAccess` · branch assert · `recordAuditEventSafe` · `sendSuccess` / `AppError`.

### Suggested routes (prefix `/hr`)

| Area | Examples |
|------|----------|
| Org | `GET/POST /departments`, `GET/POST /designations` |
| Employees | `GET/POST /employees`, `GET/PATCH /employees/:id`, documents, link-user |
| Attendance | `POST /attendance/check-in`, check-out, list, correct, approve |
| Shifts | CRUD + assign |
| Leave | types, balances, requests, approve/reject |
| Salary | components, employee packages |
| Payroll | periods, runs draft→process→approve→pay, payslips |
| Advances / loans | request, approve, schedule |
| Reports | `/hr/reports/:key` via report-engine filters |

### AuthZ sketch

| Action | Module / level |
|--------|----------------|
| Employee directory | `HR` view |
| Create/edit employee (non-salary) | `HR` edit |
| View salary / bank | `HR_SALARY` view |
| Edit salary | `HR_SALARY` edit |
| Process payroll | `HR_PAYROLL` edit |
| Approve / pay payroll | `HR_PAYROLL` edit + OWNER/MANAGER (or ApprovalRequest) |
| Own leave request | Authenticated employee with linked User |
| Approve leave | Manager + branch overlap |

Platform admins: support-only; no cross-tenant HR data without impersonation controls already used elsewhere.

---

## 10. UI design

### Patterns to reuse

Tailwind · existing tables/modals · `RoleAccessGuard` · Sidebar feature+permission filters · Settings cards · Accounting payroll page as visual reference for runs.

**Sidebar dropdown pattern:** Same as **Accounting**, **Hire Purchase**, **Inventory**, and **Reports** — parent `NavItem` with `submenu: NavSubItem[]`, expand/collapse via `ChevronDown`, active state when any child route matches. Implementation reference: `apps/web/src/components/layout/Sidebar.tsx` (`accountingSubmenu`, `hirePurchaseSubmenu`).

### Sidebar navigation (target layout)

**Nav group label:** `HR & Staff` (unchanged — keeps Staff near HR).

| Sidebar item | Type | Route | Feature | Permission | Notes |
|--------------|------|-------|---------|------------|-------|
| Staff & Roles | **Flat link** | `/dashboard/staff` | `STAFF` | `STAFF` | **Existing** — User access, roles matrix, POS PIN. **Not inside HR dropdown.** |
| **HR** | **Dropdown parent** | `/dashboard/hr` | `HR_PAYROLL` | `HR` | Hidden when feature OFF. First submenu item = Overview. |

#### HR submenu (`hrSubmenu`) — all items under one dropdown

| # | Label | Route | Icon (suggested) | Permission | Phase | requiresEdit |
|---|-------|-------|------------------|------------|-------|--------------|
| 1 | Overview | `/dashboard/hr` | `LayoutDashboard` | `HR` view | 1 | — |
| 2 | Employees | `/dashboard/hr/employees` | `Users` | `HR` | 1 | create/edit → edit |
| 3 | Departments | `/dashboard/hr/departments` | `Building2` | `HR` | 1 | edit for mutate |
| 4 | Designations | `/dashboard/hr/designations` | `IdCard` | `HR` | 1 | edit for mutate |
| 5 | Attendance | `/dashboard/hr/attendance` | `Clock` | `HR` | 2 | correction → edit |
| 6 | Shifts | `/dashboard/hr/shifts` | `Calendar` | `HR` | 2 | edit for assign |
| 7 | Leave | `/dashboard/hr/leave` | `Briefcase` | `HR` | 3 | approve → edit |
| 8 | Salary | `/dashboard/hr/salary` | `DollarSign` | `HR_SALARY` | 4 | view vs edit split |
| 9 | Commission | `/dashboard/hr/commission` | `TrendingUp` | `HR_SALARY` | 4 | preview from sales attribution |
| 10 | Payroll | `/dashboard/hr/payroll` | `Wallet` | `HR_PAYROLL` | 5–6 | process/approve → edit |
| 11 | Payslips | `/dashboard/hr/payslips` | `Receipt` | `HR` | 6 | self-service own payslip if linked User |
| 12 | Advances | `/dashboard/hr/advances` | `CreditCard` | `HR` | 7 | approve → edit |
| 13 | Loans | `/dashboard/hr/loans` | `Landmark` | `HR` | 7 | edit |
| 14 | HR Reports | `/dashboard/hr/reports` | `BarChart3` | `HR` | 8 | — |
| 15 | HR Settings | `/dashboard/hr/settings` | `Settings` | `HR` edit | 1+ | policy defaults via Configuration Engine |

**Visibility rules**

1. **`HR_PAYROLL` OFF** → hide entire **HR** parent (no dropdown). **Staff & Roles** still visible (unchanged).
2. **`HR_PAYROLL` ON** → show **HR** parent; filter each submenu row with `allowsNavAccess(permission)` + feature (same as Accounting children).
3. **Salary / Payroll rows** → require `HR_SALARY` / `HR_PAYROLL` module keys respectively (stricter than general `HR`).
4. **Cashier / Technician** → submenu filtered to own profile, own attendance, own leave request, own payslip where applicable (route guards + API, not sidebar-only).
5. **Phased rollout** → ship submenu entries only when backend for that phase exists (avoid dead links); Overview can show “coming soon” cards until then.

#### Sidebar structure (ASCII)

```
HR & Staff
├── Staff & Roles                    [flat]
└── HR  ▾                            [dropdown parent → /dashboard/hr]
      ├── Overview
      ├── Employees
      ├── Departments
      ├── Designations
      ├── Attendance
      ├── Shifts
      ├── Leave
      ├── Salary
      ├── Commission
      ├── Payroll
      ├── Payslips
      ├── Advances
      ├── Loans
      ├── HR Reports
      └── HR Settings
```

#### Reference nav config (for implementers — not coded in Phase 0)

```ts
// apps/web/src/components/layout/Sidebar.tsx (future)
const hrSubmenu: NavSubItem[] = [
  { href: '/dashboard/hr', icon: LayoutDashboard, label: 'Overview', feature: 'HR_PAYROLL', permission: 'HR' },
  { href: '/dashboard/hr/employees', icon: Users, label: 'Employees', feature: 'HR_PAYROLL', permission: 'HR' },
  { href: '/dashboard/hr/departments', icon: Building2, label: 'Departments', feature: 'HR_PAYROLL', permission: 'HR' },
  { href: '/dashboard/hr/designations', icon: IdCard, label: 'Designations', feature: 'HR_PAYROLL', permission: 'HR' },
  { href: '/dashboard/hr/attendance', icon: Clock, label: 'Attendance', feature: 'HR_PAYROLL', permission: 'HR' },
  { href: '/dashboard/hr/shifts', icon: Calendar, label: 'Shifts', feature: 'HR_PAYROLL', permission: 'HR' },
  { href: '/dashboard/hr/leave', icon: Briefcase, label: 'Leave', feature: 'HR_PAYROLL', permission: 'HR' },
  { href: '/dashboard/hr/salary', icon: DollarSign, label: 'Salary', feature: 'HR_PAYROLL', permission: 'HR_SALARY' },
  { href: '/dashboard/hr/commission', icon: TrendingUp, label: 'Commission', feature: 'HR_PAYROLL', permission: 'HR_SALARY' },
  { href: '/dashboard/hr/payroll', icon: Wallet, label: 'Payroll', feature: 'HR_PAYROLL', permission: 'HR_PAYROLL', requiresEdit: true },
  { href: '/dashboard/hr/payslips', icon: Receipt, label: 'Payslips', feature: 'HR_PAYROLL', permission: 'HR' },
  { href: '/dashboard/hr/advances', icon: CreditCard, label: 'Advances', feature: 'HR_PAYROLL', permission: 'HR' },
  { href: '/dashboard/hr/loans', icon: Landmark, label: 'Loans', feature: 'HR_PAYROLL', permission: 'HR' },
  { href: '/dashboard/hr/reports', icon: BarChart3, label: 'HR Reports', feature: 'HR_PAYROLL', permission: 'HR' },
  { href: '/dashboard/hr/settings', icon: Settings, label: 'HR Settings', feature: 'HR_PAYROLL', permission: 'HR', requiresEdit: true },
]

// Inside navItems group { label: 'HR & Staff', items: [
//   { href: '/dashboard/staff', ... Staff & Roles ... },
//   { href: '/dashboard/hr', icon: UserCheck, label: 'HR', feature: 'HR_PAYROLL', permission: 'HR', submenu: hrSubmenu },
// ]}
```

**`RoleAccessGuard`:** Map `/dashboard/hr/**` paths to `HR` / `HR_SALARY` / `HR_PAYROLL` modules in `pathToPermissionModule` (same pattern as `/dashboard/accounting/*` → `ACCOUNTING`).

### Accounting payroll link (unchanged until Phase 6)

Keep **Finance → Accounting → Payroll** (`/dashboard/accounting/payroll`) until HR payroll posts journals. Then either:

- **A (preferred):** Accounting Payroll becomes read-only + link “Open HR Payroll” → `/dashboard/hr/payroll`, or  
- **B:** Accounting payroll remains manual override for tenants without full HR.

### Screens (Phase order)

1. Employees list/detail, Departments, Designations  
2. Attendance daily board, Shifts  
3. Leave requests + balances  
4. Salary packages  
5. Payroll wizard + payslip print  
6. Advances/loans  
7. Reports dashboard  

---

## 11. Workflow design

### Employment lifecycle

```
CANDIDATE → ACTIVE → ON_LEAVE ↔ ACTIVE
                 → SUSPENDED → ACTIVE | TERMINATED
                 → RESIGNED | TERMINATED
```

Each transition → `EmploymentEvent` + Audit (`HR_EMPLOYEE_*`).

### Leave

```
Employee (linked User) → LeaveRequest DRAFT/SUBMITTED
  → Manager approve/reject (branch-scoped)
  → APPROVED → decrement LeaveBalance
```

Use **ApprovalRequest** or dedicated status machine; optional `WORKFLOW_VALIDATORS` pattern for transition purity later.

### Payroll

```
PayrollPeriod OPEN
  → Run DRAFT (snapshot attendance, salary, commission lines, advances)
  → PROCESSING (deterministic calc)
  → REVIEW
  → APPROVED
  → PAID (call accounting pay / create PAYROLL_PAID)
  → or CANCELLED
```

**Determinism:** Pure calc function `(inputs) → lines`; persist snapshot JSON on run for audit/replay.

---

## 12. Permission matrix (target)

| Capability | OWNER | MANAGER | CASHIER | TECHNICIAN |
|------------|-------|---------|---------|------------|
| Employee view (own branch) | edit* | view/edit | hide / own profile | hide / own |
| Employee create | edit | edit | hide | hide |
| Salary view | edit | view† | hide | hide |
| Salary edit | edit | hide† | hide | hide |
| Attendance self | — | — | edit self | edit self |
| Attendance correct | edit | edit | hide | hide |
| Leave request | — | — | edit self | edit self |
| Leave approve | edit | edit | hide | hide |
| Payroll process | edit | edit† | hide | hide |
| Payroll approve/pay | edit | hide† | hide | hide |

\* Owner always full in matrix normalizer (existing pattern).  
† Tenant-configurable via rolePermissions defaults (Manager salary view yes / edit no recommended).

---

## 13. Security design

| Risk | Control |
|------|---------|
| Salary leakage | Separate `HR_SALARY` / `HR_PAYROLL` modules; never return salary fields on general employee list |
| Documents (NIC, contracts) | Signed URLs / authz download; audit access |
| Cross-tenant | Always `tenantId` from JWT; never trust body tenant |
| Cross-branch | Filter by `resolveActiveBranch` + employee primary/assigned branches |
| Exports | Require edit + audit `HR_EXPORT` |
| Audit payloads | Store amounts in afterJson only when necessary; avoid PIN/password; mask bank account to last4 |
| Session | Existing JWT/KC + blacklist |

---

## 14. Audit design

Use `recordAuditEvent` / `recordAuditEventSafe`.

| eventType (examples) | When |
|----------------------|------|
| `HR_EMPLOYEE_CREATED` / `_UPDATED` / `_STATUS_CHANGED` | Profile lifecycle |
| `HR_EMPLOYEE_USER_LINKED` | Link/unlink User |
| `HR_ATTENDANCE_CORRECTED` | Manager correction |
| `HR_LEAVE_APPROVED` / `_REJECTED` | Leave |
| `HR_SALARY_CHANGED` | Package change (amount in afterJson) |
| `HR_PAYROLL_PROCESSED` / `_APPROVED` / `_PAID` / `_CANCELLED` | Payroll |
| `HR_ADVANCE_*` / `HR_LOAN_*` | Advances/loans |

---

## 15. Accounting integration

```
HR PayrollRun APPROVED
  → build journal lines (earnings → expense; deductions → payables; net → salaryPayable)
  → reuse createPostedJournalEntry / extend payroll.service createPayrollAccrual
  → on PAY: existing payPayrollRun pattern (cash/bank)
  → optional statutory remittance unchanged
```

| Component type | Suggested GL treatment |
|----------------|------------------------|
| Basic + allowances | Debit salary expense (or split COA later) |
| Commission (Phase 4) | Same opex or dedicated commission expense account (config) |
| Employee EPF | Existing epfPayable |
| Advances recovery | Credit advance asset / debit payable reduction |
| Net pay | salaryPayable → cash/bank on pay |

**Do not** create a second ledger.  
**Do not** auto-create Finance `Transaction` Salary rows (would double-count daily closing) unless a tenant setting `hr.mirrorCashExpense` is ON for cash-only shops.

---

## 16. Reports

Reuse report-engine filter context (`tenantId`, branch, date range).

| Report | Phase |
|--------|-------|
| Employee list / headcount | 1 |
| Attendance / late / absence / OT | 2 |
| Leave & balances | 3 |
| Salary summary | 4 |
| Payroll & branch/dept cost | 5–6 |
| Commission summary | 4+ |
| Advances / loans outstanding | 7 |

---

## 17. Notification integration

Extend `dispatchNotification` event types (no new bus):

- `HR_LEAVE_REQUESTED` / `APPROVED` / `REJECTED`  
- `HR_PAYROLL_APPROVED` / `HR_PAYSLIP_READY`  
- `HR_ADVANCE_APPROVED` / `HR_LOAN_APPROVED`  

Channels: in-app first; WhatsApp/SMS optional via existing templates.

---

## 18. AI readiness (no AI implementation now)

Structured data that future agents need:

- Employee ↔ User ↔ Branch links  
- Attendance daily facts  
- PayrollLine snapshots (earnings by component code)  
- Sales attributed to `cashierId` for commission Q&A  

Example future questions become SQL/report over these facts — not free-text HR notes alone.

---

## 19. Stability / performance

| Concern | Mitigation |
|---------|------------|
| Monthly payroll calc | Batch by branch; idempotent run keys; snapshot inputs |
| Attendance volume | One row per employee/day; unique `(tenantId, employeeId, businessDate)` |
| Concurrent runs | Unique open run per period; optimistic lock / status check |
| Report load | Use report-engine pagination; pre-aggregate month tables only if needed later |
| Prod safety | Feature OFF → no routes registered or hard 403; no schema use required for non-HR tenants beyond idle tables |

Migrations must be **additive nullable / new tables only** — no breaking User changes.

---

## 20. Feature flag strategy

| Flag | Default | Effect |
|------|---------|--------|
| **`HR_PAYROLL`** | **OFF** | Hides **HR** sidebar dropdown (all `/dashboard/hr/*`); `/hr/*` API 403; **Staff & Roles** unchanged |

- Add to `OPT_IN_FEATURES` (backend + web mirrors).  
- Trial tenants: follow existing trial = all-on policy **or** keep HR off until explicitly ready (recommend **HR stays opt-in even on trial** to avoid surprising payroll UI — product decision; default recommendation: **opt-in only**).  
- Existing `STAFF` remains always-on for Staff & Roles.  
- Accounting feature remains independent; HR pay posting requires `ACCOUNTING` initialized.

---

## 21. Implementation phases

| Phase | Scope | Exit criteria |
|-------|--------|----------------|
| **0** | This plan + security review | Approved |
| **1** | Flag, masters, Employee CRUD, link User, EmploymentEvent, audits, **HR sidebar dropdown + Overview/Employees/Departments/Designations routes** | Create employee w/ & w/o user; HR menu expands like Accounting |
| **2** | Shifts + Attendance check-in/out + correction | Daily board works per branch |
| **3** | Leave types/balances/requests/approval | Manager approve updates balance |
| **4** | Salary components + EmployeeSalary + **commission rules reading Sale/Repair** (calc only) | Package + commission preview |
| **5** | PayrollPeriod/Run/Line deterministic engine | Draft→Approved snapshot |
| **6** | Payslip template + **GL post/pay** via existing accounting payroll | Paid run = journals |
| **7** | Advances + loans + payroll recovery | Outstanding balances |
| **8** | Reports + notifications | Pack live |
| **9** | Security/perf tests | Salary isolation proven |
| **10** | Staging → production rollout | Flag OFF default; enable per tenant |

**Adjusted vs prompt:** Commission **preview** before full payroll (Phase 4 before 5) so Mobile Shop sees value on POS attribution early without blocking payroll GL.

---

## 22. Testing strategy

| Layer | Cases |
|-------|--------|
| Unit | Payroll pure calc; leave balance; attendance late/OT; commission from fixture sales |
| API | Tenant isolation; branch isolation; salary 403 for cashier; feature OFF 403 |
| Integration | Approve payroll → journal lines balance; pay → cash/bank; no double Finance expense |
| UI | Permission guards; Staff vs Employees separation |
| Regression | POS sale still sets cashierId; reload commission unchanged; Staff CRUD unchanged |

---

## 23. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Confusing reload commission with staff commission | High | Naming: “Sales incentive” / “Staff commission”; docs |
| Double pay via Finance Salary + HR payroll | High | Setting + UI warnings; prefer accounting path |
| Manager over-access to salary | High | Split modules |
| User delete orphans | Medium | Soft-deactivate User; keep Employee |
| Over-modeling Phase 1 | Medium | Stick to minimum tables |
| Accounting not initialized | Medium | Gate payroll pay on accounting init (existing) |
| Expecting built-in sales commission today | — | Communicate **MISSING** until Phase 4 |

---

## 24. Final recommendation

1. **Proceed with Phase 0 approval** of this plan; **do not code HR domain until Phase 1 kickoff is explicit.**  
2. Introduce opt-in **`HR_PAYROLL`** (default OFF).  
3. Keep **`User` = identity**; add **`Employee` = HR profile** with optional link.  
4. Keep **Staff & Roles** as a **sibling flat link**; add **HR** as **one sidebar dropdown** (Accounting pattern) for all HR operations.  
5. Treat current **Accounting Payroll** as the **GL settlement layer** to extend — not a throwaway.  
6. Treat **employee sales commission as net-new**, driven by existing attribution FKs — do not touch POS commission (there is none) and do not alter reload commission.  
7. Reuse Audit, Notification, Configuration, Template, Report, and branch/RBAC middleware everywhere.  
8. Ship **Phase 1 (org + employee)** first for immediate Mobile Shop value; attendance/leave before full payroll.

**ANALYZE → DESIGN → REVIEW → IMPLEMENT** — this document completes ANALYZE + DESIGN for review.

---

## Appendix A — Evidence map (code)

| Topic | Path |
|-------|------|
| User / UserBranch / roles | `apps/backend/prisma/schema.prisma` |
| Auth / KC | `apps/backend/src/modules/auth/`, `utils/keycloakAdmin.ts`, `middleware/auth.middleware.ts` |
| Active branch | `apps/backend/src/utils/active-branch.ts` |
| Role matrix | `modules/tenants/role-permissions.util.ts`, web `lib/role-permissions.ts` |
| Staff API/UI | `modules/users/`, `web/.../dashboard/staff/page.tsx` |
| Features | `modules/tenants/tenant-features.ts`, web `lib/tenant-features.ts` |
| Accounting payroll | `modules/accounting/payroll/payroll.service.ts` |
| Sale cashier | `modules/sales/sales.service.ts`, Sale model |
| Reload commission | `modules/daily-reload/`, configuration domain `reload` |
| Audit / notify / config / template / report | `modules/*-engine/` |
| Sidebar HR label | `web/src/components/layout/Sidebar.tsx` |

## Appendix B — Document control

| Item | Value |
|------|--------|
| Title | Hexalyte Mobile Shop HR & Payroll — Architecture & Implementation Plan |
| Audience | Product + engineering + security review |
| Next step | Phase 0 review sign-off → Phase 1 implementation ticket breakdown |
