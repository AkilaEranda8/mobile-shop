/**
 * Run: npx tsx src/modules/workflow-validators/workflow-validators.service.test.ts
 */
import { canTransition } from './workflow-validators.service'
import { WORKFLOW_VALIDATORS_FEATURE } from './workflow-validators.feature'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

assert(WORKFLOW_VALIDATORS_FEATURE === 'WORKFLOW_VALIDATORS', 'feature key')

assert(canTransition('RepairTicket', 'RECEIVED', 'IN_REPAIR').allowed, 'received→in_repair')
assert(canTransition('RepairTicket', 'READY', 'DELIVERED').allowed === false, 'ready→delivered blocked')
assert(
  canTransition('RepairTicket', 'READY', 'DELIVERED', { via: 'collect_payment' }).allowed,
  'deliver via collect_payment',
)
assert(canTransition('RepairTicket', 'DELIVERED', 'READY').allowed === false, 'no reopen delivered')
assert(canTransition('RepairTicket', 'IN_REPAIR', 'CANCELLED').allowed, 'cancel from in_repair')
assert(canTransition('RepairTicket', 'RECEIVED', 'READY').allowed === false, 'skip to ready blocked')

assert(canTransition('PurchaseOrder', 'DRAFT', 'SENT').allowed, 'draft→sent')
assert(canTransition('PurchaseOrder', 'SENT', 'RECEIVED').allowed, 'sent→received')
assert(canTransition('PurchaseOrder', 'RECEIVED', 'CLOSED').allowed, 'received→closed')
assert(canTransition('PurchaseOrder', 'CLOSED', 'DRAFT').allowed === false, 'closed terminal')
assert(canTransition('PurchaseOrder', 'DRAFT', 'PARTIAL').allowed === false, 'draft→partial blocked')

console.log('workflow-validators.service.test.ts: all checks passed')
