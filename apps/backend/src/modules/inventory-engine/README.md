# Inventory Engine (Phase 1)

Single write path for operational stock mutations, `StockMovement` rows, and related IMEI status updates.

**Flag:** `INVENTORY_ENGINE` — opt-in, default OFF.  
**Adoption report:** [docs/inventory-engine-adoption.md](../../../../docs/inventory-engine-adoption.md)  
**ADR:** [ADR-002 Shared Engines](../../../../docs/adr/002-shared-engines.md)

## Entrypoints

| Function | Use |
|----------|-----|
| `applySaleStockEffectsIfEnabled` | POS / sale create |
| `applySaleReturnStockEffectsIfEnabled` | Sale returns |
| `applyPurchaseOrderReceiveEffectsIfEnabled` | PO receive |
| `applyRepairSparePartsStockEffectsIfEnabled` | Repair spare parts |
| `applyStockTransferEffectsIfEnabled` | Inter-branch transfer |
| `applyExchangeTradeInStockEffectsIfEnabled` | Exchange trade-in |
| `applyExchangeSoldStockEffectsIfEnabled` | Exchange sold unit |
| `applyStockAdjustmentEffects` / `IfEnabled` | Catalog absolute stock set → `ADJUSTMENT` |
| `consumeStock` / `consumeImei` | Optimistic qty / IMEI hard commit (Gaps 1–3) |
| `getOnHand` / `getReservedQty` / `getAtp` | ATP = onHand − reserved (no MOQ/credit) |
| `softReserveImei` / `releaseImeiSoftReserve` | IMEI soft-hold TTL (needs W1 columns) |
| `atp.service` (`getAtpSnapshot`) | Thin wholesale/POS ATP façade |

Each `*IfEnabled` returns whether the engine handled the write (`false` / `null` → caller runs legacy path).

**Retail sale:** keep calling `applySaleStockEffectsIfEnabled` — it delegates to `consumeStock` / `consumeImei` internally. Direct helper use is for wholesale / shared ATP checks.

## Rules

- Do not add new `prisma.product` stock increment/decrement or `stockMovement.create` outside this engine (or its delegated utils).
- Accounting / journals stay in Accounting Engine (outbox) — not here.
- Behavior with flag OFF must match pre-extraction behavior.
