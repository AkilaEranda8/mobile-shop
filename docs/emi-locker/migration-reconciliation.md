# EMI Locker — Migration Reconciliation Plan (Phase 4)

## Scope

Compare the **repository** migration history with the **local `hexalyte`** database.

This is a **plan only**. Do **not** run `prisma migrate reset` against any shared/production database.

## Observed state (local machine, 2026-09-09 — closeout re-check)

### `DATABASE_URL` target (apps/backend/.env)

- **Host:** `localhost:5432`
- **Database name:** `hexalyte`
- **Environment:** local development (no credentials logged)
- **Schema content:** CMS/marketing tables (`BlogPost`, `Lead`, `PortfolioProject`, …). Retail SaaS tables `Tenant`, `Customer`, `Sale`, `ManagedDevice`, `Branch` are **MISSING**.
- **`_prisma_migrations`:** `20260907120000_init` (finished) + failed/incomplete `20250607120000_tenant_feature_price`
- **Customer/business retail data:** **Not present** in this DB (wrong product schema for Hexalyte retail). Still treat as **non-production local**, but **do not** baseline/reset until an owner explicitly confirms it is disposable — it may hold unrelated CMS content (`User` count=1 observed).

### Classification update

| Item | Classification |
|------|----------------|
| Local `hexalyte` | Local CMS/marketing DB with divergent Prisma history — **not** Hexalyte retail app schema. Reconciliation remains **PLAN ONLY**. |
| `hexalyte_emi_accept` | Disposable EMI acceptance DB (`db push`) |

### Closeout decision

**No destructive migration operations were performed** (`migrate reset` / DROP / baseline apply skipped).


## Recommended reconciliation paths

### Path A — Keep accept DB for EMI work (short term)

1. Continue Phase 4 / dry-run EMI testing on `hexalyte_emi_accept`.
2. Point local backend `DATABASE_URL` at accept DB when testing EMI.
3. Do not `migrate deploy` onto the divergent `hexalyte` DB.

### Path B — Baseline divergent `hexalyte` (dev only, after backup)

Only if this DB is confirmed **non-production** and disposable:

1. Take a full `pg_dump` backup.
2. Document the existing `_prisma_migrations` rows (especially `20260907120000_init`).
3. Options (pick one with team approval):
   - **B1**: Mark the DB as baselined to the current schema using Prisma’s baseline workflow (`migrate resolve` / `migrate diff`) so future **forward-only** migrations apply cleanly.
   - **B2**: Create a fresh DB from `migrate deploy` of the full repo history, then optionally copy needed data.
4. Never rewrite or delete already-applied migration SQL files in git.
5. Never edit applied migration checksums in production.

### Path C — Production / staging

1. Identify environment explicitly.
2. Run `prisma migrate status` against that environment’s URL (read-only first).
3. If EMI migrations are missing, apply **only** forward migrations:
   - `20260909120000_emi_device_locker`
   - `20260909140000_emi_locker_production_align`
   (and any later EMI migrations), after backup + staging rehearsal.
4. If history is squashed differently in prod, generate a **new** forward migration via `prisma migrate diff` from live schema → desired schema — do not replay the entire 87-migration chain blindly.

## EMI-specific requirement

EMI Locker tables must exist before production cutover:

- `ManagedDevice`, `DeviceEnrollment`, `DevicePolicy`, `DeviceCommand`, `DeviceEvent`, `EmiLockerSettings`

Verify with:

```sql
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'ManagedDevice','DeviceEnrollment','DevicePolicy',
    'DeviceCommand','DeviceEvent','EmiLockerSettings'
  );
```

## Explicit non-actions

- Do not `prisma migrate reset` on production.
- Do not delete migration folders.
- Do not modify checksums of applied migrations.
- Do not enable AMAPI as part of migration work.
