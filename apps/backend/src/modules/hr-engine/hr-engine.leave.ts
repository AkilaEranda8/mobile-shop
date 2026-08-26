/**
 * Pure leave rules (HR Phase 3).
 * Calendar-day duration with half-day parts; overlap + balance checks.
 */

export type LeaveDayPart = 'FULL' | 'AM' | 'PM'

export type LeaveRange = {
  startDate: string // YYYY-MM-DD
  endDate: string
  startPart?: LeaveDayPart
  endPart?: LeaveDayPart
}

export type LeaveBalanceSnapshot = {
  entitled: number
  used: number
  pending: number
}

export type LeaveCalcResult = {
  days: number
  available: number
  sufficient: boolean
  overlaps: boolean
  ruleId: string
  errors: string[]
}

function parseKey(dateKey: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error(`Invalid date: ${dateKey}`)
  return new Date(`${dateKey}T00:00:00.000Z`)
}

function keyOf(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function partWeight(part: LeaveDayPart | undefined, isSingleDay: boolean, which: 'start' | 'end'): number {
  const p = part ?? 'FULL'
  if (isSingleDay) {
    if (p === 'FULL') return 1
    return 0.5
  }
  // Multi-day: PM start / AM end count as half of that calendar day.
  if (which === 'start') return p === 'PM' ? 0.5 : 1
  return p === 'AM' ? 0.5 : 1
}

/** Inclusive calendar-day leave duration (half days supported). */
export function calculateLeaveDays(range: LeaveRange): number {
  const start = parseKey(range.startDate)
  const end = parseKey(range.endDate)
  if (end.getTime() < start.getTime()) return 0

  const single = range.startDate === range.endDate
  if (single) {
    const startPart = range.startPart ?? 'FULL'
    const endPart = range.endPart ?? startPart
    if (startPart === 'AM' && endPart === 'PM') return 1
    if (startPart === 'PM' && endPart === 'AM') return 0
    if (startPart !== 'FULL' || endPart !== 'FULL') return 0.5
    return 1
  }

  let days = 0
  const cur = new Date(start)
  const last = end.getTime()
  while (cur.getTime() <= last) {
    const key = keyOf(cur)
    if (key === range.startDate) days += partWeight(range.startPart, false, 'start')
    else if (key === range.endDate) days += partWeight(range.endPart, false, 'end')
    else days += 1
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return Math.round(days * 100) / 100
}

function rangeBounds(range: LeaveRange): { start: number; end: number } {
  // Encode half-days as fractions of the day for overlap: AM=0-0.5, PM=0.5-1, FULL=0-1
  const startBase = parseKey(range.startDate).getTime() / 86_400_000
  const endBase = parseKey(range.endDate).getTime() / 86_400_000
  const single = range.startDate === range.endDate
  const sp = range.startPart ?? 'FULL'
  const ep = range.endPart ?? (single ? sp : 'FULL')

  let start = startBase
  let end = endBase + 1

  if (single) {
    if (sp === 'AM' && ep === 'AM') { start = startBase; end = startBase + 0.5 }
    else if (sp === 'PM' && ep === 'PM') { start = startBase + 0.5; end = startBase + 1 }
    else { start = startBase; end = startBase + 1 }
  } else {
    if (sp === 'PM') start = startBase + 0.5
    if (ep === 'AM') end = endBase + 0.5
    else end = endBase + 1
  }
  return { start, end }
}

export function leaveRangesOverlap(a: LeaveRange, b: LeaveRange): boolean {
  const A = rangeBounds(a)
  const B = rangeBounds(b)
  return A.start < B.end && B.start < A.end
}

export function leaveAvailable(balance: LeaveBalanceSnapshot): number {
  return Math.round((balance.entitled - balance.used - balance.pending) * 100) / 100
}

/**
 * Full leave request validation result (pure).
 * `existing` = other open/approved requests that should block overlap.
 */
export function calculateLeaveResult(input: {
  range: LeaveRange
  balance: LeaveBalanceSnapshot
  existing: LeaveRange[]
  allowHalfDay?: boolean
  maxDaysPerRequest?: number | null
  unlimited?: boolean
}): LeaveCalcResult {
  const errors: string[] = []
  const days = calculateLeaveDays(input.range)

  if (days <= 0) errors.push('Invalid leave date range')
  if (!input.allowHalfDay && days % 1 !== 0) errors.push('Half-day leave is not allowed for this type')
  if (input.maxDaysPerRequest != null && days > input.maxDaysPerRequest) {
    errors.push(`Cannot request more than ${input.maxDaysPerRequest} day(s) per request`)
  }

  const overlaps = input.existing.some(e => leaveRangesOverlap(input.range, e))
  if (overlaps) errors.push('Leave overlaps an existing request')

  const available = leaveAvailable(input.balance)
  const sufficient = input.unlimited === true || available >= days - 1e-9
  if (!sufficient) errors.push(`Insufficient leave balance (available ${available})`)

  return {
    days,
    available,
    sufficient,
    overlaps,
    ruleId: errors.length ? 'leave.invalid' : 'leave.ok',
    errors,
  }
}

export function balanceAfterSubmit(balance: LeaveBalanceSnapshot, days: number): LeaveBalanceSnapshot {
  return {
    entitled: balance.entitled,
    used: balance.used,
    pending: Math.round((balance.pending + days) * 100) / 100,
  }
}

export function balanceAfterApprove(balance: LeaveBalanceSnapshot, days: number): LeaveBalanceSnapshot {
  return {
    entitled: balance.entitled,
    used: Math.round((balance.used + days) * 100) / 100,
    pending: Math.round(Math.max(0, balance.pending - days) * 100) / 100,
  }
}

export function balanceAfterRejectOrCancelPending(balance: LeaveBalanceSnapshot, days: number): LeaveBalanceSnapshot {
  return {
    entitled: balance.entitled,
    used: balance.used,
    pending: Math.round(Math.max(0, balance.pending - days) * 100) / 100,
  }
}

export function balanceAfterCancelApproved(balance: LeaveBalanceSnapshot, days: number): LeaveBalanceSnapshot {
  return {
    entitled: balance.entitled,
    used: Math.round(Math.max(0, balance.used - days) * 100) / 100,
    pending: balance.pending,
  }
}
