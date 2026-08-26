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
  PayrollCalcLine,
  PayrollCalcResult,
} from './hr-engine.types'

export type {
  AttendanceCalcInput,
  AttendanceCalcResult,
  AttendanceStatusResult,
  ShiftWindow,
} from './hr-engine.attendance'

export {
  planEmploymentStatusChange,
  planEmploymentChange,
  planEmploymentUpdateEvents,
  planEmploymentCreateEvents,
  planUserLinkEvents,
} from './hr-engine.employment'

export {
  calculateAttendanceResult,
  scheduledShiftMinutes,
  validateShiftWindow,
  minutesInColombo,
  clampMinutes,
} from './hr-engine.attendance'

export {
  calculateLeaveDays,
  leaveRangesOverlap,
  calculateLeaveResult,
  leaveAvailable,
  balanceAfterSubmit,
  balanceAfterApprove,
  balanceAfterRejectOrCancelPending,
  balanceAfterCancelApproved,
} from './hr-engine.leave'

export type { LeaveRange, LeaveBalanceSnapshot, LeaveCalcResult, LeaveDayPart } from './hr-engine.leave'

export {
  calculateCompensationResult,
  calculatePayrollResult,
  calculateCommissionPreview,
  resolveComponentAmount,
  summarizePayrollLines,
} from './hr-engine.compensation'

export type {
  CompComponentInput,
  CompensationInput,
  CommissionDoc,
  CommissionRuleInput,
} from './hr-engine.compensation'
