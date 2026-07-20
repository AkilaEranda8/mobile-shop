# Hexalyte Shared Engines — Phase 1 Report

**Date:** 2026-07-20  
**Scope:** Blueprint §4.3 shared engines (first implementation pass)  
**Principle:** Additive only · defaults preserve current production behavior  
**Bible:** [ENTERPRISE_PLATFORM_ARCHITECTURE_BLUEPRINT_10Y.md](./ENTERPRISE_PLATFORM_ARCHITECTURE_BLUEPRINT_10Y.md)

---

## 1. Executive summary

Phase 1 extracts cross-cutting side effects into **shared engines** under `apps/backend/src/modules/`. Modules call engines; engines do not replace domain aggregates.

| # | Engine | Module path | Flag (default) | Status |
|---|--------|-------------|----------------|--------|
| 1 | Inventory | `inventory-engine/` | `INVENTORY_ENGINE` **OFF** | ✅ Complete |
| 2 | Pricing | `pricing-engine/` | `PRICING_ENGINE` **OFF** | ✅ Complete |
| 3 | Report | `report-engine/` | none (read-only) | ✅ Complete |
| 4 | Workflow Validators | `workflow-validators/` | `WORKFLOW_VALIDATORS` **OFF** | ✅ Complete |
| 5 | Template | `template-engine/` | none (binding/registry) | ✅ Complete |
| 6 | Audit | `audit-engine/` | none (consolidate writes) | ✅ Complete |
| 7 | Notification | `notification-engine/` | none (dispatch facade) | ✅ Complete |
| 8 | Configuration | `configuration-engine/` | none (normalize + cache) | ✅ Phase 1 |
| 9 | Business Rules | `business-rules-engine/` | none (registry + defaults) | ✅ Phase 1 |

**Production impact today:** With all opt-in flags **OFF**, tenant behavior matches pre-extraction code paths (legacy fallbacks still present where flagged).

---

## 2. Supporting foundation (same effort)

| Artifact | Path | Notes |
|----------|------|--------|
| ADRs 001–005 | [docs/adr/](./adr/README.md) | Modular monolith, shared engines, outbox, config-over-customization, business rules |
| Business rule constants | `apps/backend/src/constants/business-rules.constants.ts` | Markers + sale-source skip set |
| Business Rules Engine | `business-rules-engine/` | Registry + `evaluateRule` (Phase 1 defaults) |
| Feature flags | `tenant-features.ts` (backend + web) | New opt-ins listed above |

---

## 3. Engine detail

### 3.1 Inventory Engine

**Purpose:** Single write path for stock, `StockMovement`, IMEI status.

| Path | Entrypoint | Wired |
|------|------------|-------|
| Sale decrement | `applySaleStockEffectsIfEnabled` | `sales.service` |
| Sale return | `applySaleReturnStockEffectsIfEnabled` | `sales.routes` |
| PO receive | `applyPurchaseOrderReceiveEffectsIfEnabled` | `suppliers.routes` (create + update) |
| Repair spare parts | `applyRepairSparePartsStockEffectsIfEnabled` | `repairs.service` |
| Stock transfer | `applyStockTransferEffectsIfEnabled` | `stock-transfer.service` |
| Exchange trade-in / sold | `applyExchange*StockEffectsIfEnabled` | `exchanges.service` |
| Catalog stock set | `applyStockAdjustmentEffects` | `products.service` create/update (flag ON → `ADJUSTMENT` movement) |

**Delegated utils:** `po-receive.util`, `stock-transfer.util`, `exchange-stock.util`  
**Detail:** [inventory-engine-adoption.md](./inventory-engine-adoption.md)

---

### 3.2 Pricing Engine

**Purpose:** Retail / wholesale / credit catalog price resolve (POS parity).

| Behavior when `PRICING_ENGINE` ON | |
|----------------------------------|---|
| Mode clamped by `WHOLESALE_PRICING` / `CREDIT_PRICING` | |
| `POS_PRICE_EDIT` OFF → catalog wins | |
| `POS_PRICE_EDIT` ON → client unit price kept | |

**Wired:** `sales.service` create · exchanges sell-price helper · POS sends `priceMode`  
**Detail:** [pricing-engine-adoption.md](./pricing-engine-adoption.md)

---

### 3.3 Report Engine

**Purpose:** Standardized list/report filter context (pagination, branch, dates).

| API | Role |
|-----|------|
| `buildReportFilterContext` | tenant + branch + page/limit + dates |
| `resolveBusinessReportRange` | Colombo business-day range |
| `resolveOptionalBusinessReportRange` | optional (all-time when unset) |
| `businessRangeWhere` / `dateWhereClause` | Prisma gte/lte |
| `buildPaginatedReport` / `buildExportMetadata` | response helpers |

**Date modes:** `none` · `instant` · `business` (Colombo)  
**Wired:** Product Traceability · sales list · analytics reports · finance summary/P&L/transactions  
**Detail:** [report-engine-adoption.md](./report-engine-adoption.md)

---

### 3.4 Workflow Validators

**Purpose:** Pure status-transition checks (no DB writes).

| Entity | Flag OFF | Flag ON |
|--------|----------|---------|
| RepairTicket | Hard rule: no `DELIVERED` via status API | Full graph + terminals |
| PurchaseOrder | No new checks | Full PO graph |

`DELIVERED` allowed only with `{ via: 'collect_payment' }`.  
**Wired:** `repairs.service` · `suppliers.routes` PO update  
**Detail:** [workflow-validators-adoption.md](./workflow-validators-adoption.md)

---

### 3.5 Template Engine

**Purpose:** Template registry + `{{var}}` binding. HTML/thermal still on web.

| API | Role |
|-----|------|
| `listTemplateRegistry` | Keys + variable contracts |
| `bindTemplateVariables` | Mustache-style bind |
| `renderWhatsAppSaleInvoice` | WA sale message body |

**Wired:** WhatsApp sale invoice text  
**Detail:** [template-engine-adoption.md](./template-engine-adoption.md)

---

### 3.6 Audit Engine

**Purpose:** Structured append-only `AuditEvent` writes.

| API | Role |
|-----|------|
| `recordAuditEvent` / `recordAuditEventSafe` | Create |
| `listAuditEvents` | Read (accounting UI re-exports) |

**Migrated:** period close/reopen · manual journal post/approve/reverse · accounting init  
**Remaining raw creates outside engine:** 0  
**Detail:** [audit-engine-adoption.md](./audit-engine-adoption.md)

---

### 3.7 Notification Engine

**Purpose:** Channel dispatch (WhatsApp + in-app).

| API | Role |
|-----|------|
| `dispatchNotification` | Multi-channel router |
| `notifyDeliveryDispatched` | Delivery tracking WA |
| `notifySaleInvoice` | Sale/billing WA invoice |
| `dispatchInAppNotification` | `UserNotification` |

**Wired:** delivery · feature-suggestions · whatsapp controller · admin billing invoice  
**Detail:** [notification-engine-adoption.md](./notification-engine-adoption.md)

---

### 3.8 Configuration Engine

**Purpose:** Normalize tenant JSON settings domains + TTL cache + aggregate read.

| Domain | Column |
|--------|--------|
| invoice / reload / paymentMethod / productVariant / productCode | matching `*Settings` |

**API:** `GET /tenants/me/settings`, `GET /tenants/:id/settings`, `GET /tenants/config-domains`  
**Wired:** all `tenants.service` settings get/update · template engine invoice load  
**Detail:** [configuration-engine-adoption.md](./configuration-engine-adoption.md)

---

### 3.9 Business Rules Engine

**Purpose:** Catalogued evaluation of hardcoded conditions (ADR-005). Phase 1 = defaults only.

| Rule key | Default |
|----------|---------|
| `NOTES_CONTAIN_OPENING_BALANCE` | notes includes `OPENING_BALANCE` |
| `SALE_SOURCE_SKIP_AUTO_JOURNAL` | REPAIR / OPENING_BALANCE / CREDIT_COLLECTION |
| `PO_IS_OPENING_SUPPLIER_BALANCE` | notes marker (+ optional no receive) |

**Wired:** product-traceability purchases · accounting outbox · auto-journal opening AP  
**Detail:** [business-rules-engine-adoption.md](./business-rules-engine-adoption.md)

---

## 4. Opt-in feature flags (admin)

Enable per tenant via tenant features API / admin (all default **false**):

```
INVENTORY_ENGINE
PRICING_ENGINE
WORKFLOW_VALIDATORS
```

Read-only / facade engines (Report, Template, Audit, Notification, Configuration, Business Rules) need no flag for Phase 1.

---

## 5. Staging smoke-test checklist

### Inventory (`INVENTORY_ENGINE` ON for one tenant)
- [ ] POS sale (plain + variant + IMEI)
- [ ] Sale return
- [ ] PO create RECEIVED + update → RECEIVED
- [ ] Repair delivery with spare parts
- [ ] Branch stock transfer
- [ ] Device exchange
- [ ] Verify `StockMovement` + stock counts

### Pricing (`PRICING_ENGINE` ON)
- [ ] Retail / wholesale / credit modes
- [ ] Variant fallback when wholesale/credit unset
- [ ] `POS_PRICE_EDIT` on/off

### Workflow (`WORKFLOW_VALIDATORS` ON)
- [ ] Repair RECEIVED → … → READY → Collect Payment
- [ ] Block DELIVERED via status API
- [ ] PO DRAFT → SENT → RECEIVED → CLOSED

### Facades (always on)
- [ ] Product Traceability filters/pagination
- [ ] WhatsApp invoice send
- [ ] Delivery tracking WhatsApp
- [ ] Feature suggestion in-app notification
- [ ] Accounting audit list still loads

---

## 6. Explicitly deferred

| Item | Why |
|------|-----|
| Product catalog direct `stock` set (flag OFF) | Legacy path until `INVENTORY_ENGINE` ON |
| Dedicated stock-adjustment UI | Catalog update covers absolute set |
| Remove legacy stock loops | After flag ON ≥90% tenants + clean window |
| Strict price reject (vs coerce) | Soft catalog overwrite is Phase 1 |
| Analytics/finance → Report Engine business dates | Dashboard fixed window only |
| Server-side HTML invoice render | Web still owns layouts |
| Operational audits on every sale | Noise; optional later |
| Auto-notify on repair/warranty complete | Opt-in later |

---

## 7. File map (quick)

```
apps/backend/src/modules/
  inventory-engine/
  pricing-engine/
  report-engine/
  workflow-validators/
  template-engine/
  audit-engine/
  notification-engine/
  configuration-engine/
  business-rules-engine/

apps/backend/src/constants/business-rules.constants.ts
apps/backend/src/utils/{po-receive,stock-transfer,exchange-stock}.util.ts

docs/
  ENGINES_PHASE1_REPORT.md          ← this file
  *-engine-adoption.md / workflow-*-adoption.md
  adr/001–005
  ENTERPRISE_PLATFORM_ARCHITECTURE_BLUEPRINT_10Y.md
```

---

## 8. Recommended next steps

1. Deploy with flags **OFF** (safe).
2. Staging: enable `INVENTORY_ENGINE` → then `PRICING_ENGINE` → then `WORKFLOW_VALIDATORS` one tenant at a time.
3. After 3–7 days clean: gradual production enable.
4. Commit this Phase 1 body of work when ready.
5. Later: drop legacy stock fallbacks; expand Report/Notification consumers; Business Rules Phase 2 (tenant overrides).

---

## 9. Per-engine reports (detail)

| Report |
|--------|
| [inventory-engine-adoption.md](./inventory-engine-adoption.md) |
| [pricing-engine-adoption.md](./pricing-engine-adoption.md) |
| [report-engine-adoption.md](./report-engine-adoption.md) |
| [workflow-validators-adoption.md](./workflow-validators-adoption.md) |
| [template-engine-adoption.md](./template-engine-adoption.md) |
| [audit-engine-adoption.md](./audit-engine-adoption.md) |
| [notification-engine-adoption.md](./notification-engine-adoption.md) |
| [configuration-engine-adoption.md](./configuration-engine-adoption.md) |
| [business-rules-engine-adoption.md](./business-rules-engine-adoption.md) |
