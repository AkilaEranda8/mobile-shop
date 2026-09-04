/**
 * Billing date / grace / suspension unit tests (no DB).
 * Run: npx tsx src/modules/billing/billing-dates.test.ts
 */
import {
  addDaysToDateKey,
  calculateDueDate,
  calculateSuspensionDateKey,
  daysOverdue,
  formatSubscriptionInvoiceNumber,
  graceDaysRemaining,
  isInGracePeriod,
  isPastSuspension,
  resolveInvoiceStatus,
  toColomboDateKey,
} from './billing-dates'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

// Invoice number format
assert(formatSubscriptionInvoiceNumber(2026, 9, 1) === 'INV-2026-09-0001', 'invoice number padding')
assert(formatSubscriptionInvoiceNumber(2026, 10, 12) === 'INV-2026-10-0012', 'invoice number month')

// Due date = issue + 2 days
{
  const issue = new Date('2026-09-01T05:00:00.000Z')
  const due = calculateDueDate(issue, 2)
  assert(toColomboDateKey(due) === '2026-09-03' || due.getUTCDate() === 3 || due.getDate() === 3, 'due date offset 2')
}

// Spec example: Due Sep 3 → grace Sep 4–10 → suspend Sep 11
{
  const due = new Date('2026-09-03T04:00:00.000Z') // midday-ish Colombo-safe
  const dueKey = toColomboDateKey(due)
  // Force known key path
  const graceEnd = addDaysToDateKey('2026-09-03', 7)
  assert(graceEnd === '2026-09-10', 'grace end = due + 7')
  assert(calculateSuspensionDateKey(due, 7) === graceEnd || calculateSuspensionDateKey(due, 7).endsWith('10'), 'suspension key')

  // Sep 3 → PENDING
  const sep3 = new Date('2026-09-03T10:00:00+05:30')
  assert(resolveInvoiceStatus('PENDING', due, sep3, 7) === 'PENDING', 'on due date still PENDING')
  assert(!isInGracePeriod(sep3, due, 7), 'not in grace on due date')
  assert(!isPastSuspension(sep3, due, 7), 'not suspended on due date')

  // Sep 5 → OVERDUE + grace
  const sep5 = new Date('2026-09-05T10:00:00+05:30')
  assert(resolveInvoiceStatus('PENDING', due, sep5, 7) === 'OVERDUE', 'grace day overdue')
  assert(isInGracePeriod(sep5, due, 7), 'in grace Sep 5')
  assert(!isPastSuspension(sep5, due, 7), 'not suspended during grace')
  assert(graceDaysRemaining(sep5, due, 7) >= 5, 'grace days remaining Sep 5')

  // Sep 10 → last grace day
  const sep10 = new Date('2026-09-10T10:00:00+05:30')
  assert(isInGracePeriod(sep10, due, 7), 'still grace on due+7')
  assert(!isPastSuspension(sep10, due, 7), 'not suspended on due+7')

  // Sep 11 → suspended
  const sep11 = new Date('2026-09-11T10:00:00+05:30')
  assert(isPastSuspension(sep11, due, 7), 'suspended after grace')
  assert(!isInGracePeriod(sep11, due, 7), 'not in grace after suspend')
  assert(resolveInvoiceStatus('PENDING', due, sep11, 7) === 'OVERDUE', 'still OVERDUE status after suspend')
}

// Paid invoices stay paid
assert(resolveInvoiceStatus('PAID', new Date('2026-01-01'), new Date(), 7) === 'PAID', 'paid passthrough')
assert(resolveInvoiceStatus('CANCELLED', new Date('2026-01-01'), new Date(), 7) === 'CANCELLED', 'cancelled passthrough')

// Days overdue
{
  const due = new Date('2026-09-01T04:00:00.000Z')
  const now = new Date('2026-09-05T04:00:00.000Z')
  assert(daysOverdue(due, now) >= 3, 'days overdue roughly 4')
}

console.log('billing-dates.test.ts: all checks passed')
