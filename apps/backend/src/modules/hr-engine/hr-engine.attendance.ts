/**
 * Pure attendance / shift calculations (HR Phase 2).
 * No DB / HTTP — same inputs always produce the same result.
 */

export type AttendanceStatusResult =
  | 'PRESENT'
  | 'LATE'
  | 'HALF_DAY'
  | 'ABSENT'
  | 'ON_LEAVE'
  | 'HOLIDAY'

export type ShiftWindow = {
  startMinutes: number
  endMinutes: number
  graceMinutes?: number
  halfDayMinutes?: number | null
  isOvernight?: boolean
}

export type AttendanceCalcInput = {
  checkInAt: Date | null
  checkOutAt: Date | null
  /** Clock used for “now” when still clocked in without checkout (optional). */
  asOf?: Date
  shift: ShiftWindow | null
  /** Forced status (manual ABSENT / HOLIDAY / ON_LEAVE) skips time math when no punches. */
  forcedStatus?: AttendanceStatusResult | null
}

export type AttendanceCalcResult = {
  status: AttendanceStatusResult
  workedMinutes: number
  lateMinutes: number
  earlyLeaveMinutes: number
  overtimeMinutes: number
  scheduledMinutes: number
  ruleId: string
}

export function scheduledShiftMinutes(shift: ShiftWindow): number {
  const start = clampMinutes(shift.startMinutes)
  const end = clampMinutes(shift.endMinutes)
  const overnight = shift.isOvernight ?? end < start
  if (overnight) return (1440 - start) + end
  return Math.max(0, end - start)
}

export function clampMinutes(m: number): number {
  if (!Number.isFinite(m)) return 0
  return Math.max(0, Math.min(1439, Math.floor(m)))
}

/** Minutes from midnight in Asia/Colombo for an instant. */
export function minutesInColombo(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(at)
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find(p => p.type === 'minute')?.value ?? '0')
  // en-GB may give 24:00 for midnight — normalize
  const h = hour === 24 ? 0 : hour
  return h * 60 + minute
}

function diffMinutes(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000))
}

/**
 * Deterministic attendance result from punches + optional shift window.
 */
export function calculateAttendanceResult(input: AttendanceCalcInput): AttendanceCalcResult {
  if (input.forcedStatus === 'ABSENT' || input.forcedStatus === 'HOLIDAY' || input.forcedStatus === 'ON_LEAVE') {
    return {
      status: input.forcedStatus,
      workedMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      scheduledMinutes: input.shift ? scheduledShiftMinutes(input.shift) : 0,
      ruleId: `attendance.forced.${input.forcedStatus.toLowerCase()}`,
    }
  }

  if (!input.checkInAt) {
    return {
      status: 'ABSENT',
      workedMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      scheduledMinutes: input.shift ? scheduledShiftMinutes(input.shift) : 0,
      ruleId: 'attendance.absent.no_check_in',
    }
  }

  const endAt = input.checkOutAt ?? input.asOf ?? null
  const workedMinutes = endAt ? diffMinutes(input.checkInAt, endAt) : 0

  if (!input.shift) {
    const status: AttendanceStatusResult =
      !input.checkOutAt && !input.asOf
        ? 'PRESENT'
        : workedMinutes >= 240
          ? 'PRESENT'
          : workedMinutes > 0
            ? 'HALF_DAY'
            : 'PRESENT'
    return {
      status,
      workedMinutes,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      scheduledMinutes: 0,
      ruleId: 'attendance.no_shift',
    }
  }

  const shift = input.shift
  const scheduled = scheduledShiftMinutes(shift)
  const grace = Math.max(0, shift.graceMinutes ?? 10)
  const halfThreshold = shift.halfDayMinutes != null
    ? Math.max(0, shift.halfDayMinutes)
    : Math.floor(scheduled / 2)

  const start = clampMinutes(shift.startMinutes)
  const end = clampMinutes(shift.endMinutes)
  const overnight = shift.isOvernight ?? end < start

  const inMin = minutesInColombo(input.checkInAt)
  let lateMinutes = 0
  if (!overnight) {
    lateMinutes = Math.max(0, inMin - (start + grace))
  } else {
    // Overnight: late only if check-in is after start+grace and before midnight,
    // or after midnight but somehow before end (treat post-midnight check-in before end as not late for start).
    if (inMin >= start) {
      lateMinutes = Math.max(0, inMin - (start + grace))
    } else {
      lateMinutes = 0
    }
  }

  let earlyLeaveMinutes = 0
  if (input.checkOutAt) {
    const outMin = minutesInColombo(input.checkOutAt)
    if (!overnight) {
      earlyLeaveMinutes = Math.max(0, end - outMin)
    } else if (outMin <= end) {
      earlyLeaveMinutes = Math.max(0, end - outMin)
    } else if (outMin >= start) {
      earlyLeaveMinutes = 0
    }
  }

  const overtimeMinutes = Math.max(0, workedMinutes - scheduled)

  let status: AttendanceStatusResult = 'PRESENT'
  let ruleId = 'attendance.present'
  if (workedMinutes > 0 && workedMinutes < halfThreshold) {
    status = 'HALF_DAY'
    ruleId = 'attendance.half_day'
  } else if (lateMinutes > 0) {
    status = 'LATE'
    ruleId = 'attendance.late'
  }

  return {
    status,
    workedMinutes,
    lateMinutes,
    earlyLeaveMinutes,
    overtimeMinutes,
    scheduledMinutes: scheduled,
    ruleId,
  }
}

export function validateShiftWindow(startMinutes: number, endMinutes: number, isOvernight?: boolean): {
  ok: boolean
  reason?: string
  isOvernight: boolean
} {
  const start = clampMinutes(startMinutes)
  const end = clampMinutes(endMinutes)
  if (start === end) return { ok: false, reason: 'Shift start and end cannot be equal', isOvernight: false }
  const overnight = isOvernight ?? end < start
  if (!overnight && end < start) {
    return { ok: false, reason: 'End is before start — enable overnight or fix times', isOvernight: false }
  }
  return { ok: true, isOvernight: overnight }
}
