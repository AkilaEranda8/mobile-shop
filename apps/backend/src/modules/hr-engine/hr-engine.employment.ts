/**
 * Pure employment lifecycle rules extracted from Phase-1 `employees.service`.
 * Behavior-preserving: no new hard transition graph (would regress open status edits).
 */
import type {
  EmploymentChangePlan,
  EmploymentEventKind,
  EmploymentSnapshot,
  EmploymentStatus,
  EmploymentStatusPlan,
  PlannedEmploymentEvent,
} from './hr-engine.types'
import { HR_ENGINE_VERSION } from './hr-engine.types'

const TERMINAL: ReadonlySet<EmploymentStatus> = new Set(['RESIGNED', 'TERMINATED'])

/**
 * Derive field patches + event type when employment status changes.
 * Matches existing service exit behavior, plus reactivation clear:
 * - RESIGNED / TERMINATED → leftAt = now, isActive = false
 * - leaving RESIGNED/TERMINATED → leftAt = null, isActive = true
 * - otherwise → status event only
 */
export function planEmploymentStatusChange(
  from: EmploymentStatus,
  to: EmploymentStatus,
  now: Date = new Date(),
): EmploymentStatusPlan | null {
  if (from === to) return null

  const toTerminal = TERMINAL.has(to)
  const fromTerminal = TERMINAL.has(from)

  if (toTerminal) {
    return {
      status: to,
      setLeftAt: now,
      setIsActive: false,
      eventType: 'STATUS_CHANGED',
      ruleId: 'employment.status.exit',
    }
  }

  if (fromTerminal) {
    return {
      status: to,
      setLeftAt: null,
      setIsActive: true,
      eventType: 'STATUS_CHANGED',
      ruleId: 'employment.status.reactivate',
    }
  }

  return {
    status: to,
    setLeftAt: undefined,
    setIsActive: undefined,
    eventType: 'STATUS_CHANGED',
    ruleId: 'employment.status.changed',
  }
}

export type PlanEmploymentChangeInput = {
  before: EmploymentSnapshot
  after: {
    status?: EmploymentStatus
    primaryBranchId?: string
    departmentId?: string | null
    designationId?: string | null
    userId?: string | null
    confirmedAt?: Date | null
  }
  now?: Date
  /** When true, emit UPDATED if no other structural events (Phase-1 update path). */
  emitGenericUpdated?: boolean
}

/**
 * Plan employment events for a patch — mirrors employees.service update + linkUser.
 * Pure: no DB, no HTTP.
 */
export function planEmploymentChange(input: PlanEmploymentChangeInput): EmploymentChangePlan {
  const now = input.now ?? new Date()
  const { before, after } = input
  const events: PlannedEmploymentEvent[] = []
  const fieldPatches: EmploymentChangePlan['fieldPatches'] = {}

  let statusPlan: EmploymentStatusPlan | null = null
  if (after.status != null && after.status !== before.status) {
    statusPlan = planEmploymentStatusChange(before.status, after.status, now)
    if (statusPlan) {
      if (statusPlan.setLeftAt !== undefined) fieldPatches.leftAt = statusPlan.setLeftAt
      if (statusPlan.setIsActive !== undefined) fieldPatches.isActive = statusPlan.setIsActive
      events.push({
        eventType: statusPlan.eventType,
        beforeJson: { status: before.status },
        afterJson: { status: statusPlan.status },
        note: statusPlan.ruleId,
      })
    }
  }

  if (
    after.primaryBranchId != null
    && after.primaryBranchId !== before.primaryBranchId
  ) {
    events.push({
      eventType: 'BRANCH_CHANGED',
      beforeJson: { primaryBranchId: before.primaryBranchId },
      afterJson: { primaryBranchId: after.primaryBranchId },
    })
  }

  if (
    after.departmentId !== undefined
    && after.departmentId !== (before.departmentId ?? null)
  ) {
    events.push({
      eventType: 'TRANSFERRED',
      beforeJson: { departmentId: before.departmentId ?? null },
      afterJson: { departmentId: after.departmentId },
      note: 'department.changed',
    })
  }

  if (
    after.designationId !== undefined
    && after.designationId !== (before.designationId ?? null)
  ) {
    events.push({
      eventType: 'PROMOTED',
      beforeJson: { designationId: before.designationId ?? null },
      afterJson: { designationId: after.designationId },
      note: 'designation.changed',
    })
  }

  if (
    after.confirmedAt !== undefined
    && after.confirmedAt
    && !before.confirmedAt
  ) {
    events.push({
      eventType: 'CONFIRMED',
      afterJson: { confirmedAt: after.confirmedAt.toISOString() },
    })
  }

  if (after.userId !== undefined && after.userId !== (before.userId ?? null)) {
    const linked = Boolean(after.userId)
    events.push({
      eventType: (linked ? 'USER_LINKED' : 'USER_UNLINKED') as EmploymentEventKind,
      beforeJson: { userId: before.userId ?? null },
      afterJson: { userId: after.userId },
    })
  }

  // Phase-1 compatibility: update() always wrote UPDATED when no status change.
  // Branch-only / profile edits still get a catch-all UPDATED if nothing structural fired
  // OR when emitGenericUpdated and only non-status edits (status already covered).
  const structural = events.some(e =>
    e.eventType === 'STATUS_CHANGED'
    || e.eventType === 'BRANCH_CHANGED'
    || e.eventType === 'USER_LINKED'
    || e.eventType === 'USER_UNLINKED',
  )

  if (input.emitGenericUpdated && !structural) {
    // Match Phase-1: if status changed, do NOT also emit UPDATED.
    // If only branch changed, Phase-1 emitted BOTH BRANCH_CHANGED and skipped UPDATED
    // (else branch only when !statusEvent). So when branch-only, no UPDATED.
    // When neither status nor branch, emit UPDATED.
    const hasBranch = events.some(e => e.eventType === 'BRANCH_CHANGED')
    if (!hasBranch && !statusPlan) {
      events.push({ eventType: 'UPDATED' })
    }
  }

  // Phase-1 exact: status → STATUS_CHANGED only; branch → BRANCH_CHANGED (and if also
  // no status, no UPDATED); else UPDATED. Department/designation were NOT separate events
  // in Phase-1 — they fell under UPDATED. Keep that unless we only have dept/desig changes.
  // Reconcile: strip TRANSFERRED/PROMOTED when preserving Phase-1 event set for updates.
  // Callers that want richer events can use planEmploymentChangeRich.

  return {
    statusPlan,
    events,
    fieldPatches,
    engineVersion: HR_ENGINE_VERSION,
  }
}

/**
 * Phase-1–compatible event planner for employees.service.update.
 * Does NOT emit TRANSFERRED/PROMOTED (those were not in Phase-1).
 */
export function planEmploymentUpdateEvents(input: {
  before: EmploymentSnapshot
  nextStatus?: EmploymentStatus
  nextBranchId?: string
  now?: Date
}): EmploymentChangePlan {
  const now = input.now ?? new Date()
  const events: PlannedEmploymentEvent[] = []
  const fieldPatches: EmploymentChangePlan['fieldPatches'] = {}

  let statusPlan: EmploymentStatusPlan | null = null
  if (input.nextStatus != null && input.nextStatus !== input.before.status) {
    statusPlan = planEmploymentStatusChange(input.before.status, input.nextStatus, now)
    if (statusPlan) {
      if (statusPlan.setLeftAt !== undefined) fieldPatches.leftAt = statusPlan.setLeftAt
      if (statusPlan.setIsActive !== undefined) fieldPatches.isActive = statusPlan.setIsActive
    }
  }

  // Event order matches Phase-1 employees.service: branch first, then status OR updated.
  if (input.nextBranchId && input.nextBranchId !== input.before.primaryBranchId) {
    events.push({
      eventType: 'BRANCH_CHANGED',
      beforeJson: { primaryBranchId: input.before.primaryBranchId },
      afterJson: { primaryBranchId: input.nextBranchId },
    })
  }

  if (statusPlan) {
    events.push({
      eventType: statusPlan.eventType,
      beforeJson: { status: input.before.status },
      afterJson: { status: statusPlan.status },
    })
  } else {
    events.push({ eventType: 'UPDATED' })
  }

  return {
    statusPlan,
    events,
    fieldPatches,
    engineVersion: HR_ENGINE_VERSION,
  }
}

/** Create-path: JOINED (+ optional USER_LINKED). */
export function planEmploymentCreateEvents(input: {
  employeeCode: string
  fullName: string
  status: EmploymentStatus
  userId?: string | null
}): PlannedEmploymentEvent[] {
  const events: PlannedEmploymentEvent[] = [
    {
      eventType: 'JOINED',
      note: 'Employee created',
      afterJson: {
        employeeCode: input.employeeCode,
        fullName: input.fullName,
        status: input.status,
      },
    },
  ]
  if (input.userId) {
    events.push({
      eventType: 'USER_LINKED',
      afterJson: { userId: input.userId },
    })
  }
  return events
}

export function planUserLinkEvents(input: {
  previousUserId: string | null
  nextUserId: string | null
}): PlannedEmploymentEvent[] {
  if (input.previousUserId === input.nextUserId) return []
  return [{
    eventType: input.nextUserId ? 'USER_LINKED' : 'USER_UNLINKED',
    beforeJson: { userId: input.previousUserId },
    afterJson: { userId: input.nextUserId },
  }]
}
