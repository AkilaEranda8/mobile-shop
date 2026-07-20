# Business Rules Engine — Adoption Report

**Date:** 2026-07-20  
**Status:** Phase 1 — registry + pure default evaluators (no tenant overrides)

---

## Coverage

| Rule | Status |
|------|--------|
| `NOTES_CONTAIN_OPENING_BALANCE` | ✅ |
| `SALE_SOURCE_SKIP_AUTO_JOURNAL` | ✅ |
| `PO_IS_OPENING_SUPPLIER_BALANCE` | ✅ |
| Product Traceability purchases | ✅ |
| Accounting outbox sync filters | ✅ |
| Auto-journal opening supplier AP | ✅ |
| Tenant overrides | ⏳ Phase 2 |
| Admin UI | ⏳ Phase 3 |

---

## Safety

- Evaluators are pure (no DB / side effects).
- Defaults identical to previous magic strings / `notesContainOpeningBalance`.
- `tenantId` accepted for API stability; unused until Phase 2.

---

## Related

- [ADR-005](./adr/005-business-rules-engine.md)
- Blueprint §9
- [ENGINES_PHASE1_REPORT.md](./ENGINES_PHASE1_REPORT.md)
