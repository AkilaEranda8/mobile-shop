/**
 * HR Engine — domain types (pure contracts, no HTTP / Prisma).
 * Source of truth for Phase 1 = existing `modules/hr` behavior.
 */

export const HR_ENGINE_VERSION = '1.4.0-phase4-7'

export type EmploymentStatus =
  | 'CANDIDATE'
  | 'ACTIVE'
  | 'ON_LEAVE'
  | 'SUSPENDED'
  | 'RESIGNED'
  | 'TERMINATED'

export type EmploymentEventKind =
  | 'JOINED'
  | 'CONFIRMED'
  | 'TRANSFERRED'
  | 'PROMOTED'
  | 'SALARY_CHANGED'
  | 'BRANCH_CHANGED'
  | 'STATUS_CHANGED'
  | 'RESIGNED'
  | 'TERMINATED'
  | 'USER_LINKED'
  | 'USER_UNLINKED'
  | 'UPDATED'

export type EmploymentSnapshot = {
  status: EmploymentStatus
  primaryBranchId: string
  departmentId?: string | null
  designationId?: string | null
  userId?: string | null
  isActive: boolean
  leftAt?: Date | null
  confirmedAt?: Date | null
}

export type EmploymentStatusPlan = {
  /** Status after transition (same as `to` when allowed). */
  status: EmploymentStatus
  /** Field patches implied by the transition — mirrors Phase-1 service. */
  setLeftAt: Date | null | undefined
  setIsActive: boolean | undefined
  /** Primary employment event for this status change. */
  eventType: EmploymentEventKind
  /** Human-readable rule id for audit metadata. */
  ruleId: string
}

export type PlannedEmploymentEvent = {
  eventType: EmploymentEventKind
  beforeJson?: Record<string, unknown>
  afterJson?: Record<string, unknown>
  note?: string
}

export type EmploymentChangePlan = {
  statusPlan: EmploymentStatusPlan | null
  events: PlannedEmploymentEvent[]
  fieldPatches: {
    leftAt?: Date | null
    isActive?: boolean
  }
  engineVersion: string
}

export type PayrollCalcLine = {
  code: string
  label: string
  amount: number
  kind: 'EARNING' | 'DEDUCTION' | 'EMPLOYER'
}

export type PayrollCalcResult = {
  gross: number
  deductions: number
  net: number
  lines: PayrollCalcLine[]
  deterministicHash: string
}
