# EMI Locker — Enrollment

## Admin UI flow (Phase 2)

Route: `/dashboard/emi-locker/enrollment`

1. Select existing Hire Purchase agreement (customer + IMEI come from HP)
2. Confirm device-management consent
3. `POST /devices` → `ManagedDevice`
4. `POST /devices/:id/enrollment` with `consented: true`
5. Display enrollment code + expiry countdown
6. When AMAPI is enabled and not dry-only, render provisioning QR
7. Device completes supported Android Enterprise provisioning
8. Backend marks enrollment consumed → device `ENROLLED` / `ACTIVE`

## Honesty banners

| Flag | UI / API behaviour |
|------|--------------------|
| `ANDROID_MANAGEMENT_ENABLED=false` | **AMAPI DISABLED** — no Google enrollment QR invented |
| `EMI_LOCKER_DRY_RUN=true` | **DRY RUN** — commands recorded as `DRY_RUN` |

Do not pretend a live Google enrollment token exists when AMAPI is disabled.

## QR rules

Allowed: short-lived enrollment token, enrollment code, expiry, AMAPI provisioning extras.

Never include: DB credentials, Google service-account JSON, JWT access tokens, permanent API secrets, unnecessary customer PII.

## Token security

- Raw token returned once to admin for QR rendering
- Only SHA-256 `tokenHash` retained long-term
- One-time consume; expired tokens rejected (`410`)
- Regenerating enrollment cancels prior pending tokens
