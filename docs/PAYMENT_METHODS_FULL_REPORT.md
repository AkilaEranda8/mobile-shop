# Payment Methods — Full System Report

**Source:** Hexalyte `apps/web` + `apps/backend` (verified from code)  
**Date:** 26 Sep 2026  
**Scope:** How tenant payment methods are configured, shown at checkout, stored on sales, posted to accounting, and reported

---

## 1. Executive summary

Hexalyte separates two concepts:

| Concept | What it is | Example |
|---------|------------|---------|
| **Display method** (tenant UI button) | Configurable label + unique `id` shown in POS / Repairs | `Genie`, `eZ Cash`, `Koko`, `retrun` |
| **Accounting key** (`PaymentMethod` enum) | Fixed type stored on payments & journals | `WALLET`, `CASH`, `CARD`, `CHEQUE` |

One shop can have **many buttons** that share the same accounting key (e.g. two Wallet labels). Cash **cannot** be fully removed — daily closing and cash drawer logic depend on it.

**Defaults (new tenant):** Cash, Card, Bank Transfer.

---

## 2. Architecture

```
Settings → Payment Methods
        ↓  PATCH /tenants/:id/payment-method-settings
Tenant.settings JSON (normalized)
        ↓  GET + usePaymentMethods()
POS / Repairs / Hire Purchase / etc. checkout buttons
        ↓  on Pay Now
SalePayment.method = accounting KEY (not custom label)
        ↓
Accounting auto-journal (GL by method)
Finance → Payment Methods cashflow report
```

### Key files

| Layer | Path | Role |
|-------|------|------|
| Frontend config + hook | `apps/web/src/lib/payment-methods.ts` | Defaults, sanitize, `usePaymentMethods`, label→key infer |
| Backend normalize | `apps/backend/src/modules/tenants/payment-method-settings.util.ts` | Persist-safe settings |
| API | `GET/PATCH /tenants/:id/payment-method-settings` | `tenants.routes.ts` |
| Settings UI | `apps/web/src/app/(dashboard)/settings/page.tsx` tab `payments` | Add / rename / remove / save |
| Retail POS | `POSOverlay.tsx` | Checkout tiles, shortcuts 1–5, cheque fields |
| Repairs | `RepairDetailsView.tsx` | Collect payment method picker |
| Prisma enum | `PaymentMethod` in `schema.prisma` | DB / accounting types |
| Sale rows | `SalePayment` model | Per-sale payment lines |
| Cashflow report | `payment-method-cashflow.service.ts` + `/dashboard/payment-methods` | In/out by method |
| Accounting | `auto-journal.engine.ts` `resolvePaymentGlAccountId` | GL mapping |

---

## 3. Prisma `PaymentMethod` enum (system of record)

```
CASH
CARD
UPI
BANK_TRANSFER
WALLET
CHEQUE
CREDIT          — customer owes shop (sale due / AR), not cash in
STORE_CREDIT    — redeem shop-owes-customer balance against a sale
```

**Tenant UI buttons** only configure the first six (`CASH`…`CHEQUE`).  
`CREDIT` and `STORE_CREDIT` are **system-generated** on POS when customer credit features apply — they are not Settings buttons.

Used on (among others):

- `SalePayment.method`
- `SaleReturn.refundMethod`
- `Transaction.paymentMethod` (cash in/out, expenses)
- Hire purchase payments, supplier payments, wholesale invoice payments, dealer payments, reload provider payments, van settlement buckets

---

## 4. Tenant configuration (Settings)

### Where

**Settings → Payment Methods** (`activeTab === 'payments'`).

Also: sidebar/report page **Payment Methods** (`/dashboard/payment-methods`) is the **cashflow analytics** page, not the config editor.

### Who can change

| Action | Roles / access |
|--------|----------------|
| View settings | OWNER, MANAGER, CASHIER, TECHNICIAN (GET) |
| Save settings | OWNER / MANAGER + `SETTINGS` edit module |

### What you can do

1. **Rename** any method label (max 40 chars).
2. **Add** a method by typing a display name (e.g. `Genie`, `Koko`, `Cheque`).
3. **Remove** a method (except the last Cash).
4. **Save** → backend normalizes → broadcasts `hexalyte:payment-methods-changed` so open POS refetches.

### Label → accounting key inference

When adding a free-text name, `inferPaymentMethodKey()` maps:

| Name pattern | Key |
|--------------|-----|
| Cash / මුදල් | `CASH` |
| Card / Visa / Master / Debit | `CARD` |
| Bank / Bank Transfer | `BANK_TRANSFER` |
| Cheque / Check | `CHEQUE` |
| UPI / QR | `UPI` |
| Everything else (Genie, eZ Cash, Koko, custom typos) | `WALLET` |

So a custom label like `retrun` or `grdcx` is stored as a **Wallet-type** accounting method unless the name matches another pattern. **Tenant data is not auto-corrected** — UI shows whatever label was saved.

### Persist shape

```json
{
  "methods": [
    { "id": "CASH", "key": "CASH", "label": "Cash" },
    { "id": "CARD", "key": "CARD", "label": "Card" },
    { "id": "WALLET_koko", "key": "WALLET", "label": "Koko" }
  ]
}
```

- `id` — unique button id (used by POS selection state).
- `key` — Prisma enum value written to `SalePayment.method`.
- `label` — what cashiers see.

Normalization always ensures **at least one CASH** row exists.

---

## 5. Runtime load (`usePaymentMethods`)

```ts
usePaymentMethods() → TenantPaymentMethod[]
```

1. Starts with `DEFAULT_PAYMENT_METHODS` (Cash, Card, Bank Transfer).
2. Fetches `GET /tenants/:id/payment-method-settings`.
3. Re-fetches on window focus and on `hexalyte:payment-methods-changed`.

Consumers:

- Retail POS checkout
- Repair payment collection
- Payment Methods cashflow page (labels)
- Other checkout surfaces that import the hook

---

## 6. Retail POS checkout flow

### Selection

1. Cashier opens Checkout.
2. Grid of buttons from `usePaymentMethods()`.
3. State: `paymentMethodId` (button `id`).
4. Accounting type: `paymentMethod` = that row’s `key`.
5. Keyboard **1–5** map to the **first five** methods in the configured list.
6. **F3 / Enter** → Pay Now.

### Selected UI (Nova)

Buttons use `data-selected` / `nova-pay-method` so the active method is visually distinct (Cash green, Card/others blue accent).

### Special cases

| Case | Behavior |
|------|----------|
| **CHEQUE** | Requires cheque number (+ date); reference formatted via `ChequeDetailsFields` |
| **CASH** (walk-in) | “Customer Paid” tender; change calculated |
| **STORE_CREDIT** | Auto-added payment line when store credit applied (flag `CUSTOMER_CREDIT`) |
| **CREDIT** | Auto-added for unpaid remainder (customer due) |
| Fully covered by store credit | Payment grid hidden; no cash/card needed |
| Hire Purchase | Separate path; not a Settings payment-method button |

### What gets saved on the sale

Example paid LKR 10,000 by Koko + LKR 2,000 on credit:

```text
SalePayment { method: WALLET, amount: 10000, reference?: ... }   // label was "Koko"
SalePayment { method: CREDIT, amount: 2000 }
```

Receipt / thermal may show the **sale’s primary method** string (often first money payment’s key or mapped label depending on print path).

---

## 7. Other modules that take a payment method

| Module | How method is chosen | Stored as |
|--------|----------------------|-----------|
| **Repairs** collect payment | Same `usePaymentMethods()` picker | Linked repair sale `SalePayment` + repair paid fields |
| **Hire purchase** down / installments | Method on payment entry (enum) | HP payment + finance transaction |
| **Supplier payments** | Method on AP payment UI | `Transaction` / AP payment allocation |
| **Expenses / Cash In-Out** | Method on finance form | `Transaction.paymentMethod` |
| **Daily reload provider pay** | Method on pay form | `DailyReloadProviderPayment` |
| **Wholesale POS** | Own Counter pay keys (Cash/Card/Bank/Credit) — **not** Settings list | `WholesaleInvoicePayment` |
| **Returns** | Refund method | `SaleReturn.refundMethod` |

**Important:** Wholesale Counter payment UI is **separate** from tenant Settings payment-method buttons. Retail Settings changes do not automatically reshape Wholesale POS tiles.

---

## 8. Accounting / GL mapping

When journals post for money received or expenses paid, the method drives the **credit/debit cash-like account**:

| Method | Typical GL resolution |
|--------|------------------------|
| `CASH` | Branch cash account |
| `CARD` | Card clearing |
| `UPI` / `WALLET` | UPI clearing (shared path) |
| `BANK_TRANSFER` / `CHEQUE` | Bank |
| `CREDIT` | AR / customer due (not cash in) |
| `STORE_CREDIT` | Liability / credit balance (not cash in) |

Custom labels (Genie, Koko) still journal as their **`key`** (usually `WALLET` → UPI clearing).

---

## 9. Reporting — Payment Methods cashflow

**Route:** `/dashboard/payment-methods`  
**Backend:** `buildPaymentMethodCashflow()`

Cash-basis **In / Out / Net** per enum method for a date range:

**In examples:** sales payments, repair collections, customer credit settlements  
**Out examples:** supplier payments, expenses, refunds, reload provider pays, bank deposits

Labels on the chart prefer tenant Settings labels when available; otherwise default English labels.

`CREDIT` / `STORE_CREDIT` are generally **excluded** from money cashflow buckets (not physical cash methods in that report’s `METHODS` list).

---

## 10. End-to-end example

1. Owner opens **Settings → Payment Methods**.
2. Adds `Koko` → inferred key `WALLET`, id e.g. `WALLET_koko`.
3. Saves → stored on tenant → POS event refreshes list.
4. Cashier at Nova POS selects **Koko**, presses Pay Now.
5. Backend creates `SalePayment { method: 'WALLET', amount: … }`.
6. Auto-journal debits UPI/wallet clearing (per chart of accounts).
7. **Payment Methods** report shows inflow under Wallet (labeled “Koko” if mapped).

---

## 11. Rules & constraints (cheat sheet)

| Rule | Detail |
|------|--------|
| Cash always present | Backend + frontend force at least one `CASH` |
| Custom names → keys | Free text inferred; most customs become `WALLET` |
| Multiple same key OK | e.g. Genie + eZ Cash both `WALLET` |
| Labels ≠ DB method | DB stores enum `key`, not display label |
| CREDIT / STORE_CREDIT | System only; not Settings buttons |
| Cheque | Needs number when key is `CHEQUE` |
| Wholesale | Separate pay UI |
| Permissions | Edit Settings requires SETTINGS edit; cashiers can *use* methods at POS |

---

## 12. Common confusion

| Symptom | Cause |
|---------|--------|
| Odd labels (`retrun`, `grdcx`) on POS | Tenant saved those names in Settings — not a code bug |
| “Koko” shows as Wallet in reports | Correct — accounting key is `WALLET` |
| Changed Settings but POS stale | Refresh POS / refocus window (hook listens to event + focus) |
| Cannot remove Cash | By design |
| Wholesale tiles don’t match Settings | Wholesale uses its own method set |

---

## 13. Related APIs

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/tenants/:id/payment-method-settings` | Load methods |
| PATCH | `/tenants/:id/payment-method-settings` | Save methods |
| Analytics | payment-method cashflow endpoint (via `analyticsApi` / finance) | In/out report |

---

## 14. Future / optional improvements (not implemented)

- Explicit “accounting type” dropdown when adding a method (instead of name inference only).
- Unify Wholesale POS tiles with tenant Settings list.
- Show display label on thermal/A4 receipts in addition to enum key.
- Soft-delete / archive methods without breaking historical report labels.

---

## 15. Bottom line

**Payment methods work as a tenant-configured button list on top of a fixed accounting enum.**  
Cashiers pick a **label**; the system posts and reports using the **key**. Cash is mandatory; credit types are automatic; custom wallets share the `WALLET` bucket unless the name clearly maps to another type.
