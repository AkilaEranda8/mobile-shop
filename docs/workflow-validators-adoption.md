# Workflow Validators — Adoption Report

**Date:** 2026-07-20  
**Feature flag:** `WORKFLOW_VALIDATORS` (opt-in, default **OFF**)  
**Status:** Phase 1 — Repair + PO graphs

---

## Coverage

| Path | Status |
|------|--------|
| Repair `updateStatus` | ✅ (hard rules always; graph when flag ON) |
| Repair collect payment → DELIVERED | ✅ (`via: collect_payment`) |
| PO status update | ✅ (graph when flag ON) |
| Configurable tenant graphs | deferred (Phase 2/3) |

---

## Rollout

1. Deploy flag OFF — same as today for PO; repair still blocks DELIVERED on status API.
2. Staging: enable `WORKFLOW_VALIDATORS`, exercise repair flow RECEIVED→…→READY→Collect Payment and PO DRAFT→SENT→RECEIVED→CLOSED.
3. Production gradual enable.

---

## Related

- Inventory / Pricing / Report engines already shipped Phase 1
