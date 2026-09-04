import { prisma } from '../config/database'
import { ensureBillingWhatsAppTenant } from '../utils/billing-whatsapp-tenant'
import { resolveTenantOwnerPhone } from '../utils/tenant-owner-phone'
import { whatsappService } from '../modules/whatsapp/whatsapp.service'
import { logPlatformActivity } from '../utils/activity-log'
import { buildSubscriptionInvoicePdf } from '../utils/subscription-invoice-pdf'
import { createSubscriptionInvoice } from '../modules/billing/billing.service'

const BILLING_SLUG = 'hexalyte-billing-internal'
const TZ = 'Asia/Colombo'
const JOB_HOUR = 8 // local morning Asia/Colombo
const CHECK_EVERY_MS = 15 * 60 * 1000

let timer: ReturnType<typeof setInterval> | null = null

function colomboParts(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  return {
    hour: Number(get('hour')),
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
  }
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d + days))
  const yy = utc.getUTCFullYear()
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(utc.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function toColomboDateKey(d: Date): string {
  return colomboParts(d).dateKey
}

function normalizeBillingPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('94') && digits.length >= 11) return `+${digits}`
  if (digits.startsWith('0') && digits.length >= 10) return `+94${digits.slice(1)}`
  if (digits.length >= 9) return `+94${digits}`
  return phone.startsWith('+') ? phone : `+${digits}`
}

function addMonths(d: Date, months: number) {
  const out = new Date(d)
  out.setMonth(out.getMonth() + months)
  return out
}

function fmtLk(d: Date) {
  return d.toLocaleDateString('en-LK', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' })
}

function buildRenewalMessage(input: {
  ownerName: string
  shopName: string
  plan: string
  invoiceNo: string
  months: number
  mrr: number
  total: number
  periodStart: Date
  periodEnd: Date
  expiresOn: Date
}) {
  const planLabel = input.plan.charAt(0) + input.plan.slice(1).toLowerCase()
  const periodLabel = input.months === 1 ? '1 Month' : `${input.months} Months`
  return [
    `Hello ${input.ownerName},`,
    '',
    `Your Hexalyte subscription for *${input.shopName}* expires on *${fmtLk(input.expiresOn)}*.`,
    '',
    `Here is your renewal invoice (access is *not* extended until payment is confirmed):`,
    '',
    `📋 *Invoice:* ${input.invoiceNo}`,
    `📦 *Plan:* ${planLabel} (${periodLabel})`,
    `🗓 *Period:* ${fmtLk(input.periodStart)} → ${fmtLk(input.periodEnd)}`,
    `💰 *Total:* Rs. ${input.total.toLocaleString('en-LK')}`,
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

function renewalDraft(tenant: {
  id: string
  plan: string
  mrr: number | null
  subscriptionEndsAt: Date | null
  paymentDueInvoiceNo: string | null
  paymentDueAmount: number | null
  paymentDueMonths: number | null
  paymentDuePeriodStart: Date | null
  paymentDuePeriodEnd: Date | null
}) {
  const months = tenant.paymentDueMonths ?? 1
  const mrr = tenant.mrr ?? 0
  const periodStart = tenant.paymentDuePeriodStart
    ?? (tenant.subscriptionEndsAt && tenant.subscriptionEndsAt > new Date()
      ? new Date(tenant.subscriptionEndsAt)
      : new Date())
  const periodEnd = tenant.paymentDuePeriodEnd ?? addMonths(periodStart, months)
  const invoiceNo = tenant.paymentDueInvoiceNo
    ?? `INV-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-TEMP`
  const total = tenant.paymentDueAmount ?? mrr * months
  return { months, mrr, periodStart, periodEnd, invoiceNo, total }
}

type TenantRow = {
  id: string
  name: string
  plan: string
  mrr: number | null
  ownerName: string
  ownerEmail: string
  subscriptionEndsAt: Date | null
  paymentDue: boolean
  paymentDueAmount: number | null
  paymentDueInvoiceNo: string | null
  paymentDueMonths: number | null
  paymentDuePeriodStart: Date | null
  paymentDuePeriodEnd: Date | null
  paymentDueAt: Date | null
  paymentDueReminderSentAt: Date | null
}

async function loadNearbyTenants(): Promise<TenantRow[]> {
  const windowStart = new Date()
  windowStart.setUTCDate(windowStart.getUTCDate() - 2)
  const windowEnd = new Date()
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 3)

  return prisma.tenant.findMany({
    where: {
      status: 'ACTIVE',
      slug: { not: BILLING_SLUG },
      subscriptionEndsAt: { gte: windowStart, lte: windowEnd },
      mrr: { gt: 0 },
    },
    select: {
      id: true,
      name: true,
      plan: true,
      mrr: true,
      ownerName: true,
      ownerEmail: true,
      subscriptionEndsAt: true,
      paymentDue: true,
      paymentDueAmount: true,
      paymentDueInvoiceNo: true,
      paymentDueMonths: true,
      paymentDuePeriodStart: true,
      paymentDuePeriodEnd: true,
      paymentDueAt: true,
      paymentDueReminderSentAt: true,
    },
  })
}

/**
 * Day before expiry @ 08:00 Asia/Colombo:
 * WhatsApp renewal invoice only. Does NOT mark Payment Due.
 * Draft invoice fields are saved for the payment day.
 */
async function sendDayBeforeInvoices(tenants: TenantRow[], todayKey: string, tomorrowKey: string) {
  const billingTenantId = await ensureBillingWhatsAppTenant()
  const billingStatus = await whatsappService.getStatus(billingTenantId)
  if (billingStatus.status !== 'connected') {
    console.warn('[subscription-renewal] billing WhatsApp not connected — skipping day-before invoices')
    return { considered: 0, sent: 0, skipped: 0, errors: 0 }
  }

  const dueTomorrow = tenants.filter(t =>
    t.subscriptionEndsAt && toColomboDateKey(t.subscriptionEndsAt) === tomorrowKey,
  )

  let sent = 0
  let skipped = 0
  let errors = 0

  for (const tenant of dueTomorrow) {
    try {
      if (
        tenant.paymentDueReminderSentAt
        && toColomboDateKey(tenant.paymentDueReminderSentAt) === todayKey
      ) {
        skipped += 1
        continue
      }

      const { phone: rawPhone } = await resolveTenantOwnerPhone(tenant.id)
      if (!rawPhone) {
        skipped += 1
        await logPlatformActivity({
          eventType: 'SUBSCRIPTION_RENEWAL_REMINDER_SKIPPED',
          severity: 'WARN',
          actorType: 'SYSTEM',
          actor: 'subscription-renewal-job',
          target: tenant.name,
          details: 'No owner WhatsApp phone on file (branch / invoice settings)',
          tenantId: tenant.id,
        })
        continue
      }

      const phone = normalizeBillingPhone(rawPhone)
      if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
        skipped += 1
        continue
      }

      const draft = renewalDraft(tenant)
      const message = buildRenewalMessage({
        ownerName: tenant.ownerName || tenant.name,
        shopName: tenant.name,
        plan: tenant.plan,
        invoiceNo: draft.invoiceNo,
        months: draft.months,
        mrr: draft.mrr,
        total: draft.total,
        periodStart: draft.periodStart,
        periodEnd: draft.periodEnd,
        expiresOn: tenant.subscriptionEndsAt!,
      })

      const pdfBuffer = buildSubscriptionInvoicePdf({
        invoiceNo: draft.invoiceNo,
        shopName: tenant.name,
        ownerName: tenant.ownerName || tenant.name,
        ownerEmail: tenant.ownerEmail,
        plan: tenant.plan,
        months: draft.months,
        mrr: draft.mrr,
        total: draft.total,
        periodStart: draft.periodStart,
        periodEnd: draft.periodEnd,
      })

      await whatsappService.sendInvoice(billingTenantId, {
        phone,
        orderId: draft.invoiceNo,
        customerName: tenant.ownerName || tenant.name,
        amount: draft.total,
        message,
        pdfBase64: pdfBuffer.toString('base64'),
        pdfFilename: `Subscription-${draft.invoiceNo}.pdf`,
        attachPdf: true,
      })

      // Save draft invoice details for payment day — do NOT mark paymentDue yet
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          paymentDue: false,
          paymentDueAmount: draft.total,
          paymentDueInvoiceNo: draft.invoiceNo,
          paymentDueMonths: draft.months,
          paymentDuePeriodStart: draft.periodStart,
          paymentDuePeriodEnd: draft.periodEnd,
          paymentDueAt: null,
          paymentDueReminderSentAt: new Date(),
        },
      })

      await logPlatformActivity({
        eventType: 'SUBSCRIPTION_RENEWAL_REMINDER_SENT',
        severity: 'INFO',
        actorType: 'SYSTEM',
        actor: 'subscription-renewal-job',
        target: tenant.name,
        details: `Day-before WhatsApp invoice+PDF ${draft.invoiceNo} · Rs.${draft.total.toLocaleString('en-LK')} · expires ${tomorrowKey} · Payment Due NOT marked yet · to ${phone}`,
        tenantId: tenant.id,
      })

      sent += 1
      console.log(`[subscription-renewal] day-before WA sent to ${tenant.name} (${phone})`)
    } catch (err: any) {
      errors += 1
      console.error(`[subscription-renewal] day-before failed for ${tenant.name}:`, err?.message ?? err)
      await logPlatformActivity({
        eventType: 'SUBSCRIPTION_RENEWAL_REMINDER_FAILED',
        severity: 'ERROR',
        actorType: 'SYSTEM',
        actor: 'subscription-renewal-job',
        target: tenant.name,
        details: err?.message ?? 'WhatsApp send failed',
        tenantId: tenant.id,
      }).catch(() => {})
    }
  }

  if (dueTomorrow.length > 0) {
    console.log(
      `[subscription-renewal] day-before ${tomorrowKey} · considered=${dueTomorrow.length} sent=${sent} skipped=${skipped} errors=${errors}`,
    )
  }

  return { considered: dueTomorrow.length, sent, skipped, errors }
}

/**
 * Payment / expiry day @ 08:00 Asia/Colombo:
 * If payment was NOT settled (subscription still ends today / not extended), mark Payment Due.
 */
async function markPaymentDueOnExpiryDay(tenants: TenantRow[], todayKey: string) {
  // Still "unsettled" = ends today (Colombo) and Confirm Payment was never done
  // (confirm-payment would have moved subscriptionEndsAt into the future).
  const expiringToday = tenants.filter(t =>
    t.subscriptionEndsAt && toColomboDateKey(t.subscriptionEndsAt) === todayKey,
  )

  let marked = 0
  let skipped = 0

  for (const tenant of expiringToday) {
    try {
      if (tenant.paymentDue) {
        skipped += 1
        continue
      }

      const draft = renewalDraft(tenant)

      await createSubscriptionInvoice({
        tenantId: tenant.id,
        billingPeriodStart: draft.periodStart,
        billingPeriodEnd: draft.periodEnd,
        months: draft.months,
        amount: draft.total,
        invoiceNumber: draft.invoiceNo.startsWith('INV-') ? draft.invoiceNo : undefined,
        issueDate: new Date(),
        actor: { type: 'SYSTEM', name: 'subscription-renewal-job' },
      })

      await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          paymentDue: true,
          paymentDueAmount: draft.total,
          paymentDueInvoiceNo: draft.invoiceNo,
          paymentDueMonths: draft.months,
          paymentDuePeriodStart: draft.periodStart,
          paymentDuePeriodEnd: draft.periodEnd,
          paymentDueAt: new Date(),
        },
      })

      await logPlatformActivity({
        eventType: 'SUBSCRIPTION_PAYMENT_DUE',
        severity: 'WARN',
        actorType: 'SYSTEM',
        actor: 'subscription-renewal-job',
        target: tenant.name,
        details: `Payment day — unsettled · marked Payment Due · ${draft.invoiceNo} · Rs.${draft.total.toLocaleString('en-LK')}`,
        tenantId: tenant.id,
      })

      marked += 1
      console.log(`[subscription-renewal] Payment Due marked for ${tenant.name}`)
    } catch (err: any) {
      console.error(`[subscription-renewal] mark-due failed for ${tenant.name}:`, err?.message ?? err)
    }
  }

  if (expiringToday.length > 0) {
    console.log(
      `[subscription-renewal] payment-day ${todayKey} · considered=${expiringToday.length} marked=${marked} skipped=${skipped}`,
    )
  }

  return { considered: expiringToday.length, marked, skipped }
}

/**
 * 08:00 Asia/Colombo daily:
 * 1) Day before expiry → WhatsApp invoice ONLY if SUBSCRIPTION_RENEWAL_WA_AUTO=1
 *    (default OFF — send reminders manually from Admin → Payment Due)
 * 2) Expiry / payment day → mark Payment Due only if still unsettled
 */
export async function processSubscriptionRenewalReminders(): Promise<{
  wa: { considered: number; sent: number; skipped: number; errors: number }
  due: { considered: number; marked: number; skipped: number }
}> {
  const empty = {
    wa: { considered: 0, sent: 0, skipped: 0, errors: 0 },
    due: { considered: 0, marked: 0, skipped: 0 },
  }

  const nowParts = colomboParts()
  if (nowParts.hour !== JOB_HOUR) return empty

  const todayKey = nowParts.dateKey
  const tomorrowKey = addDaysToDateKey(todayKey, 1)
  const tenants = await loadNearbyTenants()

  // Manual-only by default. Opt in with SUBSCRIPTION_RENEWAL_WA_AUTO=1
  const autoWa = process.env.SUBSCRIPTION_RENEWAL_WA_AUTO === '1'
  const wa = autoWa
    ? await sendDayBeforeInvoices(tenants, todayKey, tomorrowKey)
    : empty.wa

  const dueTenants = autoWa ? await loadNearbyTenants() : tenants
  const due = await markPaymentDueOnExpiryDay(dueTenants, todayKey)

  return { wa, due }
}

export function startSubscriptionRenewalReminderJob(): void {
  void processSubscriptionRenewalReminders().catch(err => {
    console.error('[subscription-renewal] initial run failed:', err?.message ?? err)
  })

  timer = setInterval(() => {
    void processSubscriptionRenewalReminders().catch(err => {
      console.error('[subscription-renewal] scheduled run failed:', err?.message ?? err)
    })
  }, CHECK_EVERY_MS)

  if (typeof timer.unref === 'function') timer.unref()
  const autoWa = process.env.SUBSCRIPTION_RENEWAL_WA_AUTO === '1'
  console.log(
    `[subscription-renewal] job started — ${JOB_HOUR}:00 ${TZ}: WhatsApp auto=${autoWa ? 'ON' : 'OFF (manual Remind)'} · payment-day mark Payment Due if unsettled`,
  )
}

export function stopSubscriptionRenewalReminderJob(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
