# Business Rules Engine (Phase 1)

Catalogued, versioned evaluation of hardcoded business conditions.  
**Defaults mirror current production logic — no behavior change.**

**Flag:** none (read-only evaluation; Phase 2 adds tenant overrides)  
**ADR:** [005-business-rules-engine.md](../../../../docs/adr/005-business-rules-engine.md)  
**Blueprint:** §9

## Entrypoints

| Function | Use |
|----------|-----|
| `evaluateRule(tenantId, key, context)` | Generic evaluate; Phase 1 always `source: 'default'` |
| `evaluateNotesContainOpeningBalance` | Notes marker helper |
| `evaluateSaleSourceSkipAutoJournal` | Sale.source skip SALE_* journals |
| `evaluatePoIsOpeningSupplierBalance` | Opening supplier AP PO |
| `saleSourcesSkippedForAutoJournal()` | Prisma `notIn` array |
| `listRegisteredRules()` | Catalog listing |

## Catalogued rules

| Key | Default |
|-----|---------|
| `NOTES_CONTAIN_OPENING_BALANCE` | notes includes `OPENING_BALANCE` |
| `SALE_SOURCE_SKIP_AUTO_JOURNAL` | source ∈ REPAIR / OPENING_BALANCE / CREDIT_COLLECTION |
| `PO_IS_OPENING_SUPPLIER_BALANCE` | notes marker; optional `receivedAt == null` |

Constants live in `constants/business-rules.constants.ts`.

## Consumers (Phase 1)

- Product Traceability purchases (`receivedBy` opening detection)
- Accounting outbox sync (sale source skip + opening markers)
- Auto-journal opening supplier AP guard

## Next (Phase 2)

- Tenant JSON overrides (additive only)
- More rules (COGS bucket, credit allocation)
- Admin UI (Phase 3)
