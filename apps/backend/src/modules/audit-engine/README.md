# Audit Engine (Phase 1)

Structured append-only `AuditEvent` writes. Prefer this over raw Prisma creates.

**Flag:** none for Phase 1 (consolidates existing accounting audits)  
**Blueprint:** Section 4.3.9

## Entrypoints

| Function | Use |
|----------|-----|
| `recordAuditEvent(input, db?)` | Create audit row; returns id |
| `recordAuditEventSafe(input, db?)` | Never throws (optional hooks) |
| `listAuditEvents(tenantId, opts)` | Paginated read |

## Consumers

- Accounting period close / reopen
- Manual journal post / approve / reverse
- Accounting initialize
- `accounting/audit/audit.service` re-exports `listAuditEvents`

## Next

- Optional operational audits (sale/PO/repair) behind opt-in flag
- Correlation IDs across StockMovement + AccountingOutbox
