/**
 * HR Engine facade — pure business-logic entrypoints.
 * Application services (`modules/hr`) call these; controllers do not.
 */
export { HR_ENGINE_VERSION } from './hr-engine.types'
export type {
  EmploymentStatus,
  EmploymentEventKind,
  EmploymentSnapshot,
  EmploymentStatusPlan,
  EmploymentChangePlan,
  PlannedEmploymentEvent,
  AttendanceCalcInput,
  AttendanceCalcResult,
  PayrollCalcLine,
  PayrollCalcResult,
} from './hr-engine.types'

export {
  planEmploymentStatusChange,
  planEmploymentChange,
  planEmploymentUpdateEvents,
  planEmploymentCreateEvents,
  planUserLinkEvents,
} from './hr-engine.employment'

/**
 * Future Phase 2–6 stubs — throw until domain models exist.
 * Keeps the API surface discoverable without inventing calculations.
 */
export function calculateAttendanceResult(_input: unknown): never {
  throw new Error('HR Engine: attendance calculation not implemented (Phase 2)')
}

export function calculateLeaveResult(_input: unknown): never {
  throw new Error('HR Engine: leave calculation not implemented (Phase 3)')
}

export function calculateCompensationResult(_input: unknown): never {
  throw new Error('HR Engine: compensation calculation not implemented (Phase 4)')
}

export function calculatePayrollResult(_input: unknown): never {
  throw new Error('HR Engine: payroll calculation not implemented (Phase 5–6)')
}
