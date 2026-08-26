# HR Engine — Adoption Report

**Date:** 2026-08-26  
**Feature flag:** none for engine itself (gated by existing `HR_PAYROLL` on HR module)  
**Status:** Phase 1 foundation — employment lifecycle extraction only  
**Detail:** [HEXALYTE_HR_ENGINE_POST_IMPLEMENTATION.md](./HEXALYTE_HR_ENGINE_POST_IMPLEMENTATION.md)

---

## Coverage

| Path | Status |
|------|--------|
| `planEmploymentStatusChange` | ✅ Wired via update |
| `planEmploymentUpdateEvents` | ✅ Wired via update |
| `planEmploymentCreateEvents` | ✅ Wired via create |
| `planUserLinkEvents` | ✅ Wired via link-user |
| Attendance / leave / compensation / payroll calc | ❌ Stub (throws) — domain not built |
| Schema changes | None |

---

## Call chain

```
hr.controller → employees.service → hr-engine.service → Prisma + audit-engine
```

Controllers never call the engine directly.

---

## Rollout

1. Deploy with `HR_PAYROLL` still OFF for most tenants — no behavior change.
2. For tenants with HR ON: create/update/link employee; confirm EmploymentEvent types match prior Phase-1.
3. Run: `npx tsx src/modules/hr-engine/hr-engine.employment.test.ts`

---

## Related

- Shared engines ADR: `docs/adr/002-shared-engines.md`
- HR architecture plan: `docs/HEXALYTE_MOBILE_SHOP_HR_PAYROLL_ARCHITECTURE_PLAN.md`
- Phase-1 engines report: `docs/ENGINES_PHASE1_REPORT.md`
