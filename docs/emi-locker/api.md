# EMI Locker — API

Base: `/api/v1/emi-locker`  
Auth: existing Bearer JWT + tenant + `EMI_LOCKER` module access.

## Endpoints (Phase 2)

| Method | Path | Access |
|--------|------|--------|
| GET | `/dashboard` | view |
| GET | `/devices` | view (paginated; search/status filters) |
| POST | `/devices` | edit |
| GET | `/devices/:id` | view (includes commands, events, enrollments, audit) |
| PATCH | `/devices/:id` | edit |
| POST | `/devices/:id/enrollment` | edit (`EMI_LOCKER_ENROLL`) |
| GET | `/devices/:id/enrollment` | view |
| POST | `/devices/:id/sync` | edit |
| POST | `/devices/:id/restrict` | OWNER/MANAGER + edit |
| POST | `/devices/:id/restore` | OWNER/MANAGER + edit |
| POST | `/devices/:id/release` | OWNER/MANAGER + edit |
| GET | `/devices/:id/commands` | view |
| GET | `/devices/:id/events` | view |
| GET | `/commands` | view (global command history) |
| GET/POST | `/policies` | view / OWNER/MANAGER edit |
| PATCH | `/policies/:id` | OWNER/MANAGER edit |
| GET/PATCH | `/settings` | view / OWNER/MANAGER edit |
| GET | `/reports/devices` | view |
| GET | `/reports/restrictions` | view |
| GET | `/reports/collections` | view (HP aggregates only) |
| GET | `/reports/overdue` | view |
| POST | `/enrollment/consume` | edit (agent/callback) |

Financial mutations remain on `/api/v1/hire-purchase/*`.

Response shape matches Hexalyte `sendSuccess` / `sendPaginated`.

## RBAC mapping

Spec actions map onto the tenant `hide|view|edit` matrix for module `EMI_LOCKER`:

| Spec action | Enforcement |
|-------------|-------------|
| `EMI_LOCKER_VIEW` / `REPORTS` | `canViewModule` |
| `EMI_LOCKER_EDIT` / `ENROLL` | `canEditModule` |
| `EMI_LOCKER_RESTRICT` / `RESTORE` / `RELEASE` / `SETTINGS` | `canEditModule` + OWNER/MANAGER |

Never trust frontend-only permission checks.

## Dry-run / AMAPI

- `EMI_LOCKER_DRY_RUN=true` (default) → command status `DRY_RUN`; no live Google policy apply.
- `ANDROID_MANAGEMENT_ENABLED=false` (default) → Google ops blocked with clear error; enrollment does **not** invent a live Google QR.
