# EMI Locker — Security

## Mandatory controls

- Tenant isolation on every query (`tenantId`)
- Existing JWT auth + RBAC module matrix (`EMI_LOCKER`)
- Zod validation on mutating routes
- Idempotent device commands (`tenantId` + `idempotencyKey`)
- Audit via `AuditEvent` (`recordAuditEvent`)
- No Google credentials in frontend or QR
- Backend verifies HP payment/completion — never trust frontend device/payment status
- Dry-run by default; AMAPI live gated by env

## Dangerous actions

`restrict` / `restore` / `release` require `OWNER` or `MANAGER` + edit access + confirmation UI.

If `manualApprovalRequired`, restriction stays pending until approved.

## Threat notes

Do not implement wipe/brick as EMI enforcement.  
Do not bypass Android security.  
Do not collect personal user content for collections.
