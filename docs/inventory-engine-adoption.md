# Inventory Engine — Adoption Report

**Date:** 2026-07-20  
**Feature flag:** `INVENTORY_ENGINE` (opt-in, default **OFF**)  
**Status:** Phase 1 complete — all operational stock write paths have engine entrypoints

---

## 1. Coverage matrix

| Operational path | Call site | Engine entrypoint | Flag OFF behavior |
|------------------|-----------|-------------------|-------------------|
| Sale decrement + IMEI SOLD | `sales.service.ts` | `applySaleStockEffectsIfEnabled` | Legacy inline loop |
| PO receive (create) | `suppliers.routes.ts` | `applyPurchaseOrderReceiveEffectsIfEnabled` | `po-receive.util` direct |
| PO receive (update → RECEIVED) | `suppliers.routes.ts` | same | same |
| Sale return restock + IMEI reset | `sales.routes.ts` | `applySaleReturnStockEffectsIfEnabled` | Legacy inline loop |
| Repair spare parts (`REPAIR_USE`) | `repairs.service.ts` | `applyRepairSparePartsStockEffectsIfEnabled` | Legacy inline loop |
| Stock transfer | `stock-transfer.service.ts` | `applyStockTransferEffectsIfEnabled` | `stock-transfer.util` direct |
| Exchange trade-in (`EXCHANGE_IN`) | `exchanges.service.ts` | `applyExchangeTradeInStockEffectsIfEnabled` | `exchange-stock.util` direct |
| Exchange sold (`SALE`) | `exchanges.service.ts` | `applyExchangeSoldStockEffectsIfEnabled` | `exchange-stock.util` direct |
| Catalog stock set (create/update) | `products.service.ts` | `applyStockAdjustmentEffects` | Direct `product.stock` write, **no** `StockMovement` |

**Engine Reuse % (call sites with engine entrypoint):** 9 / 9 operational paths = **100%**  
(Legacy fallbacks remain until flag is ON and stable; they are intentional, not untracked writes.)

---

## 2. Module layout

```
apps/backend/src/modules/inventory-engine/
  inventory-engine.feature.ts   # INVENTORY_ENGINE flag helper
  inventory-engine.types.ts     # Input contracts
  inventory-engine.service.ts   # Engine entrypoints
  inventory-engine.service.test.ts

apps/backend/src/utils/
  po-receive.util.ts            # Delegated by engine (PO)
  stock-transfer.util.ts        # Delegated by engine (transfer)
  exchange-stock.util.ts        # Delegated by engine (exchange)

apps/backend/src/constants/
  business-rules.constants.ts   # OPENING_BALANCE markers, etc.
```

---

## 3. Rollout plan

1. **Deploy** with flag OFF (no behavior change).
2. **Staging:** enable `INVENTORY_ENGINE` for one test tenant.
3. **Smoke test checklist:**
   - [ ] POS sale (plain + variant + IMEI)
   - [ ] Sale return (partial + full + IMEI)
   - [ ] PO create as RECEIVED + PO update → RECEIVED
   - [ ] Repair delivery with spare parts
   - [ ] Branch stock transfer (relocate / merge / IMEI)
   - [ ] Device exchange (trade-in + sold)
   - [ ] Product create/update stock change → `StockMovement` ADJUSTMENT
   - [ ] Verify `StockMovement` rows and product/variant stock match
4. **Monitor** 3–7 days (stock mismatches, IMEI status, support tickets).
5. **Production:** enable per tenant gradually; keep OFF as instant rollback.

---

## 4. Known remaining (not Phase 1)

| Path | Why deferred |
|------|----------------|
| Removing legacy duplicate loops | Only after flag ON ≥90% tenants and 90 days clean |
| Dedicated stock-adjustment UI/API | Catalog update path covers absolute set; optional later |

---

## 5. How to enable (admin)

`INVENTORY_ENGINE` is in `OPT_IN_FEATURES` (backend + web).  
Platform admin / tenant features API: set `INVENTORY_ENGINE: true` for the target tenant.

---

## 6. Next architecture steps (after staging proof)

1. Drop duplicate legacy loops once flag is default-ON (or remove fallbacks after migration window).
2. Phase 1 Shared Engines (continued): Pricing Engine server validation parity.
