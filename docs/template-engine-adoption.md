# Template Engine — Adoption Report

**Date:** 2026-07-20  
**Status:** Phase 1 — registry + WhatsApp binding

---

## Coverage

| Path | Status |
|------|--------|
| Template registry (keys + variables) | ✅ |
| `{{var}}` binding | ✅ |
| WhatsApp sale invoice message | ✅ wired |
| Invoice layout HTML (web) | ⏳ registry only (render stays on web) |
| Repair / warranty print | ⏳ registry keys reserved |
| PO barcode labels | ⏳ registry key reserved |

---

## Safety

No feature flag — binding matches prior WhatsApp `formatTemplate` behavior.  
Shop name now prefers tenant `invoiceSettings` when available.

---

## Related

- `apps/backend/src/modules/tenants/invoice-settings.util.ts`
- `apps/web/src/lib/invoiceSettings.ts` (web renderers)
