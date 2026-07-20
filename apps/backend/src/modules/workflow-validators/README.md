# Workflow Validators (Phase 1)

Pure state-transition checks for RepairTicket and PurchaseOrder. **No DB writes.**

**Flag:** `WORKFLOW_VALIDATORS` — opt-in, default OFF  
**Blueprint:** Section 4.3.6

## Behavior

| Flag | Repair status update | PO status update |
|------|----------------------|------------------|
| OFF | Hard rule only: cannot set `DELIVERED` (must Collect Payment) | No new checks |
| ON | Full repair graph + terminals | Full PO graph |

`DELIVERED` is allowed only with `{ via: 'collect_payment' }` (collect payment flow).

## Entrypoints

| Function | Use |
|----------|-----|
| `canTransition(entity, from, to, ctx?)` | Pure decision |
| `assertRepairTransitionIfEnabled` | repairs.service |
| `assertPurchaseOrderTransitionIfEnabled` | suppliers PO update |

## Graphs

See `workflow-validators.graphs.ts`.
