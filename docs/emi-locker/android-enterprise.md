# EMI Locker — Android Enterprise

## Official capability (do not invent)

Use Google Android Management API only:

- `enterprises.enrollmentTokens.create`
- Policy bind / update on enrolled devices
- `devices.get` / `devices.delete` (release/unenroll)

Docs:

- https://developers.google.com/android/management/provision-device
- https://developers.google.com/android/management/permissible-usage

## Gates

| Flag | Default | Meaning |
|------|---------|---------|
| `ANDROID_MANAGEMENT_ENABLED` | `false` | Live Google calls off |
| `EMI_LOCKER_DRY_RUN` | `true` | Force dry-run globally |
| Tenant `dryRunEnabled` | `true` | Per-branch dry-run |

New Cloud projects often have **0 device enrollment quota** until Google approves an increase. Do not enable live enrollment until quota exists.

## Hexalyte service

`AndroidManagementService` (`apps/backend/src/modules/emi-locker/android-management.service.ts`):

- Dry-run / disabled: simulate tokens & policy apply; persist `DeviceCommand` with `DRY_RUN`
- Live: throws until official googleapis client + credentials are wired (Phase 17)

## Forbidden as EMI enforcement

- Factory reset / wipe
- Permanent bricking
- Credential theft
- Personal content surveillance (SMS, photos, passwords, mic/camera)
