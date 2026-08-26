/**
 * Run: npx tsx src/modules/hr-engine/hr-engine.employment.test.ts
 */
import {
  planEmploymentStatusChange,
  planEmploymentUpdateEvents,
  planEmploymentCreateEvents,
  planUserLinkEvents,
} from './hr-engine.employment'
import { HR_ENGINE_VERSION } from './hr-engine.types'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

assert(HR_ENGINE_VERSION.startsWith('1.'), 'engine version set')

const now = new Date('2026-08-26T10:00:00.000Z')

// --- status exit ---
const exit = planEmploymentStatusChange('ACTIVE', 'RESIGNED', now)
assert(!!exit, 'exit plan exists')
assert(exit!.setIsActive === false, 'resign deactivates')
assert(exit!.setLeftAt?.toISOString() === now.toISOString(), 'resign sets leftAt')
assert(exit!.eventType === 'STATUS_CHANGED', 'status event')
assert(exit!.ruleId === 'employment.status.exit', 'exit rule')

const term = planEmploymentStatusChange('ACTIVE', 'TERMINATED', now)
assert(term!.setIsActive === false, 'terminate deactivates')

const leave = planEmploymentStatusChange('ACTIVE', 'ON_LEAVE', now)
assert(leave!.setLeftAt === undefined, 'on leave does not set leftAt')
assert(leave!.setIsActive === undefined, 'on leave does not force isActive')
assert(leave!.ruleId === 'employment.status.changed', 'non-exit rule')

const reactivate = planEmploymentStatusChange('RESIGNED', 'ACTIVE', now)
assert(reactivate!.setIsActive === true, 'reactivate sets active')
assert(reactivate!.setLeftAt === null, 'reactivate clears leftAt')
assert(reactivate!.ruleId === 'employment.status.reactivate', 'reactivate rule')

assert(planEmploymentStatusChange('ACTIVE', 'ACTIVE', now) === null, 'noop status')

// --- Phase-1 update event parity ---
const base = {
  status: 'ACTIVE' as const,
  primaryBranchId: 'b1',
  departmentId: 'd1',
  designationId: null,
  userId: null,
  isActive: true,
  leftAt: null,
  confirmedAt: null,
}

const profileOnly = planEmploymentUpdateEvents({ before: base, now })
assert(profileOnly.events.length === 1, 'profile → one event')
assert(profileOnly.events[0].eventType === 'UPDATED', 'profile → UPDATED')
assert(!profileOnly.statusPlan, 'no status plan')

const statusOnly = planEmploymentUpdateEvents({
  before: base,
  nextStatus: 'ON_LEAVE',
  now,
})
assert(statusOnly.events.length === 1, 'status → one event')
assert(statusOnly.events[0].eventType === 'STATUS_CHANGED', 'status → STATUS_CHANGED')
assert(!statusOnly.events.some(e => e.eventType === 'UPDATED'), 'no UPDATED with status')

const branchOnly = planEmploymentUpdateEvents({
  before: base,
  nextBranchId: 'b2',
  now,
})
assert(branchOnly.events.some(e => e.eventType === 'BRANCH_CHANGED'), 'branch event')
assert(branchOnly.events.some(e => e.eventType === 'UPDATED'), 'branch-only also UPDATED (Phase-1)')

const both = planEmploymentUpdateEvents({
  before: base,
  nextStatus: 'SUSPENDED',
  nextBranchId: 'b2',
  now,
})
assert(both.events.some(e => e.eventType === 'BRANCH_CHANGED'), 'both: branch')
assert(both.events.some(e => e.eventType === 'STATUS_CHANGED'), 'both: status')
assert(!both.events.some(e => e.eventType === 'UPDATED'), 'both: no UPDATED')

const resign = planEmploymentUpdateEvents({
  before: base,
  nextStatus: 'RESIGNED',
  now,
})
assert(resign.fieldPatches.isActive === false, 'resign patch isActive')
assert(resign.fieldPatches.leftAt?.toISOString() === now.toISOString(), 'resign patch leftAt')

// --- create / link ---
const created = planEmploymentCreateEvents({
  employeeCode: 'EMP-0001',
  fullName: 'Nimal',
  status: 'ACTIVE',
  userId: 'u1',
})
assert(created[0].eventType === 'JOINED', 'create JOINED')
assert(created[1].eventType === 'USER_LINKED', 'create USER_LINKED')

const unlink = planUserLinkEvents({ previousUserId: 'u1', nextUserId: null })
assert(unlink[0].eventType === 'USER_UNLINKED', 'unlink')
assert(planUserLinkEvents({ previousUserId: 'u1', nextUserId: 'u1' }).length === 0, 'noop link')

console.log('hr-engine.employment.test.ts: all checks passed')
