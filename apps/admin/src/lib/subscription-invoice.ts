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
}

export function buildSubscriptionInvoice(sub: SubscriptionRow): SubscriptionInvoiceData {
  const invoiceNo = `HX-${new Date().getFullYear()}-${String(sub.id).slice(-5).toUpperCase()}`
  const now = new Date()
  const issueDate = now.toLocaleDateString('en-LK', { day: 'numeric', month: 'long', year: 'numeric' })
  const endDate = sub.subscriptionEndsAt ? new Date(sub.subscriptionEndsAt) : null
  const dueDate = endDate
    ? endDate.toLocaleDateString('en-LK', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'
  const months = endDate
    ? Math.max(1, Math.round((endDate.getTime() - now.getTime()) / (30.44 * 24 * 60 * 60 * 1000)))
    : 1
  const mrr = sub.mrr ?? 0
  const total = mrr * months
  const planLabel = sub.plan.charAt(0) + sub.plan.slice(1).toLowerCase()
  const periodLabel = months === 12 ? '1 Year' : months === 1 ? '1 Month' : `${months} Months`

  return { invoiceNo, issueDate, dueDate, months, mrr, total, planLabel, periodLabel }
}

export function buildSubscriptionInvoiceMessage(sub: SubscriptionRow, inv: SubscriptionInvoiceData): string {
  return [
    `Hello ${sub.ownerName ?? sub.name},`,
    '',
    `Thank you for using *Hexalyte*! Here is your subscription invoice for *${sub.name}*.`,
    '',
    `📋 *Invoice:* ${inv.invoiceNo}`,
    `📦 *Plan:* ${inv.planLabel} (${inv.periodLabel})`,
    `💰 *Total:* Rs. ${inv.total.toLocaleString()}`,
    `📅 *Valid until:* ${inv.dueDate}`,
    '',
    '*Bank Transfer*',
    'Commercial Bank · Akila Eranda Gankewela',
    'Account: 2000124779 · SWIFT: CCEYLKLX',
    '',
    'Please complete payment and reply with the transfer reference.',
    '',
    '— *Hexalyte Innovation (Pvt) Ltd*',
    'info@hexalyte.com · +94 70 3130100',
  ].join('\n')
}
