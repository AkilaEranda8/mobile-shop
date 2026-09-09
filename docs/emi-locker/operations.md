# EMI Locker — Operations

## Worker

`jobs/emi-locker-enforcement.job.ts` — hourly (same pattern as HP maintenance).

Skips when `EMI_LOCKER_ENABLED=false`.

Per enabled tenant:

1. Soft status from HP (`PAYMENT_DUE` / `WARNING` / `GRACE_PERIOD` / `OVERDUE`)
2. Restriction eligibility via `EmiLockerEligibilityService`
3. Queue `APPLY_RESTRICTION` (or pending approval)
4. Auto-release when HP `COMPLETED` and settings allow

Idempotency: duplicate active overdue / restore / release states do not spam unlimited commands.

## Dry-run operations

Commands finish as `DRY_RUN`. Device status may still advance for ops rehearsal; `managementStatus=DRY_RUN` and `policyStatus` includes `:DRY_RUN`.

Admin UI banner: **DRY RUN MODE**.

No Google Android Management API calls when dry-run is on or AMAPI is disabled.

## Phase 2 UI ops

- Dashboard: live ManagedDevice + HP aggregates
- Commands page: filter by type/status including `DRY_RUN`
- Reports: restriction list from ManagedDevice; collections from HP only
- Settings: shop users cannot enable live AMAPI via UI

## Troubleshooting

| Symptom | Check |
|---------|--------|
| API 403 feature | Tenant `EMI_LOCKER` + branch not opted out |
| No restrictions | Grace not expired; `automaticRestriction`; worker logs |
| Restore skipped | Overdue installments remain; `autoRestoreEnabled`; HP outstanding |
| Release blocked | HP not `COMPLETED` or open installments |
| Fake Google QR expected | Keep `ANDROID_MANAGEMENT_ENABLED=false` until approval — UI correctly shows AMAPI DISABLED |
| Live AMAPI errors | Keep dry-run until Google quota + credentials |

## Metrics / logs

Structured console logs: `[emi-locker] tenant=… scanned=… restricted=…`.  
Audit events: `EMI_LOCKER_*` on `AuditEvent`.

## Phase 3 acceptance (real DB)

```bash
cd apps/backend
# Dedicated accept DB (recommended)
set PHASE3_DATABASE_URL=postgresql://USER:PASS@localhost:5432/hexalyte_emi_accept
npx prisma db push --skip-generate
npx tsx src/modules/emi-locker/phase3-acceptance.ts
```

Keeps `EMI_LOCKER_DRY_RUN=true` and `ANDROID_MANAGEMENT_ENABLED=false`.
