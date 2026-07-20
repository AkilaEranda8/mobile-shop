# Pricing Engine — Adoption Report

**Date:** 2026-07-20  
**Feature flag:** `PRICING_ENGINE` (opt-in, default **OFF**)  
**Status:** Phase 1 — sale price normalization + shared resolve helpers

---

## Coverage

| Path | Status |
|------|--------|
| `resolveCatalogPrice` (POS parity) | ✅ |
| Variant-aware unit price | ✅ |
| Effective mode clamp (wholesale/credit flags) | ✅ |
| Sale create via `applySalePricingIfEnabled` | ✅ |
| Exchange sell price helper reuse | ✅ |
| Strict reject on mismatch | deferred (`assertCatalogPriceMatch` available) |
| Header totals recompute (subtotal/total/paid) | deferred |
| Service / reload line pricing | unchanged (no productId) |

---

## Rollout

1. Deploy with flag OFF.
2. Staging: enable `PRICING_ENGINE` for one tenant.
3. Smoke:
   - [ ] Retail sale matches catalog
   - [ ] Wholesale / credit modes (with those features ON)
   - [ ] Variant wholesale falls back when unset
   - [ ] `POS_PRICE_EDIT` ON allows custom unit price
   - [ ] `POS_PRICE_EDIT` OFF overwrites tampered client price
4. Production: gradual enable.

---

## Related

- Inventory Engine: `docs/inventory-engine-adoption.md`
- Web POS: `apps/web/src/lib/productPrice.ts` (keep in sync)
