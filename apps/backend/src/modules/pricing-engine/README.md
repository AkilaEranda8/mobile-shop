# Pricing Engine (Phase 1)

Server-side catalog price resolution (retail / wholesale / credit) with feature-flag awareness.

**Flag:** `PRICING_ENGINE` — opt-in, default OFF.  
**Parity:** mirrors `apps/web/src/lib/productPrice.ts`  
**Blueprint:** Section 4.3.3

## Behavior

| Flag | Result |
|------|--------|
| OFF | Sale create trusts client `unitPrice` (unchanged) |
| ON | Product lines normalized via catalog + `priceMode` |
| ON + `POS_PRICE_EDIT` | Client `unitPrice` kept when ≥ 0 |
| ON without edit | Catalog price wins (variant-aware) |

Mode is clamped: `wholesale` / `credit` only if `WHOLESALE_PRICING` / `CREDIT_PRICING` enabled.

## Entrypoints

| Function | Use |
|----------|-----|
| `resolveCatalogPrice` | Pure catalog resolve |
| `resolveProductCatalogUnitPrice` | Product + variant |
| `resolveSaleLineUnitPrice` | Catalog vs manual override |
| `applySalePricingIfEnabled` | Sale create normalization |

## Consumers

- `sales.service.ts` — sale create
- `exchanges.service.ts` — trade-in sell price resolve (pure helper)

## Must not

- Accounting / COGS (use unit cost utils)
- UI rendering
- Stock writes
