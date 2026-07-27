import type { SubscriptionRow } from '@/lib/api'

export interface SubscriptionInvoiceData {
  invoiceNo: string
  issueDate: string
  dueDate: string
  months: number
  mrr: number
  total: number
  planLabel: string
  periodLabel: string
  periodStart: string
  periodEnd: string
  /** ISO dates for API payloads */
  periodStartIso: string
  periodEndIso: string
}

function addMonths(d: Date, months: number) {
  const out = new Date(d)
  out.setMonth(out.getMonth() + months)
  return out
}

function fmtLk(d: Date) {
  return d.toLocaleDateString('en-LK', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Build a renewal invoice for the *next* billing period.
 * Period starts at current subscriptionEndsAt (or today if expired / missing).
 * Does NOT change the tenant's subscription end date — that happens only after payment.
 */
export function buildSubscriptionInvoice(
  sub: SubscriptionRow,
  opts?: { months?: number },
): SubscriptionInvoiceData {
  const months = Math.max(1, Math.min(24, opts?.months ?? sub.paymentDueMonths ?? 1))
  const invoiceNo = sub.paymentDueInvoiceNo
    ?? `HX-${new Date().getFullYear()}-${String(sub.id).slice(-5).toUpperCase()}`

  const now = new Date()
  const currentEnd = sub.subscriptionEndsAt ? new Date(sub.subscriptionEndsAt) : null
  const periodStart = sub.paymentDuePeriodStart
    ? new Date(sub.paymentDuePeriodStart)
    : (currentEnd && currentEnd > now ? currentEnd : now)
  const periodEnd = sub.paymentDuePeriodEnd
    ? new Date(sub.paymentDuePeriodEnd)
    : addMonths(periodStart, months)

  const mrr = sub.mrr ?? 0
  const total = sub.paymentDueAmount ?? mrr * months
  const planLabel = sub.plan.charAt(0) + sub.plan.slice(1).toLowerCase()
  const periodLabel = months === 12 ? '1 Year' : months === 1 ? '1 Month' : `${months} Months`

  return {
    invoiceNo,
    issueDate: fmtLk(now),
    dueDate: fmtLk(periodEnd),
    months,
    mrr,
    total,
    planLabel,
    periodLabel,
    periodStart: fmtLk(periodStart),
    periodEnd: fmtLk(periodEnd),
    periodStartIso: periodStart.toISOString(),
    periodEndIso: periodEnd.toISOString(),
  }
}

export function buildSubscriptionInvoiceMessage(sub: SubscriptionRow, inv: SubscriptionInvoiceData): string {
  return [
    `Hello ${sub.ownerName ?? sub.name},`,
    '',
    `Thank you for using *Hexalyte*! Here is your subscription invoice for *${sub.name}*.`,
    '',
    `📋 *Invoice:* ${inv.invoiceNo}`,
    `📦 *Plan:* ${inv.planLabel} (${inv.periodLabel})`,
    `🗓 *Period:* ${inv.periodStart} → ${inv.periodEnd}`,
    `💰 *Total:* Rs. ${inv.total.toLocaleString()}`,
    `📅 *Payment due before:* ${inv.dueDate}`,
    '',
    '*Bank Transfer*',
    'Commercial Bank · Akila Eranda Gankewela',
    'Account: 2000124779 · SWIFT: CCEYLKLX',
    '',
    'Please complete payment and reply with the transfer reference.',
    'Your subscription will be extended after payment is confirmed.',
    '',
    '— *Hexalyte Innovation (Pvt) Ltd*',
    'info@hexalyte.com · +94 70 3130100',
  ].join('\n')
}
