/**
 * Run: npx tsx src/modules/hr-engine/hr-engine.leave.test.ts
 */
import {
  calculateLeaveDays,
  leaveRangesOverlap,
  calculateLeaveResult,
  balanceAfterSubmit,
  balanceAfterApprove,
  balanceAfterRejectOrCancelPending,
  balanceAfterCancelApproved,
  leaveAvailable,
} from './hr-engine.leave'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

assert(calculateLeaveDays({ startDate: '2026-08-26', endDate: '2026-08-26' }) === 1, 'full day')
assert(calculateLeaveDays({ startDate: '2026-08-26', endDate: '2026-08-26', startPart: 'AM', endPart: 'AM' }) === 0.5, 'half AM')
assert(calculateLeaveDays({ startDate: '2026-08-26', endDate: '2026-08-28' }) === 3, '3 days')
assert(
  calculateLeaveDays({ startDate: '2026-08-26', endDate: '2026-08-28', startPart: 'PM', endPart: 'AM' }) === 2,
  `span half ends got ${calculateLeaveDays({ startDate: '2026-08-26', endDate: '2026-08-28', startPart: 'PM', endPart: 'AM' })}`,
)

assert(
  leaveRangesOverlap(
    { startDate: '2026-08-26', endDate: '2026-08-27' },
    { startDate: '2026-08-27', endDate: '2026-08-28' },
  ),
  'overlap adjacent inclusive',
)
assert(
  !leaveRangesOverlap(
    { startDate: '2026-08-26', endDate: '2026-08-26', startPart: 'AM', endPart: 'AM' },
    { startDate: '2026-08-26', endDate: '2026-08-26', startPart: 'PM', endPart: 'PM' },
  ),
  'AM/PM same day no overlap',
)

const bal = { entitled: 14, used: 2, pending: 1 }
assert(leaveAvailable(bal) === 11, 'available')

const ok = calculateLeaveResult({
  range: { startDate: '2026-09-01', endDate: '2026-09-02' },
  balance: bal,
  existing: [],
})
assert(ok.days === 2 && ok.sufficient && !ok.overlaps, 'ok request')

const blocked = calculateLeaveResult({
  range: { startDate: '2026-09-01', endDate: '2026-09-05' },
  balance: { entitled: 3, used: 0, pending: 0 },
  existing: [{ startDate: '2026-09-03', endDate: '2026-09-03' }],
})
assert(!blocked.sufficient || blocked.overlaps, 'blocked')
assert(blocked.overlaps, 'overlap flagged')

const afterSubmit = balanceAfterSubmit(bal, 2)
assert(afterSubmit.pending === 3, 'pending +2')
const afterApprove = balanceAfterApprove(afterSubmit, 2)
assert(afterApprove.used === 4 && afterApprove.pending === 1, 'approve moves pending→used')
const afterReject = balanceAfterRejectOrCancelPending(afterSubmit, 2)
assert(afterReject.pending === 1, 'reject clears pending')
const afterCancelPaid = balanceAfterCancelApproved({ entitled: 14, used: 4, pending: 0 }, 2)
assert(afterCancelPaid.used === 2, 'cancel approved restores used')

console.log('hr-engine.leave.test.ts: all checks passed')
