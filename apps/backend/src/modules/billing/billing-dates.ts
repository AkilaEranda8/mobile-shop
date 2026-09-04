/**
 * Pure billing date / status helpers (Asia/Colombo).
 * Safe to unit-test without DB.
 */

export const BILLING_TZ = 'Asia/Colombo'
export const DEFAULT_GRACE_DAYS = 7
export const DEFAULT_DUE_DAYS_AFTER_ISSUE = 2

export type InvoiceLifecycleStatus = 'PENDING' | 'OVERDUE' | 'PAID' | 'CANCELLED' | 'DRAFT'

export function colomboParts(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BILLING_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
  }
}

/** YYYY-MM-DD in Asia/Colombo */
export function toColomboDateKey(d: Date): string {
  return colomboParts(d).dateKey
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d + days))
  const yy = utc.getUTCFullYear()
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(utc.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** Compare Colombo calendar days: a - b in days (approx via UTC midnight keys) */
export function daysBetweenDateKeys(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const aMs = Date.UTC(ay, am - 1, ad)
  const bMs = Date.UTC(by, bm - 1, bd)
  return Math.round((aMs - bMs) / 86_400_000)
}

export function addMonths(d: Date, months: number): Date {
  const out = new Date(d)
  out.setMonth(out.getMonth() + months)
  return out
}

export function addCalendarDays(d: Date, days: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + days)
  return out
}

/**
 * Due date = issueDate + dueDaysAfterIssue (calendar days).
 * Example: issue Sep 1, offset 2 → due Sep 3.
 */
export function calculateDueDate(issueDate: Date, dueDaysAfterIssue: number): Date {
  const days = Math.max(0, Math.floor(dueDaysAfterIssue))
  return addCalendarDays(issueDate, days)
}

/**
 * suspensionDate exclusive bound: suspend when currentDate > dueDate + graceDays
 * (Colombo calendar). On dueDate+graceDays the account is still in grace.
 */
export function calculateSuspensionDateKey(dueDate: Date, graceDays: number): string {
  const dueKey = toColomboDateKey(dueDate)
  return addDaysToDateKey(dueKey, Math.max(0, Math.floor(graceDays)))
}

export function isPastSuspension(
  now: Date,
  dueDate: Date,
  graceDays: number = DEFAULT_GRACE_DAYS,
): boolean {
  const today = toColomboDateKey(now)
  const graceEnd = calculateSuspensionDateKey(dueDate, graceDays)
  return today > graceEnd
}

export function isInGracePeriod(
  now: Date,
  dueDate: Date,
  graceDays: number = DEFAULT_GRACE_DAYS,
): boolean {
  const today = toColomboDateKey(now)
  const dueKey = toColomboDateKey(dueDate)
  const graceEnd = calculateSuspensionDateKey(dueDate, graceDays)
  return today > dueKey && today <= graceEnd
}

/** Days remaining in grace (0 if not in grace / already past). Inclusive of grace end day. */
export function graceDaysRemaining(
  now: Date,
  dueDate: Date,
  graceDays: number = DEFAULT_GRACE_DAYS,
): number {
  if (!isInGracePeriod(now, dueDate, graceDays)) {
    if (isPastSuspension(now, dueDate, graceDays)) return 0
    const today = toColomboDateKey(now)
    const dueKey = toColomboDateKey(dueDate)
    if (today <= dueKey) {
      // Not overdue yet — remaining until suspend = (due+grace) - today
      const graceEnd = calculateSuspensionDateKey(dueDate, graceDays)
      return Math.max(0, daysBetweenDateKeys(graceEnd, today))
    }
    return 0
  }
  const today = toColomboDateKey(now)
  const graceEnd = calculateSuspensionDateKey(dueDate, graceDays)
  return Math.max(0, daysBetweenDateKeys(graceEnd, today))
}

/**
 * Lifecycle status for an unpaid invoice based on calendar rules.
 * Paid / cancelled / draft are passthrough.
 */
export function resolveInvoiceStatus(
  current: InvoiceLifecycleStatus,
  dueDate: Date,
  now: Date = new Date(),
  graceDays: number = DEFAULT_GRACE_DAYS,
): InvoiceLifecycleStatus {
  if (current === 'PAID' || current === 'CANCELLED' || current === 'DRAFT') return current
  const today = toColomboDateKey(now)
  const dueKey = toColomboDateKey(dueDate)
  if (today <= dueKey) return 'PENDING'
  return 'OVERDUE'
}

export function daysOverdue(dueDate: Date, now: Date = new Date()): number {
  const today = toColomboDateKey(now)
  const dueKey = toColomboDateKey(dueDate)
  const d = daysBetweenDateKeys(today, dueKey)
  return d > 0 ? d : 0
}

export function formatInvoicePeriodLabel(start: Date, end?: Date): string {
  return start.toLocaleDateString('en-LK', {
    timeZone: BILLING_TZ,
    month: 'short',
    year: 'numeric',
  })
}

/** INV-YYYY-MM-XXXX from year/month and sequence */
export function formatSubscriptionInvoiceNumber(year: number, month: number, seq: number): string {
  const mm = String(month).padStart(2, '0')
  const n = String(Math.max(1, seq)).padStart(4, '0')
  return `INV-${year}-${mm}-${n}`
}
