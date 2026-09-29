import { prisma } from '../config/database'
import { ensureBillingWhatsAppTenant } from '../utils/billing-whatsapp-tenant'
import { resolveTenantOwnerPhone } from '../utils/tenant-owner-phone'
import { whatsappService } from '../modules/whatsapp/whatsapp.service'
import { logPlatformActivity } from '../utils/activity-log'
import { registerJob, runTracked } from '../utils/job-registry'
import { tenantShopUrl } from '../utils/tenant-app-domain'
import { getPlatformGeneral } from '../utils/platform-config'

const JOB_ID = 'trial-nurture'
const TZ = 'Asia/Colombo'
const SEND_FROM_HOUR = 10
const SEND_UNTIL_HOUR = 19
const CHECK_EVERY_MS = 15 * 60 * 1000
const MAX_FAILURES_PER_STAGE = 3
const SUPPORT_PHONE = '+94 70 3130100'
const INTERNAL_SLUGS = ['hexalyte-billing-internal', 'hexalyte-platform-internal']
export const TRIAL_NURTURE_CONFIG_KEY = 'trial.whatsappReminders'

type Stage = 'welcome' | 'setup_products' | 'setup_first_sale' | 'ending_soon' | 'ends_today' | 'winback'

let timer: ReturnType<typeof setInterval> | null = null

function colomboParts(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
  }).formatToParts(d)
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  return { hour: Number(get('hour')), dateKey: `${get('year')}-${get('month')}-${get('day')}` }
}

function dateKey(d: Date) {
  return colomboParts(d).dateKey
}

function addDays(key: string, days: number) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

function fmtLk(d: Date) {
  return d.toLocaleDateString('en-LK', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-LK', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true })
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('94') && digits.length >= 11) return `+${digits}`
  if (digits.startsWith('0') && digits.length >= 10) return `+94${digits.slice(1)}`
  if (digits.length >= 9) return `+94${digits}`
  return `+${digits}`
}

type MessageInput = {
  owner: string
  shop: string
  trialEndsAt: Date | null
  dashboardUrl: string
  billingUrl: string
  supportEmail: string
}

function signature(i: MessageInput) {
  return ['', '— *Hexalyte Team*', `${i.supportEmail} · ${SUPPORT_PHONE}`]
}

function buildMessage(stage: Stage, i: MessageInput): string {
  switch (stage) {
    case 'welcome':
      return [
        `Hello ${i.owner} 👋`,
        '',
        `Welcome to *Hexalyte*! Your shop *${i.shop}* is ready.`,
        '',
        '*Quick start:*',
        '1️⃣ Add your products (Inventory → Products)',
        '2️⃣ Make your first bill from POS (press F2)',
        '3️⃣ Add your staff (Settings → Staff & Roles)',
        '',
        `🔗 ${i.dashboardUrl}`,
        '',
        'Need help setting up? Just reply to this message — we will help you for free.',
        ...signature(i),
      ].join('\n')
    case 'setup_products':
      return [
        `Hello ${i.owner},`,
        '',
        `We noticed *${i.shop}* has not added any products yet.`,
        'Adding products takes only a few minutes — add them one by one or import from the master catalog.',
        '',
        'Want us to help you set up on a quick call? Reply *YES* and our team will call you.',
        '',
        `🔗 ${i.dashboardUrl}`,
        ...signature(i),
      ].join('\n')
    case 'setup_first_sale':
      return [
        `Hello ${i.owner},`,
        '',
        `Great job — your products are in *${i.shop}*! 🎉`,
        'Next step: make your first bill from the POS (press *F2*). Receipts can be printed or sent on WhatsApp.',
        '',
        'Any questions? Reply to this message and we will help.',
        '',
        `🔗 ${i.dashboardUrl}`,
        ...signature(i),
      ].join('\n')
    case 'ending_soon':
      return [
        `Hello ${i.owner},`,
        '',
        `Your free trial for *${i.shop}* ends in *2 days*${i.trialEndsAt ? ` (${fmtLk(i.trialEndsAt)})` : ''}.`,
        'Upgrade now to keep using Hexalyte without interruption — all your products, sales and customers stay safe.',
        '',
        `💳 Upgrade: ${i.billingUrl}`,
        '',
        'Questions about plans? Reply to this message.',
        ...signature(i),
      ].join('\n')
    case 'ends_today':
      return [
        `⏰ Hello ${i.owner},`,
        '',
        `Your free trial for *${i.shop}* ends *today*${i.trialEndsAt ? ` at *${fmtTime(i.trialEndsAt)}*` : ''}.`,
        'After that the system will be locked until you upgrade. Your data is safe.',
        '',
        `💳 Upgrade now: ${i.billingUrl}`,
        '',
        'Need more time or help choosing a plan? Reply to this message.',
        ...signature(i),
      ].join('\n')
    case 'winback':
      return [
        `Hello ${i.owner},`,
        '',
        `Your Hexalyte trial for *${i.shop}* has ended and the account is paused.`,
        'Good news — all your products, sales and customer data are still safe.',
        '',
        'Reply to this message and we will reactivate your shop as soon as you choose a plan.',
        ...signature(i),
      ].join('\n')
  }
}

export async function isTrialNurtureEnabled(): Promise<boolean> {
  const row = await prisma.platformConfig.findUnique({ where: { key: TRIAL_NURTURE_CONFIG_KEY } })
  return (row?.value ?? 'true') !== 'false'
}

/** WhatsApp nurture sequence for trial tenants (welcome → setup help → expiry reminders → win-back). */
export async function processTrialNurture(opts: { force?: boolean } = {}) {
  const result = { considered: 0, sent: 0, skipped: 0, errors: 0 }
  const { hour, dateKey: today } = colomboParts()
  if (!opts.force && (hour < SEND_FROM_HOUR || hour >= SEND_UNTIL_HOUR)) return result
  if (!(await isTrialNurtureEnabled())) return result

  const now = new Date()
  const tenants = await prisma.tenant.findMany({
    where: {
      slug: { notIn: INTERNAL_SLUGS },
      OR: [
        { status: 'TRIAL' },
        { status: 'SUSPENDED', trialEndsAt: { gte: new Date(now.getTime() - 6 * 86400000), lte: now } },
      ],
    },
    select: { id: true, name: true, slug: true, status: true, ownerName: true, createdAt: true, trialEndsAt: true },
  })
  if (!tenants.length) return result

  const tenantIds = tenants.map(t => t.id)
  const [history, expired] = await Promise.all([
    prisma.platformActivityLog.findMany({
      where: {
        tenantId: { in: tenantIds },
        eventType: { in: ['TRIAL_NURTURE_SENT', 'TRIAL_NURTURE_SKIPPED', 'TRIAL_NURTURE_FAILED'] },
      },
      select: { tenantId: true, eventType: true, details: true },
    }),
    prisma.platformActivityLog.findMany({
      where: { tenantId: { in: tenantIds }, eventType: 'TRIAL_EXPIRED' },
      select: { tenantId: true },
    }),
  ])
  const done = new Set<string>()
  const failures = new Map<string, number>()
  for (const h of history) {
    const stage = /^stage=(\w+)/.exec(h.details)?.[1]
    if (!stage || !h.tenantId) continue
    const k = `${h.tenantId}:${stage}`
    if (h.eventType === 'TRIAL_NURTURE_FAILED') failures.set(k, (failures.get(k) ?? 0) + 1)
    else done.add(k)
  }
  const expiredTrial = new Set(expired.map(e => e.tenantId))

  const due: { tenant: typeof tenants[number]; stage: Stage }[] = []
  const setupCandidates: typeof tenants = []
  for (const t of tenants) {
    const endKey = t.trialEndsAt ? dateKey(t.trialEndsAt) : null
    const createdKey = dateKey(t.createdAt)
    let stage: Stage | null = null
    if (t.status === 'TRIAL') {
      if (endKey === today) { if (t.trialEndsAt! > now) stage = 'ends_today' }
      else if (endKey && addDays(endKey, -2) === today) stage = 'ending_soon'
      else if (addDays(createdKey, 3) === today) { setupCandidates.push(t); continue }
      else if (addDays(createdKey, 1) === today) stage = 'welcome'
    } else if (t.status === 'SUSPENDED' && endKey && addDays(endKey, 3) === today && expiredTrial.has(t.id)) {
      stage = 'winback'
    }
    if (stage) due.push({ tenant: t, stage })
  }

  if (setupCandidates.length) {
    const ids = setupCandidates.map(t => t.id)
    const [products, sales] = await Promise.all([
      prisma.product.groupBy({ by: ['tenantId'], where: { tenantId: { in: ids }, isActive: true }, _count: { _all: true } }),
      prisma.sale.groupBy({ by: ['tenantId'], where: { tenantId: { in: ids } }, _count: { _all: true } }),
    ])
    const hasProducts = new Set(products.map(p => p.tenantId))
    const hasSales = new Set(sales.map(s => s.tenantId))
    for (const t of setupCandidates) {
      if (!hasProducts.has(t.id)) due.push({ tenant: t, stage: 'setup_products' })
      else if (!hasSales.has(t.id)) due.push({ tenant: t, stage: 'setup_first_sale' })
    }
  }

  const pending = due.filter(d => {
    const k = `${d.tenant.id}:${d.stage}`
    return !done.has(k) && (failures.get(k) ?? 0) < MAX_FAILURES_PER_STAGE
  })
  result.considered = pending.length
  if (!pending.length) return result

  const billingTenantId = await ensureBillingWhatsAppTenant()
  const wa = await whatsappService.getStatus(billingTenantId)
  if (wa.status !== 'connected') {
    console.warn('[trial-nurture] platform WhatsApp not connected — skipping')
    return result
  }
  const { supportEmail } = await getPlatformGeneral()

  for (const { tenant, stage } of pending) {
    const log = (eventType: string, severity: string, details: string) => logPlatformActivity({
      eventType, severity, actorType: 'SYSTEM', actor: 'trial-nurture-job',
      target: tenant.name, details: `stage=${stage} · ${details}`, tenantId: tenant.id,
    })
    try {
      const { phone: raw } = await resolveTenantOwnerPhone(tenant.id)
      const phone = raw ? normalizePhone(raw) : ''
      if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
        result.skipped += 1
        await log('TRIAL_NURTURE_SKIPPED', 'WARN', 'No valid owner WhatsApp number on file')
        continue
      }
      const message = buildMessage(stage, {
        owner: tenant.ownerName?.trim() || tenant.name,
        shop: tenant.name,
        trialEndsAt: tenant.trialEndsAt,
        dashboardUrl: tenantShopUrl(tenant.slug, '/dashboard'),
        billingUrl: tenantShopUrl(tenant.slug, '/dashboard/settings?tab=billing'),
        supportEmail,
      })
      await whatsappService.sendMessage(billingTenantId, {
        phone,
        message,
        customerName: tenant.ownerName || tenant.name,
        type: 'custom',
        referenceId: `trial-nurture-${stage}-${tenant.id}`,
      })
      result.sent += 1
      await log('TRIAL_NURTURE_SENT', 'INFO', `WhatsApp to ${phone}`)
      await new Promise(r => setTimeout(r, 2500))
    } catch (err) {
      result.errors += 1
      await log('TRIAL_NURTURE_FAILED', 'ERROR', err instanceof Error ? err.message : 'WhatsApp send failed').catch(() => {})
    }
  }

  console.log(`[trial-nurture] ${today} considered=${result.considered} sent=${result.sent} skipped=${result.skipped} errors=${result.errors}`)
  return result
}

export function startTrialNurtureJob(): void {
  registerJob(
    {
      id: JOB_ID,
      name: 'Trial WhatsApp Reminders',
      schedule: `Every 15 min (sends ${SEND_FROM_HOUR}:00–${SEND_UNTIL_HOUR}:00 ${TZ})`,
      description: 'Welcome, setup help, trial ending / ends today reminders and win-back messages to trial owners',
    },
    () => processTrialNurture(),
  )
  timer = setInterval(() => {
    void runTracked(JOB_ID).then(r => {
      if (!r.ok) console.error('[trial-nurture] scheduled run failed:', r.error)
    })
  }, CHECK_EVERY_MS)
  if (typeof timer.unref === 'function') timer.unref()
}

export function stopTrialNurtureJob(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
