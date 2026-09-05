import { Request } from 'express'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { effectiveBranchId } from '../../utils/active-branch'
import { assertFeatureEnabledForBranch, isTenantFeatureEnabled } from '../../utils/tenant-feature.util'
import { getTenantConfig } from '../configuration-engine/configuration-engine.service'
import type { InvoiceSettings } from '../tenants/invoice-settings.util'
import { getSmsSettingsForClient, sendSms } from '../sms/sms.service'
import type { SmsSettings } from '../sms/sms-settings.util'
import {
  DEFAULT_SMS_CREDIT_REMINDER_BODY,
  formatLkr,
  renderSmsTemplate,
} from '../sms/sms-template.util'
import { whatsappService } from '../whatsapp/whatsapp.service'
import { isQrConnected } from '../whatsapp/whatsapp-session.manager'
import {
  normalizeCustomerCreditSettings,
  type CustomerCreditSettings,
  DEFAULT_CUSTOMER_CREDIT_SETTINGS,
} from './customer-credit-settings.util'

const BULK_CAP = 50
const CREDIT_REMINDER_EVENT = 'CREDIT_REMINDER'
const WA_CREDIT_TYPE = 'credit_reminder'

const round2 = (n: number) => Math.round(n * 100) / 100

type ReminderChannels = { sms?: boolean; whatsapp?: boolean }

type EligibleCustomer = {
  id: string
  name: string
  phone: string
  totalDue: number
  branchId: string | null
  invoiceCount: number
  oldestDueDate: Date
}

async function assertCreditFeature(tenantId: string, branchId?: string | null) {
  await assertFeatureEnabledForBranch(
    tenantId,
    branchId,
    'CUSTOMER_CREDIT',
    'Customer Credit is not enabled for this branch',
  )
}

async function loadSettings(tenantId: string): Promise<CustomerCreditSettings> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { customerCreditSettings: true },
  })
  return normalizeCustomerCreditSettings(tenant?.customerCreditSettings)
}

async function shopNameForTenant(tenantId: string): Promise<string> {
  try {
    const inv = await getTenantConfig<InvoiceSettings>(tenantId, 'invoice')
    return String(inv.shopName || '').trim() || 'Our shop'
  } catch {
    return 'Our shop'
  }
}

function overdueCutoff(minDaysOverdue: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - Math.max(0, minDaysOverdue))
  return d
}

async function wasRemindedRecently(
  tenantId: string,
  customerId: string,
  cooldownDays: number,
): Promise<boolean> {
  if (cooldownDays <= 0) return false
  const since = new Date(Date.now() - cooldownDays * 86_400_000)
  const [sms, wa] = await Promise.all([
    prisma.smsMessage.findFirst({
      where: {
        tenantId,
        referenceId: customerId,
        eventType: CREDIT_REMINDER_EVENT,
        status: 'sent',
        createdAt: { gte: since },
      },
      select: { id: true },
    }),
    prisma.whatsAppMessage.findFirst({
      where: {
        tenantId,
        orderId: customerId,
        type: WA_CREDIT_TYPE,
        status: { not: 'failed' },
        createdAt: { gte: since },
      },
      select: { id: true },
    }),
  ])
  return !!(sms || wa)
}

async function findEligibleCustomers(
  tenantId: string,
  opts: {
    branchId?: string
    minDaysOverdue: number
    customerId?: string
    limit?: number
  },
): Promise<EligibleCustomer[]> {
  const cutoff = overdueCutoff(opts.minDaysOverdue)
  const customers = await prisma.customer.findMany({
    where: {
      tenantId,
      isActive: true,
      totalDue: { gt: 0 },
      ...(opts.branchId ? { branchId: opts.branchId } : {}),
      ...(opts.customerId ? { id: opts.customerId } : {}),
      phone: { not: '' },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      totalDue: true,
      branchId: true,
    },
    take: opts.limit ? opts.limit * 3 : undefined,
    orderBy: { totalDue: 'desc' },
  })

  const eligible: EligibleCustomer[] = []
  for (const c of customers) {
    const phone = String(c.phone ?? '').trim()
    if (!phone) continue

    const openSales = await prisma.sale.findMany({
      where: {
        tenantId,
        customerId: c.id,
        dueAmount: { gt: 0 },
        ...(opts.branchId ? { branchId: opts.branchId } : {}),
      },
      select: { createdAt: true, dueAmount: true },
      orderBy: { createdAt: 'asc' },
    })
    if (!openSales.length) continue
    const oldest = openSales[0]
    if (oldest.createdAt > cutoff) continue

    eligible.push({
      id: c.id,
      name: c.name,
      phone,
      totalDue: round2(Number(c.totalDue)),
      branchId: c.branchId,
      invoiceCount: openSales.length,
      oldestDueDate: oldest.createdAt,
    })
    if (opts.limit && eligible.length >= opts.limit) break
  }
  return eligible
}

async function isWhatsAppReady(tenantId: string): Promise<boolean> {
  const cfg = await prisma.whatsAppConfig.findUnique({ where: { tenantId } })
  if (!cfg?.enabled) return false
  if (cfg.connectionMode === 'qr') return isQrConnected(tenantId)
  return cfg.status === 'connected' && !!(cfg.accessToken && cfg.phoneNumberId)
}

async function isSmsReady(tenantId: string): Promise<boolean> {
  try {
    const settings = await getSmsSettingsForClient(tenantId)
    const configured = !!(settings.apiKey && (settings.hasApiSecret || settings.apiSecret) && settings.senderId)
    return !!(settings.enabled && configured && settings.templates?.creditReminder?.enabled)
  } catch {
    return false
  }
}

function resolveSendChannels(
  settings: CustomerCreditSettings,
  body?: ReminderChannels,
): { sms: boolean; whatsapp: boolean } {
  const sms =
    body?.sms === true
      ? true
      : body?.sms === false
        ? false
        : settings.reminder.channels.sms
  const whatsapp =
    body?.whatsapp === true
      ? true
      : body?.whatsapp === false
        ? false
        : settings.reminder.channels.whatsapp
  return { sms, whatsapp }
}

async function sendReminderToCustomer(
  tenantId: string,
  customer: EligibleCustomer,
  settings: CustomerCreditSettings,
  channels: { sms: boolean; whatsapp: boolean },
  opts?: { respectCooldown?: boolean; softFail?: boolean },
): Promise<{ status: 'sent' | 'skipped' | 'failed'; reason?: string; channels?: string[] }> {
  if (customer.totalDue <= 0) {
    return { status: 'skipped', reason: 'No outstanding balance' }
  }
  if (!customer.phone) {
    return { status: 'skipped', reason: 'Missing phone' }
  }

  if (opts?.respectCooldown !== false) {
    const cooled = await wasRemindedRecently(
      tenantId,
      customer.id,
      settings.reminder.cooldownDays,
    )
    if (cooled) {
      return { status: 'skipped', reason: 'Cooldown active' }
    }
  }

  const wantSms = channels.sms
  const wantWa = channels.whatsapp
  if (!wantSms && !wantWa) {
    return { status: 'skipped', reason: 'No channels selected' }
  }

  const shopName = await shopNameForTenant(tenantId)
  const oldestDueDate = customer.oldestDueDate.toISOString().slice(0, 10)
  const vars = {
    customerName: customer.name?.trim() || 'Customer',
    dueAmount: formatLkr(customer.totalDue),
    shopName,
    invoiceCount: customer.invoiceCount,
    oldestDueDate,
    referenceId: customer.id,
  }

  const sentChannels: string[] = []
  const errors: string[] = []

  if (wantSms) {
    const smsReady = await isSmsReady(tenantId)
    if (!smsReady) {
      errors.push('SMS not configured or credit template disabled')
    } else {
      try {
        const smsSettings = await getTenantConfig<SmsSettings>(tenantId, 'sms', { bypassCache: true })
        if (!smsSettings.enabled) throw new AppError('SMS gateway is disabled', 400)
        const tpl = smsSettings.templates?.creditReminder
        if (!tpl?.enabled) throw new AppError('Credit SMS template is disabled', 400)
        const message = renderSmsTemplate(tpl.body || DEFAULT_SMS_CREDIT_REMINDER_BODY, vars)
        if (!message.trim()) throw new AppError('Credit SMS template is empty', 400)
        await sendSms(tenantId, customer.phone, message, {
          eventType: 'creditReminder',
          referenceId: customer.id,
          branchId: customer.branchId ?? undefined,
          customerName: customer.name,
          amount: customer.totalDue,
        })
        sentChannels.push('sms')
      } catch (e) {
        errors.push(e instanceof Error ? e.message : 'SMS send failed')
      }
    }
  }

  if (wantWa) {
    if (!settings.whatsappTemplate.enabled) {
      errors.push('WhatsApp credit template disabled')
    } else {
      const waReady = await isWhatsAppReady(tenantId)
      if (!waReady) {
        errors.push('WhatsApp not connected')
      } else {
        try {
          const message = renderSmsTemplate(
            settings.whatsappTemplate.body || DEFAULT_CUSTOMER_CREDIT_SETTINGS.whatsappTemplate.body,
            vars,
          )
          if (!message.trim()) throw new AppError('WhatsApp credit template is empty', 400)
          await whatsappService.sendMessage(tenantId, {
            phone: customer.phone,
            message,
            customerName: customer.name,
            referenceId: customer.id,
            type: WA_CREDIT_TYPE,
            amount: customer.totalDue,
          })
          sentChannels.push('whatsapp')
        } catch (e) {
          errors.push(e instanceof Error ? e.message : 'WhatsApp send failed')
        }
      }
    }
  }

  if (sentChannels.length) {
    return { status: 'sent', channels: sentChannels, reason: errors.length ? errors.join('; ') : undefined }
  }

  const reason = errors.join('; ') || 'Send failed'
  if (opts?.softFail) return { status: 'failed', reason }
  throw new AppError(reason, 400)
}

export const customerCreditControlService = {
  async getControl(tenantId: string, req?: Request) {
    const branchId = req ? effectiveBranchId(req) : undefined
    await assertCreditFeature(tenantId, branchId)
    const settings = await loadSettings(tenantId)

    const dueCustomers = await prisma.customer.findMany({
      where: {
        tenantId,
        isActive: true,
        totalDue: { gt: 0 },
        ...(branchId ? { branchId } : {}),
      },
      select: { id: true, totalDue: true },
    })
    const totalOutstanding = round2(dueCustomers.reduce((s, c) => s + Number(c.totalDue), 0))

    const eligible = await findEligibleCustomers(tenantId, {
      branchId,
      minDaysOverdue: settings.reminder.minDaysOverdue,
      limit: 500,
    })

    const [smsReady, waReady] = await Promise.all([
      isSmsReady(tenantId),
      isWhatsAppReady(tenantId),
    ])

    const dueList = await prisma.customer.findMany({
      where: {
        tenantId,
        isActive: true,
        totalDue: { gt: 0 },
        ...(branchId ? { branchId } : {}),
        phone: { not: '' },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        totalDue: true,
        city: true,
      },
      orderBy: { totalDue: 'desc' },
      take: 100,
    })

    const eligibleIds = new Set(eligible.map(e => e.id))
    const customers = dueList.map(c => {
      const el = eligible.find(e => e.id === c.id)
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        totalDue: round2(Number(c.totalDue)),
        city: c.city,
        overdue: eligibleIds.has(c.id),
        invoiceCount: el?.invoiceCount ?? null,
        oldestDueDate: el?.oldestDueDate?.toISOString().slice(0, 10) ?? null,
      }
    })

    return {
      settings,
      summary: {
        customersWithDue: dueCustomers.length,
        totalOutstanding,
        overdueCount: eligible.length,
        smsReady,
        whatsappReady: waReady,
      },
      customers,
    }
  },

  async updateControl(tenantId: string, body: unknown, req?: Request) {
    const branchId = req ? effectiveBranchId(req) : undefined
    await assertCreditFeature(tenantId, branchId)
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { customerCreditSettings: true },
    })
    const prev = normalizeCustomerCreditSettings(tenant?.customerCreditSettings)
    const next = normalizeCustomerCreditSettings(body, prev)
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { customerCreditSettings: next as any },
    })
    return { settings: next }
  },

  async sendOne(
    tenantId: string,
    customerId: string,
    body: ReminderChannels | undefined,
    req?: Request,
  ) {
    const branchId = req ? effectiveBranchId(req) : undefined
    await assertCreditFeature(tenantId, branchId)
    const settings = await loadSettings(tenantId)
    const eligible = await findEligibleCustomers(tenantId, {
      branchId,
      minDaysOverdue: 0,
      customerId,
      limit: 1,
    })
    const customer = eligible[0]
    if (!customer) {
      const raw = await prisma.customer.findFirst({
        where: {
          id: customerId,
          tenantId,
          ...(branchId ? { branchId } : {}),
        },
        select: { id: true, name: true, phone: true, totalDue: true, branchId: true },
      })
      if (!raw) throw new AppError('Customer not found', 404)
      if (Number(raw.totalDue) <= 0) throw new AppError('No outstanding balance', 400)
      if (!String(raw.phone ?? '').trim()) throw new AppError('Customer phone required', 400)
      throw new AppError('Customer has no unpaid invoices', 400)
    }

    const channels = resolveSendChannels(settings, body)
    const result = await sendReminderToCustomer(tenantId, customer, settings, channels, {
      respectCooldown: false,
    })
    return result
  },

  async sendBulk(
    tenantId: string,
    body: ReminderChannels | undefined,
    req?: Request,
  ) {
    const branchId = req ? effectiveBranchId(req) : undefined
    await assertCreditFeature(tenantId, branchId)
    const settings = await loadSettings(tenantId)
    const channels = resolveSendChannels(settings, body)
    const eligible = await findEligibleCustomers(tenantId, {
      branchId,
      minDaysOverdue: settings.reminder.minDaysOverdue,
      limit: BULK_CAP,
    })

    let sent = 0
    let skipped = 0
    let failed = 0
    const details: Array<{ customerId: string; name: string; status: string; reason?: string }> = []

    for (const customer of eligible) {
      try {
        const result = await sendReminderToCustomer(tenantId, customer, settings, channels, {
          respectCooldown: true,
          softFail: true,
        })
        if (result.status === 'sent') sent++
        else if (result.status === 'skipped') skipped++
        else failed++
        details.push({
          customerId: customer.id,
          name: customer.name,
          status: result.status,
          reason: result.reason,
        })
      } catch (e) {
        failed++
        details.push({
          customerId: customer.id,
          name: customer.name,
          status: 'failed',
          reason: e instanceof Error ? e.message : 'Send failed',
        })
      }
    }

    return {
      processed: eligible.length,
      sent,
      skipped,
      failed,
      cap: BULK_CAP,
      details,
    }
  },

  /** Used by background job — no request context. */
  async runAutomatedForTenant(tenantId: string) {
    if (!(await isTenantFeatureEnabled(tenantId, 'CUSTOMER_CREDIT'))) return { skipped: true }
    const settings = await loadSettings(tenantId)
    if (!settings.reminder.enabled) return { skipped: true }

    const channels = {
      sms: settings.reminder.channels.sms,
      whatsapp: settings.reminder.channels.whatsapp,
    }
    if (!channels.sms && !channels.whatsapp) return { skipped: true }

    const eligible = await findEligibleCustomers(tenantId, {
      minDaysOverdue: settings.reminder.minDaysOverdue,
      limit: BULK_CAP,
    })

    let sent = 0
    let skipped = 0
    let failed = 0
    for (const customer of eligible) {
      const result = await sendReminderToCustomer(tenantId, customer, settings, channels, {
        respectCooldown: true,
        softFail: true,
      })
      if (result.status === 'sent') sent++
      else if (result.status === 'skipped') skipped++
      else failed++
    }
    return { skipped: false, processed: eligible.length, sent, skippedCount: skipped, failed }
  },
}
