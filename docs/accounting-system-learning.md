# Hexalyte Accounting — Learning Doc (Our System)

**Audience:** shop owners / accountants (**how to use**) + developers (**how it works**).  
**Related ADR:** [docs/adr/003-accounting-outbox.md](./adr/003-accounting-outbox.md)  
**In-app manual:** Settings → User Manual → Accounting

---

# Part A — How to use Accounting (shop / accountant)

මේක තමයි day-to-day පාවිච්චිය. POS වලින් විකුණුවා කියලා වෙනම “sales journal” ලියන්න ඕන නෑ — system එක auto-post කරනවා (settings හරි නම්).

## A1. කාටද මේක ඕන?

| Role | භාවිතය |
|------|--------|
| Owner / Manager | Reports (P&L, balance sheet), month close, VAT |
| Accountant | Journals check, AR/AP, cash reconcile, periods |
| Cashier | සාමාන්‍යයෙන් Accounting menu ඕන නෑ — POS + Daily Closing විතරයි |

**පෙර කොන්දේසි**

1. Plan / Admin එකෙන් tenant එකට **ACCOUNTING** feature on  
2. User role එකට **ACCOUNTING** permission  
3. Sidebar එකේ **Accounting** පේනවා ද කියලා බලන්න  

Feature නැත්නම් sidebar එකේ Accounting පේන්නේ නැහැ.

---

## A2. Menu map (කොහෙද යන්නේ)

Sidebar → **Accounting**:

| Menu | URL | මොකද කරන්නේ |
|------|-----|-------------|
| Overview | `/dashboard/accounting` | Init, CoA, status, outbox pending, Sync |
| GL Journals | `.../journals` | Auto + manual journals බලන්න / manual entry |
| GL Reports | `.../reports` | Trial balance, P&L, Balance sheet, Cash flow |
| AR / AP | `.../ar-ap` | Customers owe you / you owe suppliers |
| Cash & Bank | `.../cash-bank` | Cash drawer + bank, transfers, reconcile |
| VAT / Tax | `.../tax` | VAT summary / payment |
| Petty Cash | `.../petty-cash` | Small float expenses |
| Payroll | `.../payroll` | Salary accrual / pay journals |
| Periods | `.../periods` | Month soft/hard close |
| Audit Trail | `.../audit` | Who changed what |
| Settings | `.../settings` | Auto-post, approval limit, account maps |

**වෙනම (Accounting submenu නෙවෙයි):**  
**Daily Closing** → `/dashboard/daily-closing` — දවසේ cash count / day lock.

---

## A3. First-time setup (එක පාරක්)

1. **Accounting → Overview** open කරන්න.  
2. Status **Not initialized** නම් → **Initialize Accounting** click කරන්න.  
3. System එක default Chart of Accounts (1000 Cash, 4000 Sales, …) + current month period හදනවා.  
4. **Settings** යන්න:
   - **Auto-post** = ON (නිර්දේශිතයි) — POS/purchase එකෙන් journals තනියම එනවා  
   - VAT registered නම් VAT / tax settings හරිද බලන්න  
   - විශාල manual journals approve ඕන නම් approval amount set කරන්න  
5. පරණ sales තියෙනවා නම් Overview එකේ **Sync** / process outbox — historical journals catch-up.  
6. **Cash & Bank** බලලා Main Cash / Bank registers හරිද confirm කරන්න.

ඊට පස්සේ daily sales වලට වෙනම journal ලියන්න ඕන නෑ.

---

## A4. Daily workflow (සාමාන්‍ය දවස)

```
රාවේ / දවසේ
  1. POS sales, purchases, repairs, expenses — සාමාන්‍ය විදිහට
  2. (Optional) Accounting → Overview — Outbox pending = 0 ද?
  3. Day end → Daily Closing — cash count → Close day
  4. Variance තියෙනවා නම් GL එකේ Cash Over/Short (5200) journal එකක් එනවා
```

### ඔයා කරන්න ඕන නැති දේ

- සෑම sale එකකටම manual journal එකක් ❌  
- Inventory journal manually ලියලා stock හදන්න ❌ (stock = Inventory module)

### ඔයා කරන්න ඕන දේ

| Situation | කොහෙද |
|-----------|--------|
| Owner withdraw / capital / adjustment | **GL Journals → Manual** |
| Bank deposit (cash → bank) | **Cash & Bank → Transfer** |
| Petty expenses from float | **Petty Cash** |
| Customer credit collection (if not via POS) | **AR / AP** or related payment screens |
| Check profit today / this month | **GL Reports → Profit & Loss** |
| Check books balance | **GL Reports → Trial Balance** |

---

## A5. Screen-by-screen (පාවිච්චි විදිහ)

### Overview
- Initialize (first time)
- See account count, current period, journal count
- **Pending outbox** > 0 නම් → Process / Sync (auto-post off නම් හෝ failed jobs)
- Click an account → ledger (running balance)

### GL Journals
- List: filter by date / source (SALES, PURCHASE, MANUAL, …)
- Open a journal → debit/credit lines බලන්න (තුලනය වෙන්න ඕන)
- **New manual journal:** date + lines (Dr total = Cr total) → Post  
  - Amount approval limit ඉක්මවුවොත් Pending approval
- **Reverse:** mainly for **manual** mistakes (creates opposite entry).  
  Auto sales journals → sale return / credit note භාවිතා කරන්න, journal “delete” කරන්න එපා.

### GL Reports
1. Date range / period තෝරන්න  
2. **Trial Balance** — සියලු accounts; Dr total ≈ Cr total වෙන්න ඕන  
3. **Profit & Loss** — income − expenses (profit)  
4. **Balance Sheet** — assets = liabilities + equity  
5. Export / print as needed for accountant

### AR / AP
- **AR** = customers ණයට ගත්ත බිල් / outstanding  
- **AP** = suppliersට ගෙවන්න තියෙන බිල්  
- Aging / balances බලලා collections & payments track කරන්න  
- Payments usually come from Customers / Suppliers / Finance flows — then GL updates

### Cash & Bank
- Registers: till cash, bank accounts  
- Transfer: cash → bank, bank → cash  
- Reconcile: bank statement vs system  
- Card / UPI clearing accounts තියෙනවා (settlement later)

### VAT / Tax
- VAT-registered shops: output vs input summary  
- Pay VAT → creates payment journal when you record it here

### Petty Cash
- Float එකෙන් small payments (tea, courier, …)  
- Replenish when float low (cash → petty)

### Payroll (Accounting page)
- Accrue salary / pay salary / statutory remittance **journals**  
- Full HR payslips = **HR** module; මෙතන GL side

### Periods (month end)
1. Month ඉවර වුණාම reports review (TB + P&L)  
2. **Soft close** — ඒ month එකට අලුත් journals block  
3. Everything final නම් **Hard close** — P&L → Retained Earnings; month locked  
4. Mistake නම් accountant **Reopen** (permission තියෙනවා නම්)

### Audit Trail
- Who posted / closed / changed — control & review

### Settings
- Auto-post ON/OFF  
- Approval threshold  
- Default account mapping (advanced — wrong map = wrong P&L)  
- Currency / FY start

### Daily Closing (separate menu)
1. Open **Daily Closing**  
2. Select branch / date  
3. Count physical cash → enter denominations / total  
4. System shows expected vs actual → variance  
5. **Close day** — day lock (feature on නම් ඒ දවසේ ops restrict)  
6. Variance ≠ 0 → accounting gets over/short journal

---

## A6. Monthly checklist (owner / accountant)

- [ ] All days closed (Daily Closing) for the month  
- [ ] Outbox pending = 0  
- [ ] Trial Balance balances  
- [ ] P&L looks sane (sales, COGS, expenses)  
- [ ] AR / AP aged and followed up  
- [ ] Bank reconciled  
- [ ] VAT return numbers (if applicable)  
- [ ] Soft close → (later) Hard close  

---

## A7. Common mistakes

| Mistake | Right way |
|---------|-----------|
| Every sale එකට manual journal | Auto-post; only adjust via returns / manual when needed |
| Hard-closed month එකට backdate entry | Reopen period (controlled) or post in open month with note |
| Cash short ignore කරන එක | Daily Closing variance → investigate + journal already posted |
| “Delete” auto journal | Use sale return / credit note / proper reverse flow |
| Accounting OFF තියා reports බලන එක | Enable + Initialize first |
| Stock value journal විතරක් ලියලා inventory හදන එක | Fix stock in Inventory / GRN — GL follows ops |

---

## A8. Quick Sinhala summary

1. **Enable + Initialize** එක පාරක්.  
2. **Auto-post ON** තියාගෙන POS / purchase සාමාන්‍ය විදිහට.  
3. **Day end** → Daily Closing.  
4. **Week/Month** → Reports (TB, P&L), AR/AP, bank reconcile.  
5. **Manual journal** = adjustments විතරක්.  
6. **Month end** → Period soft/hard close.

---

# Part B — How it works (developers)

## 1. Big picture (1 minute)

Hexalyte owns a **tenant-scoped double-entry General Ledger (GL)**.

| Layer | What it is | Where |
|--------|------------|--------|
| Feature flag | `ACCOUNTING` on tenant/branch | `tenant-features.ts` |
| Backend module | GL APIs + journal engine | `apps/backend/src/modules/accounting/` |
| Web UI | Tenant dashboard | `/dashboard/accounting/*` |
| Daily cash close | Ops day-lock (feeds GL only for cash variance) | `/dashboard/daily-closing` + `modules/daily-closing/` |

**Mental model:**

```
POS / Purchase / Repair / Wholesale / Finance
        │
        ▼
  emit*Accounting()  →  AccountingOutbox  →  processor  →  JournalEntry + JournalLine
        │                                                      │
        └─ never write journals from sales code directly ──────┘
                                                              ▼
                                                    Reports = sum of POSTED lines
```

Sales must succeed even if GL is slow. That is why we use the **outbox**, not “create journal inside the sale transaction”.

---

## 2. Turn it on (first-time path)

1. Tenant gets Enterprise-style **`ACCOUNTING`** feature enabled (admin / plan).
2. Enabling feature calls init (`accounting-feature.util.ts` → `accounting-init.service.ts`).
3. Init seeds:
   - Mobile-shop **Chart of Accounts** (`seed/mobile-shop-coa.seed.ts`)
   - Per-branch **Cash on Hand** GL + `CashAccount`
   - Current month **`AccountingPeriod`**
   - **`AccountingSettings`** (default account map, currency, `autoPostEnabled`, VAT flags)
4. UI: **Accounting → Initialize / Status** (`/dashboard/accounting`).

If accounting is off or not initialized, emit helpers **no-op** (ops still work; no GL).

**API base:** `/api/v1/accounting`  
**Auth:** login + `enforceModuleAccess('ACCOUNTING')` + branch feature middleware.

---

## 3. Core data model

### 3.1 Settings — `AccountingSettings`

One row per tenant.

Important fields:

- `autoPostEnabled` — if false, outbox rows stay pending until process/sync
- `vatEnabled` / tax mapping
- `requireApprovalAbove` — large **manual** journals need approval
- `defaultAccounts` — map logical keys (`ar`, `salesMobile`, `cogsMobile`, …) → `GlAccount.id`
- `initializedAt`

### 3.2 Chart of Accounts — `GlAccount`

Seeded codes (mobile shop defaults):

| Code | Name | Type |
|------|------|------|
| 1000 | Cash on Hand | ASSET |
| 1100 | Bank — Main | ASSET |
| 1200 | Accounts Receivable | ASSET |
| 1300 / 1310 / 1320 | Inventory (mobile / accessory / parts) | ASSET |
| 2100 | Accounts Payable | LIABILITY |
| 2200 / 2210 | VAT output / input | LIABILITY / ASSET |
| 3000 / 3100 | Owner Equity / Retained Earnings | EQUITY |
| 4000–4040 | Revenue (mobile, accessory, service, repair, reload) | INCOME |
| 5000–5020 | COGS | EXPENSE |
| 5100 | Operating Expenses | EXPENSE |
| 5200 | Cash Over / Short | EXPENSE |
| 5999 | Sales Returns & Allowances | INCOME (contra) |

Logical keys live in `DEFAULT_ACCOUNT_KEYS` in the seed file — posters resolve accounts through settings, not hard-coded IDs.

### 3.3 Journals — `JournalEntry` + `JournalLine`

- **Double-entry:** every line is debit **or** credit; totals must balance (2 decimal places).
- Statuses: `DRAFT` → `PENDING_APPROVAL` → `APPROVED` → `POSTED` (+ reverse via new opposite entry).
- `sourceModule`: `SALES`, `PURCHASE`, `WHOLESALE`, `MANUAL`, …
- Idempotency: unique `(tenantId, sourceRefType, sourceRefId, sourceEvent)`.

There is **no separate ledger table**. Account balance = sum of POSTED `JournalLine` amounts.

### 3.4 Periods — `AccountingPeriod`

- Name format: `YYYY-MM` (Asia/Colombo).
- Auto-created when first journal hits that month.
- `OPEN` → `SOFT_CLOSED` (no new posts) → `HARD_CLOSED` (P&L closed into Retained Earnings `3100`).

### 3.5 Outbox + dedupe

| Model | Role |
|-------|------|
| `AccountingOutbox` | Queue of “please post this event” |
| `IntegrationLink` | Proven post already happened for `(tenant, sourceType, sourceId, eventType)` |

---

## 4. The outbox lifecycle (must know)

```
1. Business TX commits (sale / PO / wholesale invoice / …)
2. emit*Accounting() upserts AccountingOutbox (idempotent)
3. processAccountingOutbox() (inline if autoPostEnabled, or via /integration/process)
4. Source reader loads the document
5. Auto-journal engine / wholesale posters create POSTED journal
6. IntegrationLink written so retries never double-post
```

**Rule (ADR-003):** operational modules **enqueue outbox**. They must **not** call `createPostedJournalEntry` themselves.

Exceptions (journals created inside accounting module directly):

- Manual journals
- Cash/bank transfers & reconciliation
- Petty cash, payroll, VAT payment
- Period hard-close journal

---

## 5. What creates which journal?

Handled in `integration/accounting-processor.service.ts`.

| Event | Source | Typical effect |
|-------|--------|----------------|
| `SALE_CREATED` | `Sale` | Dr cash/bank/AR/clearing · Cr revenue (+ VAT) |
| `SALE_COGS` | `Sale` | Dr COGS · Cr inventory |
| `SALE_RETURN_*` | `SaleReturn` | Reverse revenue / restore inventory |
| `PURCHASE_RECEIVED` | `PurchaseOrder` | Dr inventory (+ VAT input) · Cr AP/cash |
| `PURCHASE_RETURN_*` | `PurchaseReturn` | Reverse purchase |
| `EXPENSE_CREATED` | `Transaction` | Dr opex · Cr cash/bank |
| `REPAIR_DELIVERED` / COGS | `RepairTicket` | Repair income + parts COGS |
| `AR_PAYMENT_RECEIVED` | `Transaction` | Dr cash · Cr AR |
| `AP_PAYMENT_MADE` | `Transaction` | Dr AP · Cr cash/bank |
| `DAILY_CLOSING_VARIANCE` | `DailyClosing` | Cash over/short ↔ cash |
| `HP_*` | Hire purchase | Agreement + installment journals |
| `WHOLESALE_INVOICE_*` | Wholesale invoice | Revenue + COGS |
| `WHOLESALE_CREDIT_NOTE_*` | Credit note | Contra |
| `WHOLESALE_RECEIPT` | Dealer payment | Receipt vs dealer AR |

COGS events run at **lower priority** so revenue/inventory primary events post first.

**Emit call sites (examples):**

- Sales → `emitSaleAccounting`
- Suppliers → purchase / AP payment emits
- Daily closing → `emitDailyClosingAccounting`
- Wholesale → `wholesale/sale/wholesale-accounting.ts`

**Catch-up:** `POST /accounting/integration/sync` scans historical ops and enqueues missing outbox rows.  
Note: wholesale historical sync may still rely mainly on **live emit** — check `syncOutboxForTenant` when adding backfill.

---

## 6. Example: a simple cash sale

1. Cashier completes sale in POS.
2. Sale row + stock movements commit.
3. Outbox gets `SALE_CREATED` (+ `SALE_COGS` if inventory items).
4. Processor posts roughly:

```
Dr  1000 Cash              11,800
    Cr  4000 Sales — Mobile          10,000
    Cr  2200 VAT Output               1,800

Dr  5000 COGS — Mobile      7,000
    Cr  1300 Inventory — Mobile       7,000
```

(Exact accounts depend on product class, payment mix, VAT settings.)

Repair-linked sales may be skipped in the sale poster to avoid double-counting with repair journals.

---

## 7. Daily closing vs period close

| | Daily closing | Period close |
|--|---------------|--------------|
| Purpose | Count till cash for a **business day / branch** | Lock a **calendar month** in GL |
| UI | `/dashboard/daily-closing` | `/dashboard/accounting/periods` |
| GL impact | Only **cash variance** journal if |variance| ≥ 0.01 | Soft = block posts; Hard = close P&L → `3100` |
| Day lock | Can block POS ops on closed day when feature on | Does not replace day lock |

Do not confuse them: day close is cash ops; period close is books lock.

---

## 8. Manual journals, approval, reverse

- UI: **Accounting → Journals**
- Create via `POST /journals/manual`
- If amount above `requireApprovalAbove` → `PENDING_APPROVAL`
- **Reverse** endpoint is for **manual** journals (creates opposite POSTED entry).
- Auto-journals should be corrected by **business reversal** (sale return, credit note, etc.), not by casually reversing the GL line in isolation.

---

## 9. Reports (read model)

`reports/gl-reports.service.ts` builds from POSTED lines only:

- Trial balance
- Profit & loss
- Balance sheet
- Cash flow (simplified / derived)

Drill into one account: `GET /coa/accounts/:id/ledger`.

---

## 10. Other accounting surfaces

| Area | What it does | Service |
|------|----------------|---------|
| AR / AP | Subledger views + payment posting | `subledgers/*` |
| Cash & Bank | Registers, transfers, clearing, reconcile | `cash-bank.service.ts` |
| Petty cash | Expense / replenish | `petty-cash.service.ts` |
| Tax | Tax codes, VAT summary, VAT payment | `tax.service.ts` |
| Payroll | Accrual / payout / EPF·ETF remittance journals | `payroll.service.ts` |
| Audit | Accounting audit events | `audit.service.ts` |

Web routes mirror these under `/dashboard/accounting/...`.

---

## 11. Multi-tenant & branch rules

- Every GL row has **`tenantId`**.
- Feature checked **per branch** (`isFeatureEnabledForBranch`).
- Settings are **tenant-wide** (one `AccountingSettings`).
- Cash GLs can be **per branch** (`1000-{suffix}`).
- Reports/journals often filter by active `branchId`.

---

## 12. Hard rules (don’t break these)

1. **Balance** every journal (validator enforces).
2. **Outbox for ops → GL**; no direct journal from sales/suppliers/wholesale.
3. **Idempotent** keys on outbox, IntegrationLink, and journal source fields.
4. Respect **period soft/hard close**.
5. Honour **`autoPostEnabled`** and feature/init gates.
6. Prefer **source reversal** over ad-hoc reverse of auto journals.
7. Opening balances use special events (`OPENING_CUSTOMER_AR` / `OPENING_SUPPLIER_AP`) — not fake revenue.

---

## 13. How to add a new auto-journal source

Checklist:

1. Define **event type** string (stable forever).
2. Add **`emitXAccounting()`** in the operational module (same TX or after commit + upsert).
3. Add **source reader** under `integration/source-readers/`.
4. Add **poster** in `auto-journal.engine.ts` or a dedicated file (like `wholesale-journals.ts`).
5. Wire **case** in `accounting-processor.service.ts` (set priority if COGS-like).
6. Ensure **IntegrationLink** / journal source uniqueness keys match.
7. Extend **`syncOutboxForTenant`** if historical backfill is required.
8. Add a regression test around balanced lines + idempotent re-process.

---

## 14. File map (start here)

| File | Learn this |
|------|------------|
| `accounting.routes.ts` | All HTTP endpoints |
| `accounting-init.service.ts` + `seed/mobile-shop-coa.seed.ts` | What gets created on init |
| `integration/accounting-events.service.ts` | Emit helpers |
| `integration/accounting-outbox.service.ts` | Queue + sync |
| `integration/accounting-processor.service.ts` | Event → poster switchboard |
| `integration/auto-journal.engine.ts` | Retail sale/purchase/repair recipes |
| `integration/wholesale-journals.ts` | Wholesale recipes |
| `journals/journal-create.service.ts` | How a POSTED entry is written |
| `journals/journal-validator.util.ts` | Balance rules |
| `periods/period-close.service.ts` | Soft/hard close |
| `reports/gl-reports.service.ts` | How TB / P&L / BS are computed |
| `docs/adr/003-accounting-outbox.md` | Why outbox exists |

Web entry: `apps/web/src/app/(dashboard)/dashboard/accounting/`.

---

## 15. Suggested study order (you)

**Users / accountants:** Part A (A3 → A4 → A5 → A6) first, then try one real day on a demo tenant.

**Developers:**
1. Enable ACCOUNTING on a demo tenant → open `/dashboard/accounting` → Initialize.  
2. Read CoA seed + Settings default map.  
3. Make one cash sale → watch Outbox → Journals.  
4. Read ADR-003 + processor switchboard.  
5. Trace one sale through `sale.reader.ts` → `postSaleJournal`.  
6. Run Trial Balance / P&L for that day.  
7. Soft-close a period and try posting (should fail).  
8. Close a daily cash day with intentional variance → see `5200` journal.  
9. (Optional) Wholesale invoice → wholesale posters.

---

## 16. Quick glossary (Hexalyte meaning)

| Term | Here it means |
|------|----------------|
| GL | Our `GlAccount` + posted `JournalLine`s |
| Journal | `JournalEntry` header + lines |
| Outbox | `AccountingOutbox` work queue |
| Auto-post | Processor runs after emit when settings allow |
| Soft close | Month locked for new journals |
| Hard close | Month locked + P&L zeroed to retained earnings |
| Daily closing | Branch cash count / day lock (ops) |

---

*Part A = how to use · Part B = how it works. Update when you add a new outbox event or change the Accounting menu.*
