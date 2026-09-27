# Generic Payment Method, Fee & Clearance — Technical Design

**Status:** Implemented (Phase 1, retail POS). Decisions used: Mark as Clear = Owner/Manager role; reverse = admin password; fee non-refundable on returns/void; cheque/transfer clearance included; separate `Payment Surcharge Income` account. Fees are not allowed on the Cash method (keeps daily-closing expected cash correct).

**Not yet done:** cash-basis Finance P&L / Daily Closing buckets for fee income and provider charges (GL reports already include them); pending-clearance list UI in Cash & Bank (API `GET /sales/payment-clearance/pending` exists); repairs / HP / wholesale fees.
**Scope:** Retail POS first. Repairs / Hire Purchase / Wholesale are listed as later phases.
**Principle:** Extend the existing payment settings, `SalePayment`, auto-journal engine and Cash & Bank. No provider-specific code (no "Koko", "Card" branches). Every new behaviour is off until a tenant configures it.

---

## 1. Current architecture (as inspected)

### 1.1 Payment method configuration

| Layer | Where | Today |
|---|---|---|
| Storage | `Tenant.paymentMethodSettings Json?` (`schema.prisma:463`) | `{ methods: [{ id, key, label }] }` |
| Normalizer (backend) | `tenants/payment-method-settings.util.ts:62-97` | Rebuilds each row as **only** `{id,key,label}`; forces Cash; PATCH replaces the whole array |
| API | `GET/PATCH /tenants/:id/payment-method-settings` (`tenants.routes.ts:95-96`) | GET: all staff roles. PATCH: OWNER/MANAGER + `SETTINGS` edit |
| Normalizer (web) | `apps/web/src/lib/payment-methods.ts` `sanitize` (L81-109) | Also drops unknown fields |
| Hook | `usePaymentMethods()` | Used by 10 screens (POS, repairs, HP, returns, customers, suppliers, AR/AP, report) |
| Settings UI | `settings/page.tsx` payments tab (L1465-1563) | Label + key badge + delete |

`key` is the Prisma `PaymentMethod` enum (`CASH, CARD, UPI, BANK_TRANSFER, WALLET, CHEQUE`; system-only `CREDIT, STORE_CREDIT`). Custom labels (e.g. a BNPL provider) map to one of these keys.

### 1.2 POS sale → DB

- `POSOverlay.tsx` builds at most three payment rows (L2972-2983): `STORE_CREDIT`, one money row `{ method: key, amount: payNowForSale, reference? }`, `CREDIT` for due. **Only the key is sent; the label is lost.** No split money payments from POS.
- `POST /sales` → `salesService.create()` (`sales.service.ts:85-392`). **No zod validation.** `total`, `paidAmount`, `dueAmount`, `status` come from the client; `payments: { create: body.payments }` (L218).
- After the DB transaction, one Finance `Transaction` (INCOME / "Sales") is created with `amount = sum(money payments)` and `paymentMethod = first money method` (L357-389).
- `void emitSaleAccounting()` queues `SALE_CREATED` + `SALE_COGS` in the accounting outbox (fire-and-forget).

### 1.3 Accounting (GL)

- `postSaleJournal` (`auto-journal.engine.ts:66-196`): **Dr** one line per non-CREDIT payment via `resolvePaymentGlAccountId`, **Dr** AR for due; **Cr** revenue (`subtotal − discount`, split by item type) and VAT. Must balance (`assertBalanced`).
- `resolvePaymentGlAccountId` (`ar-ap-payment.service.ts:45-49`):
  - `CASH` → branch Main Cash GL
  - `CARD` → `cardClearing` (1110)
  - `UPI`/`WALLET` → `upiClearing` (1120)
  - `BANK_TRANSFER`/`CHEQUE` → `bank` (1100)
- Idempotency: `JournalEntry` unique on `(tenantId, sourceRefType, sourceRefId, sourceEvent)` + `IntegrationLink`.

### 1.4 Cash & Bank

- Balances are **GL-only** (`cash-bank.service.ts` `glBalanceForAccount`), not from `Transaction` rows.
- Registers: `CashAccount` (per branch), `BankAccount`, and two virtual CLEARING registers (card, UPI).
- `settleClearingAccount` (L358-382) = lump-sum transfer Dr Bank / Cr Clearing. **No fee split, not linked to any sale payment, reference not stored.** UI: "Clearing accounts → Settle" on `/dashboard/accounting/cash-bank`.

**Key finding:** card/wallet money *already* goes to a clearing account, not Main Bank. What is missing is (a) per-payment tracking, (b) the provider deduction, (c) a per-method, configurable clearing account, (d) any clearance for `BANK_TRANSFER`/`CHEQUE` (they hit Bank immediately).

### 1.5 Sales History

- `sales/page.tsx` `SaleDetailsModal` (L789-1225). Payments section L1060-1078 renders `ChequePaymentMeta` (key, amount, reference).
- Actions gated by `canEdit && canManage` (OWNER/MANAGER/PLATFORM_ADMIN).
- The modal uses the list row (no refetch) → after actions we patch `liveSale` and call `onChanged()`.

### 1.6 Profit / Daily closing

- Revenue = `SaleItem.total` (not payments). Expenses = EXPENSE `Transaction` rows by category.
- Daily closing buckets payments by `SalePayment.method` (cash / card / QR / bank). Card/QR are informational; `expectedCash` uses CASH only.
- No payment-fee concept anywhere in retail. (`billing/helapos-fees.ts` is Hexalyte's own subscription billing — unrelated.)

### 1.7 Void / return / edit (important for new data)

| Flow | What happens to payments | Risk for new fields |
|---|---|---|
| Return | `SalePayment` untouched; refund = item value | Fee stays with the sale (fine if non-refundable) |
| Void | Full return to CREDIT/store credit; `SALE_CREATED` journal **not** reversed (pre-existing gap) | A cleared payment must not be voided silently |
| Edit (`updateSaleInvoice`) | **Deletes and re-creates all `SalePayment` rows** (`createMany`, L722-731) | Would wipe fee/clearance snapshot → must be handled |

---

## 2. Design goals → decisions

| Requirement | Decision |
|---|---|
| Generic, no hard-coding | All behaviour driven by fields on the tenant method config; code never checks labels |
| Enable/disable, never delete history | `enabled` flag on method; disabled methods hidden only at *checkout* sites; history keeps label snapshot |
| Customer fee, separately identifiable | Fee stored in **new columns**; `Sale.total` and `SalePayment.amount` keep meaning "sale value" |
| Clearance + account | Per-method `clearanceRequired` + `clearanceGlAccountId`; per-payment `clearanceStatus` |
| Mark as Clear with deduction | New `PaymentClearance` record + one balanced journal |
| Use existing accounting | Journals through `createPostedJournalEntry`, `sourceModule: CASH_BANK`, idempotent keys |
| No double income | Sale journal untouched; fee income is a separate, fee-only journal; provider deduction booked only at clearance |
| Cash & Bank is source of truth | Clearing and destination balances move only via GL journals (as today) |
| Monthly system charge separate | Recorded through existing Expenses with a dedicated category; never mixed with per-sale deduction |
| Immutable history / no recalculation | Fee & clearance settings **snapshotted** on each `SalePayment` at sale time |
| Safe defaults | `enabled=true`, `feeEnabled=false`, `feeRate=0`, `clearanceRequired=false` → identical behaviour to today |

### Money model (why fee is kept outside `total`)

Many code paths assume `sum(non-credit payments) + AR == subtotal − discount + tax` (sale journal balance, edit recompute, returns, daily closing, Finance `Transaction`). Putting the fee inside `Sale.total` or `SalePayment.amount` would break all of them. So:

- `Sale.total` = sale value (unchanged meaning)
- `SalePayment.amount` = portion of sale value paid by this method (unchanged meaning)
- `SalePayment.customerFeeAmount` = extra charged to the customer on top (new)
- **Customer paid** = `amount + customerFeeAmount` (computed, shown on receipt/details)

---

## 3. Database changes (additive only)

### 3.1 Tenant method config (JSON, no migration needed)

`Tenant.paymentMethodSettings.methods[]` gains optional fields:

```ts
type TenantPaymentMethod = {
  id: string
  key: PaymentMethodKey          // unchanged
  label: string                  // unchanged
  enabled?: boolean              // default true
  fee?: {
    enabled: boolean             // default false
    type: 'PERCENT' | 'FIXED'    // default 'PERCENT'
    rate: number                 // default 0  (percent, or LKR if FIXED)
    effectiveFrom?: string       // ISO; rule applies to sales on/after this
    version: number              // increments on every fee change
  }
  feeHistory?: Array<{ version: number; type: 'PERCENT'|'FIXED'; rate: number; enabled: boolean; effectiveFrom: string; changedBy: string; changedAt: string }>
  clearance?: {
    required: boolean            // default false; always false for key CASH
    glAccountId?: string         // default resolved from key (see 5.1)
    expectedDeductionRate?: number // optional hint pre-filled in Mark as Clear
  }
}
```

Both normalizers (`payment-method-settings.util.ts`, web `sanitize`) must **preserve** these fields and apply defaults. Missing fields ⇒ today's behaviour.

### 3.2 `SalePayment` — new nullable/defaulted columns

```prisma
enum PaymentClearanceStatus {
  NOT_REQUIRED
  PENDING
  CLEARED
}

model SalePayment {
  // existing: id, saleId, method, amount, reference, paidAt
  methodConfigId     String?                                  // tenant method id at sale time
  methodLabel        String?                                  // label snapshot ("Genie", "eZ Cash", ...)
  customerFeeAmount  Float                  @default(0)
  feeType            String?                                  // 'PERCENT' | 'FIXED' snapshot
  feeRate            Float?                                   // snapshot
  feeVersion         Int?                                     // snapshot
  clearanceStatus    PaymentClearanceStatus @default(NOT_REQUIRED)
  clearanceGlAccountId String?                                // snapshot of where money is parked
  clearances         PaymentClearance[]
}
```

### 3.3 `Sale` — one denormalized column

```prisma
customerFeeTotal Float @default(0)   // sum of SalePayment.customerFeeAmount
```

### 3.4 New `PaymentClearance` table

```prisma
model PaymentClearance {
  id                  String   @id @default(cuid())
  tenantId            String
  branchId            String
  saleId              String
  salePaymentId       String?          // nullable: survives sale-edit re-creation (see 7.3)
  invoiceNumber       String
  methodConfigId      String?
  methodLabel         String?
  grossAmount         Float            // amount + customerFeeAmount held in clearing
  providerDeduction   Float            // commission/fee deducted by provider
  netAmount           Float            // grossAmount − providerDeduction (actually received)
  destinationType     String           // 'CASH' | 'BANK'
  destinationId       String           // CashAccount.id or BankAccount.id
  clearedAt           DateTime         // settlement date (journal date)
  reference           String?
  journalEntryId      String?
  status              String   @default("ACTIVE")  // 'ACTIVE' | 'REVERSED'
  reversedAt          DateTime?
  reversedBy          String?
  createdBy           String
  createdAt           DateTime @default(now())

  @@index([tenantId, saleId])
  @@index([tenantId, clearedAt])
}
```

### 3.5 GL accounts (lazy-created, not a migration)

Two new default-account keys, created on first use via the existing accounting init/ensure path:

| Key | Code | Name | Type |
|---|---|---|---|
| `paymentFeeIncome` | 4050 | Payment Surcharge Income | INCOME (other income) |
| `paymentProviderFees` | 5150 | Payment Provider Charges | EXPENSE |

Per-method clearing accounts are ordinary `GlAccount` rows (ASSET, subtype BANK, like 1110/1120). Settings offers "Create clearing account" → e.g. `1130 BNPL Clearing`.

---

## 4. API changes

| Endpoint | Change |
|---|---|
| `GET/PATCH /tenants/:id/payment-method-settings` | Accept/return new optional fields. PATCH appends to `feeHistory` when fee changes; rejects `clearance.required` for key `CASH`; validates `rate` (0–100 for PERCENT, ≥0 FIXED) |
| `POST /sales` | Accepts optional `methodConfigId`, `customerFeeAmount` per payment. **Server recomputes the fee** from the rule effective at the sale date (handles offline replay) and rejects a mismatch > 0.01 LKR. Server sets snapshots + `clearanceStatus`. Old clients that send neither field ⇒ fee 0, status NOT_REQUIRED |
| `GET /sales/:id/payments/:paymentId/clearance-preview` *(optional)* | Returns gross, suggested deduction, destinations |
| `POST /sales/:id/payments/:paymentId/clear` | Body `{ providerDeduction, destinationType, destinationId, clearedAt, reference }`. OWNER/MANAGER. Only when status PENDING. Creates `PaymentClearance`, posts journal, sets status CLEARED, all in one DB transaction |
| `POST /sales/:id/payments/:paymentId/clear/reverse` | OWNER + admin password. Posts reversal journal, marks clearance REVERSED, status back to PENDING |
| `GET /payments/pending-clearance` | List for a "Pending clearance" filter/report (branch, method, date range) |
| `GET/POST /accounting/gl-accounts` (existing) | Reused for picking/creating clearing accounts |

All new routes live in the existing sales router (`enforceModuleAccess('POS')`) with `authorize('OWNER','MANAGER')`, so managers can clear without needing ACCOUNTING edit.

---

## 5. Accounting flows

### 5.1 Clearing account resolution (generic)

New helper `resolveSalePaymentDebitAccount(payment)`:

1. If `payment.clearanceStatus !== 'NOT_REQUIRED'` and `payment.clearanceGlAccountId` → use it.
2. Else → existing `resolvePaymentGlAccountId(key)` (unchanged).

Default `clearance.glAccountId` when a method turns on clearance: CARD → `cardClearing`, UPI/WALLET → `upiClearing`, BANK_TRANSFER/CHEQUE → a new `chequeClearing` (lazy). Never Main Cash or Main Bank (validated).

### 5.2 At sale time (method with fee 3% and clearance on; sale value 10,000)

**Existing `SALE_CREATED` journal** — only change: the payment debit line uses 5.1 (for old sales and default config this is identical to today).

| Dr | Cr | Amount |
|---|---|---|
| Method clearing (e.g. 1130) | | 10,000 |
| | Sales revenue | 10,000 |

**New `PAYMENT_FEE_COLLECTED` journal** (only when `customerFeeTotal > 0`; `sourceRefType: 'Sale'`, `sourceEvent: 'PAYMENT_FEE_COLLECTED'`, idempotent):

| Dr | Cr | Amount |
|---|---|---|
| Same debit account as the payment | | 300 |
| | Payment Surcharge Income (4050) | 300 |

Revenue is not duplicated: sale revenue stays 10,000; the 300 is a separate income line.

### 5.3 Mark as Clear (provider deducts 350, sends 9,950 to bank)

`sourceModule: CASH_BANK`, `sourceRefType: 'PaymentClearance'`, `sourceRefId: clearance.id`, `sourceEvent: 'CLEARED'`:

| Dr | Cr | Amount |
|---|---|---|
| Destination (Main Bank / Main Cash GL) | | 9,950 |
| Payment Provider Charges (5150) | | 350 |
| | Method clearing (1130) | 10,300 |

Clearing goes to zero for this payment; Cash & Bank shows 9,950 in bank; profit shows +300 surcharge income and −350 provider charges.

Reversal: `sourceEvent: 'CLEARANCE_REVERSED'`, exact mirror lines.

### 5.4 No Finance `Transaction` duplication

- Sale `Transaction` (INCOME "Sales") stays **sale value only** (unchanged).
- Fee income and provider deduction are **not** written as `Transaction` rows (that would trigger `postExpenseJournal` and double-post). Instead:
  - Daily closing / Finance P&L / profit allocation read two new buckets directly: `paymentFeeIncome` (from `SalePayment.customerFeeAmount`, by sale date) and `paymentProviderCharges` (from active `PaymentClearance.providerDeduction`, by `clearedAt`).
  - GL reports already see them via the journals.

### 5.5 Monthly system charge (e.g. provider's monthly subscription)

Recorded through the **existing Expenses** screen with a seeded category `Payment Provider Monthly Charge`. It flows through the normal EXPENSE `Transaction` → `postExpenseJournal` path. It is never deducted in Mark as Clear and never mixed with per-sale fees. Optional later: a reminder, not auto-posting.

### 5.6 Tenants without the ACCOUNTING feature

Fee, snapshots, `PaymentClearance` and statuses still work (operational tracking + P&L buckets). Journals are queued only when accounting auto-post is enabled, exactly like sales today.

---

## 6. Frontend changes

| Surface | Change |
|---|---|
| Settings → Payments (`settings/page.tsx`) | Per method: Enabled toggle; Fee (off / % / fixed, rate, effective from); Clearance required + clearing account picker (+ "create clearing account"); expected deduction hint. Editable by `SETTINGS` edit only. Delete stays but shows "Disable instead" when the method has history |
| `payment-methods.ts` | Preserve new fields; add `computeCustomerFee(method, amount)` (shared rounding: 2dp); add `useCheckoutPaymentMethods()` = enabled only. `usePaymentMethods()` keeps returning all (report, history labels) |
| POS checkout (`POSOverlay.tsx`) | Grid uses enabled methods. When selected method has a fee and `payNowForSale > 0`: show "Payment fee (3%) +300" and "Customer pays 10,300" under Total (L4725); cash validation uses customer-pays amount; payload adds `methodConfigId`, `methodLabel`, `customerFeeAmount`. No fee ⇒ UI identical to today |
| Receipts (thermal, stock form, A4) | Extra line "Payment fee" + "Customer paid" only when `customerFeeTotal > 0`; show label snapshot instead of key |
| Sales History → Sale Details | Payments rows show label (fallback key), fee, customer paid, clearance badge (Pending / Cleared on date → account, ref). "Mark as Clear" button for PENDING rows (OWNER/MANAGER). Modal: gross (read-only), provider deduction (pre-filled from hint), net (computed), destination (Main Cash / bank accounts), date, reference |
| Sales History list | Optional filter "Pending clearance" |
| Cash & Bank | Clearing register cards list pending payments count/amount per clearing account; existing bulk "Settle" stays for legacy (pre-feature) balances |
| Payment Methods report | Adds fee collected and provider charges columns (read-only) |

Out of scope for phase 1 (they keep today's behaviour): Wholesale POS (`PAY_KEYS` hard-coded), repairs, hire purchase, supplier/expense payments.

---

## 7. Edge cases & protections

1. **Old sales:** columns default to `customerFeeAmount=0`, `clearanceStatus=NOT_REQUIRED`. Nothing is recalculated. Legacy card/wallet balances in 1110/1120 keep using the existing bulk Settle.
2. **Config change after sale:** snapshots on `SalePayment` are used for display, clearance and reversal. Changing a rate never touches existing rows.
3. **Sale edit (`updateSaleInvoice`):** currently deletes and re-creates payments.
   - If any payment is CLEARED → block payment changes ("Reverse clearance first"). Item/price edits that don't touch payments still allowed.
   - Otherwise carry snapshot fields across by matching `id` (and re-derive fee from snapshot, not current config).
4. **Void:** blocked if any payment is CLEARED (reverse clearance first). If PENDING, void posts a `PAYMENT_FEE_REVERSED` journal (fee income back out). The pre-existing gap (void doesn't reverse `SALE_CREATED`) is documented, not changed here.
5. **Return:** fee is non-refundable by default (refund = item value, as today). Optional later: `fee.refundable`.
6. **Partial / credit sales:** fee applies only to the money actually collected by that method (`payNowForSale`), never to the CREDIT portion.
7. **Cash method:** fee allowed (generic) but clearance cannot be enabled for `CASH`.
8. **Disabled method:** hidden from checkout; history, reports and Mark as Clear still work.
9. **Deleted method:** existing payments keep `methodLabel`; Mark as Clear uses the snapshot `clearanceGlAccountId`.
10. **Offline POS sales:** server resolves the fee rule by sale date from `feeHistory`; mismatch → sale saved with the server-computed fee and a warning log (never rejected silently after offline replay).
11. **Double click / retry on Mark as Clear:** unique active clearance per `salePaymentId` + idempotent journal key.
12. **Rounding:** fee rounded to 2dp once, server-side; UI uses the same helper.

---

## 8. Backward compatibility checklist

- Existing tenant JSON without new fields → defaults → **identical** POS, receipts, journals, reports.
- Old web clients (cached PWA) that don't send fee fields → server treats as fee 0, status NOT_REQUIRED (unless the method has clearance on, in which case status PENDING is set server-side from config — safe because clearing account is the same kind of account they already use).
- `resolvePaymentGlAccountId` is **not modified**; only the sale journal gains an optional override from the snapshot.
- No existing column changes type or meaning. No data backfill.

---

## 9. Migration plan

1. Prisma migration `…_payment_fee_clearance` (additive): enum `PaymentClearanceStatus`; nullable/defaulted columns on `SalePayment`, `Sale.customerFeeTotal`; table `PaymentClearance`.
2. Deploy backend (normalizer preserves fields, sale create accepts fields, new routes) — no behaviour change until configured.
3. Deploy web (settings UI, POS fee line, details clearance UI).
4. Pilot on one tenant: configure one method with fee + clearance; run test matrix; check GL trial balance.
5. General availability.

## 10. Rollback plan

- **Soft rollback (preferred):** turn fee/clearance off in Settings → behaviour returns to today immediately; existing snapshots remain readable.
- **Code rollback:** previous backend/web builds ignore the new columns (all nullable/defaulted); no data loss.
- **Schema rollback:** only if no production rows use the feature — drop `PaymentClearance`, drop new columns/enum. Journals already posted are reversed via the reversal endpoint before rollback.

---

## 11. Implementation phases (after approval)

| Phase | Deliverable |
|---|---|
| P1 | Schema migration + normalizers preserve new fields + Settings UI (enabled, fee, clearance) |
| P2 | POS: enabled filter, fee preview, payload; backend fee recompute + snapshots; receipts |
| P3 | Accounting: debit override + `PAYMENT_FEE_COLLECTED` journal; P&L / daily-closing buckets |
| P4 | Sales History Mark as Clear + reverse; `PaymentClearance`; clearance journal; Cash & Bank pending list |
| P5 | Edit/void protections; pending-clearance filter/report; payment methods report columns |
| Later | Repairs, hire purchase, wholesale POS adopt the same config |

## 12. Test matrix

| # | Scenario | Expected |
|---|---|---|
| 1 | Existing tenant, no config change, cash/card sale | Byte-for-byte same payload, journal, receipt, reports |
| 2 | Method disabled | Not in POS grid; old sales still show label; report still lists history |
| 3 | Fee 3% on 10,000 | POS shows +300, customer pays 10,300; `Sale.total` 10,000; journal balanced; fee journal 300 |
| 4 | Fee FIXED 100 | +100 regardless of amount |
| 5 | Fee on partial credit sale (pay 4,000 of 10,000) | Fee on 4,000 only |
| 6 | Clearance on, sale made | Status PENDING; clearing balance +gross; Main Bank unchanged |
| 7 | Mark as Clear, deduction 350 → Main Bank | Bank +9,950, provider charges 350, clearing −10,300, status CLEARED |
| 8 | Mark as Clear twice / double-click | Second call rejected; one journal |
| 9 | Reverse clearance | Mirror journal; status PENDING; balances restored |
| 10 | Rate changed after sale | Old sale keeps old fee and snapshot |
| 11 | Offline sale replayed after rate change | Fee from rule effective at sale date |
| 12 | Edit sale with CLEARED payment | Payment change blocked with message |
| 13 | Void sale with PENDING fee payment | Fee income reversed; no duplicate |
| 14 | Return items | Refund item value only; fee kept |
| 15 | Cashier role | Can sell with fee; cannot configure or clear |
| 16 | Manager (ACCOUNTING view only) | Can Mark as Clear (POS module), can configure if SETTINGS edit |
| 17 | Tenant without ACCOUNTING feature | Fee + clearance tracked; no journals; P&L buckets correct |
| 18 | Monthly provider charge via Expenses | Appears as expense; not in clearance deduction |
| 19 | Daily closing | Expected cash unchanged for non-cash; fee/charge buckets shown |
| 20 | Legacy card balance in 1110 | Bulk Settle still works |

---

## 13. Decisions needed from you before implementation

1. **Mark as Clear password:** role check only (OWNER/MANAGER), or also require the admin password like delete/void? *(Recommended: role only for clear; password for reverse.)*
2. **Fee on returns:** non-refundable by default? *(Recommended: yes.)*
3. **Cheque / bank transfer clearance:** include in phase 1 (needs a new `chequeClearing` account), or card/wallet-style methods only first? *(Recommended: include; it's the same generic code.)*
4. **Phase 1 scope:** retail POS only, with repairs / HP / wholesale later? *(Recommended: yes.)*
5. **Fee income account:** separate "Payment Surcharge Income" (4050), or count it under existing Service Income? *(Recommended: separate, so profit reports show it clearly.)*
