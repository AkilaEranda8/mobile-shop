# EMI Locker — Setup

## Prerequisites

1. Hire Purchase feature enabled for the tenant
2. Apply Prisma migrations:
   - `20260909120000_emi_device_locker`
   - `20260909140000_emi_locker_production_align`
3. Enable tenant feature `EMI_LOCKER` in platform admin

## Environment (`.env`)

```bash
EMI_LOCKER_ENABLED=true
EMI_LOCKER_DRY_RUN=true
ANDROID_MANAGEMENT_ENABLED=false
# ANDROID_MANAGEMENT_ENTERPRISE_NAME=enterprises/LC...
# GOOGLE_APPLICATION_CREDENTIALS=/secure/path/sa.json
```

Defaults keep **dry-run** on and **AMAPI live** off until Google AE registration, permissible-use approval, device quota, and credentials exist.

## Role access

Module key: `EMI_LOCKER` (`view` / `edit` in tenant role matrix).

Dangerous actions (restrict / restore / release) require `OWNER` or `MANAGER` plus edit access.

## Smoke checklist

1. Create HP agreement with IMEI
2. Open `/dashboard/emi-locker/enrollment` — register managed device + consent
3. Enrollment UI shows **AMAPI DISABLED** (no fake Google QR) when `ANDROID_MANAGEMENT_ENABLED=false`
4. Confirm dashboard shows **DRY RUN MODE**
5. Device list / detail load from API
6. Record overdue past grace → worker creates `DRY_RUN` restriction command
7. Collect HP payment → restore eligibility → `REMOVE_RESTRICTION` (dry-run)
8. Complete HP → release eligibility → `RELEASE_DEVICE` (dry-run)
9. Unauthorized role cannot restrict/release; cross-tenant device id returns 404/403

## Automated checks

```bash
cd apps/backend
npx tsx src/modules/emi-locker/emi-locker.schema.test.ts
npx tsx src/modules/emi-locker/emi-locker-eligibility.test.ts
npx tsx src/modules/emi-locker/emi-locker-dryrun.e2e.test.ts

# Phase 3 real-DB acceptance (dedicated DB hexalyte_emi_accept)
npx prisma db push --skip-generate
npx tsx src/modules/emi-locker/phase3-acceptance.ts

# Phase 4 HTTP + JWT matrix (in-process Express, mocked Redis)
npx tsx src/modules/emi-locker/phase4-http.acceptance.ts

# Optional browser smoke API
npx tsx src/modules/emi-locker/phase4-dev-server.ts
# then: apps/web `npx next dev -p 3000`
# login: emi-phase4-owner@hexalyte.test / Phase4@Test1
```

Migration divergence for local `hexalyte` DB: see `docs/emi-locker/migration-reconciliation.md` (plan only).
