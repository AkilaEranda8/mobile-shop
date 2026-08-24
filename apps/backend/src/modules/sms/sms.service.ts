import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { getTenantConfig, setTenantConfig } from '../configuration-engine/configuration-engine.service'
import {
  maskSmsSettingsForClient,
  normalizePhoneForSms,
  normalizeSmsSettings,
  smsEventLogType,
  type SmsEventType,
  type SmsSettings,
  type SmsSettingsView,
} from './sms-settings.util'
import { formatLkr, renderSmsTemplate, smsPreview, smsSegmentCount } from './sms-template.util'

export type SmsSendMeta = {
  eventType: SmsEventType | 'TEST' | 'MANUAL' | 'HP_REMINDER' | 'DELIVERY'
  referenceId?: string
  branchId?: string
  customerName?: string
  amount?: number
}

async function fetchRawSmsSettings(tenantId: string): Promise<SmsSettings> {
  return getTenantConfig<SmsSettings>(tenantId, 'sms', { bypassCache: true })
}

export async function getSmsSettingsForClient(tenantId: string): Promise<SmsSettingsView> {
  return maskSmsSettingsForClient(await fetchRawSmsSettings(tenantId))
}

export async function updateSmsSettingsForClient(
  tenantId: string,
  patch: Record<string, unknown>,
): Promise<SmsSettingsView> {
  await setTenantConfig(tenantId, 'sms', patch)
  return getSmsSettingsForClient(tenantId)
}

async function getSmsSettingsForSend(tenantId: string, allowDisabled = false): Promise<SmsSettings> {
  const settings = await fetchRawSmsSettings(tenantId)
  if (!settings.enabled && !allowDisabled) {
    throw new AppError('SMS gateway is disabled — enable it in SMS settings', 400)
  }
  if (!settings.apiKey.trim()) throw new AppError('SMS API Key / User ID is missing', 400)
  // Dialog URL Message Key (esmsqk) path does not need a password
  if (!settings.apiSecret.trim() && settings.provider !== 'dialog') {
    throw new AppError('SMS API Secret / Password is missing', 400)
  }
  if (!settings.senderId.trim() && settings.provider !== 'generic') {
    throw new AppError('SMS Sender ID / Mask is missing', 400)
  }
  if (settings.provider === 'generic' && !settings.senderId.startsWith('http')) {
    throw new AppError('Generic provider: set Sender ID field to your HTTP endpoint URL', 400)
  }
  return settings
}

function stripHtmlSnippet(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220)
}

function parseProviderError(text: string, status: number): string | null {
  const cleaned = stripHtmlSnippet(text)
  if (status >= 400) return cleaned || `HTTP ${status}`
  const lower = cleaned.toLowerCase()
  if (lower.includes('cannot get') || lower.includes('cannot post')) return cleaned
  if (lower.includes('error') && !lower.includes('0 error')) {
    if (lower.includes('invalid') || lower.includes('failed') || lower.includes('denied')) {
      return cleaned
    }
  }
  return null
}

const DIALOG_ESMS_BASE = 'https://esms.dialog.lk'

/** Dialog eSMS: prefer URL Message Key (esmsqk); fall back to username/password v2 API. */
async function sendViaDialog(
  settings: SmsSettings,
  to: string,
  message: string,
): Promise<{ providerRef?: string }> {
  const apiKey = settings.apiKey.trim()
  const apiSecret = settings.apiSecret.trim()
  const sourceAddress = settings.senderId.trim()

  // Path A — URL Message Key (most shops): GET /api/v1/message-via-url/create/url-campaign
  // When password is empty OR looks like an esmsqk-only setup, use this first.
  const tryEsmsqk = async (): Promise<{ providerRef?: string }> => {
    const params = new URLSearchParams({
      esmsqk: apiKey,
      list: to,
      message,
    })
    if (sourceAddress) params.set('source_address', sourceAddress)
    const res = await fetch(`${DIALOG_ESMS_BASE}/api/v1/message-via-url/create/url-campaign?${params}`)
    const text = (await res.text()).trim()
    const code = Number(text)
    // Dialog returns plain "1" on success; other numbers are error codes (e.g. 2007 invalid key)
    if (code === 1) return { providerRef: text }
    if (Number.isFinite(code) && code !== 1) {
      throw new AppError(`Dialog SMS failed: error code ${code}`, 502)
    }
    const err = parseProviderError(text, res.status)
    if (err || !res.ok) throw new AppError(`Dialog SMS failed: ${err ?? text.slice(0, 200)}`, 502)
    return { providerRef: text.slice(0, 120) || undefined }
  }

  // Path B — username + password login then POST /api/v2/sms
  const tryV2 = async (): Promise<{ providerRef?: string }> => {
    const loginRes = await fetch(`${DIALOG_ESMS_BASE}/api/v2/user/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: apiKey, password: apiSecret }),
    })
    const loginText = await loginRes.text()
    let loginJson: { status?: string; token?: string; comment?: string; errCode?: unknown } = {}
    try { loginJson = JSON.parse(loginText) } catch { /* ignore */ }
    if (!loginRes.ok || loginJson.status !== 'success' || !loginJson.token) {
      throw new AppError(
        `Dialog login failed: ${loginJson.comment || stripHtmlSnippet(loginText) || `HTTP ${loginRes.status}`}`,
        502,
      )
    }
    const body: Record<string, unknown> = {
      msisdn: [{ mobile: to }],
      message,
      transaction_id: `hx_${Date.now()}`,
    }
    if (sourceAddress) body.sourceAddress = sourceAddress
    const sendRes = await fetch(`${DIALOG_ESMS_BASE}/api/v2/sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginJson.token}`,
      },
      body: JSON.stringify(body),
    })
    const sendText = await sendRes.text()
    let sendJson: { status?: string; comment?: string; data?: { campaignId?: number }; errCode?: unknown } = {}
    try { sendJson = JSON.parse(sendText) } catch { /* ignore */ }
    if (!sendRes.ok || sendJson.status !== 'success') {
      throw new AppError(
        `Dialog SMS failed: ${sendJson.comment || stripHtmlSnippet(sendText) || `HTTP ${sendRes.status}`}`,
        502,
      )
    }
    return { providerRef: String(sendJson.data?.campaignId ?? sendText.slice(0, 80)) }
  }

  // Prefer esmsqk when password blank; otherwise try v2 then esmsqk
  if (!apiSecret) return tryEsmsqk()
  try {
    return await tryV2()
  } catch (v2Err) {
    try {
      return await tryEsmsqk()
    } catch {
      throw v2Err
    }
  }
}

async function sendViaProvider(
  settings: SmsSettings,
  to: string,
  message: string,
): Promise<{ providerRef?: string }> {
  switch (settings.provider) {
    case 'twilio': {
      const toE164 = to.startsWith('+') ? to : `+${to}`
      const auth = Buffer.from(`${settings.apiKey}:${settings.apiSecret}`).toString('base64')
      const body = new URLSearchParams({
        To: toE164,
        From: settings.senderId,
        Body: message,
      })
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(settings.apiKey)}/Messages.json`,
        {
          method: 'POST',
          headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        },
      )
      const text = await res.text()
      const err = parseProviderError(text, res.status)
      if (err || !res.ok) throw new AppError(`Twilio SMS failed: ${err ?? text.slice(0, 200)}`, 502)
      try {
        const json = JSON.parse(text) as { sid?: string }
        return { providerRef: json.sid }
      } catch {
        return {}
      }
    }
    case 'dialog':
      return sendViaDialog(settings, to, message)
    case 'mobitel': {
      const res = await fetch('https://bulksms.mobitel.lk/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: settings.apiKey,
          password: settings.apiSecret,
          src: settings.senderId,
          dst: to,
          msg: message,
          type: 1,
        }),
      })
      const text = await res.text()
      const err = parseProviderError(text, res.status)
      if (err || !res.ok) throw new AppError(`Mobitel SMS failed: ${err ?? text.slice(0, 200)}`, 502)
      return { providerRef: text.slice(0, 120) || undefined }
    }
    case 'hutch': {
      const params = new URLSearchParams({
        to,
        message,
        sender: settings.senderId,
        apiKey: settings.apiKey,
        apiSecret: settings.apiSecret,
      })
      const res = await fetch(`https://api.hutch.lk/sms/send?${params.toString()}`)
      const text = await res.text()
      const err = parseProviderError(text, res.status)
      if (err) throw new AppError(`Hutch SMS failed: ${err}`, 502)
      return { providerRef: text.slice(0, 120) || undefined }
    }
    case 'generic': {
      const res = await fetch(settings.senderId, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': settings.apiKey,
          'X-Api-Secret': settings.apiSecret,
        },
        body: JSON.stringify({ apiKey: settings.apiKey, apiSecret: settings.apiSecret, to, message }),
      })
      const text = await res.text()
      const err = parseProviderError(text, res.status)
      if (err || !res.ok) throw new AppError(`SMS send failed: ${err ?? text.slice(0, 200)}`, 502)
      return { providerRef: text.slice(0, 120) || undefined }
    }
    default:
      throw new AppError(`Unsupported SMS provider: ${settings.provider}`, 400)
  }
}

async function logSmsMessage(opts: {
  tenantId: string
  branchId?: string
  referenceId?: string
  to: string
  customerName?: string
  eventType: string
  message: string
  status: 'sent' | 'failed'
  provider?: string
  providerRef?: string
  errorMessage?: string
  amount?: number
  storeFullBody: boolean
}) {
  try {
    await prisma.smsMessage.create({
      data: {
        tenantId: opts.tenantId,
        branchId: opts.branchId,
        referenceId: opts.referenceId,
        to: opts.to,
        customerName: opts.customerName,
        eventType: smsEventLogType(opts.eventType),
        preview: smsPreview(opts.message),
        body: opts.storeFullBody ? opts.message : null,
        status: opts.status,
        provider: opts.provider,
        providerRef: opts.providerRef,
        errorMessage: opts.errorMessage,
        amount: opts.amount,
      },
    })
  } catch (e) {
    console.error('SmsMessage log failed:', e)
  }
}

export async function sendSms(
  tenantId: string,
  phone: string,
  message: string,
  meta: SmsSendMeta = { eventType: 'MANUAL' },
  opts?: { allowDisabled?: boolean },
): Promise<{ to: string; messageId?: string; segments: number }> {
  const settings = await getSmsSettingsForSend(tenantId, opts?.allowDisabled)
  const to = normalizePhoneForSms(phone)
  if (!to || to.length < 11) throw new AppError('Invalid phone number for SMS', 400)
  if (settings.validatePhones && to.length < 11) throw new AppError('Phone number too short for SMS', 400)

  const trimmedMessage = message.trim()
  if (!trimmedMessage) throw new AppError('SMS message is empty', 400)

  try {
    const { providerRef } = await sendViaProvider(settings, to, trimmedMessage)
    const row = await prisma.smsMessage.create({
      data: {
        tenantId,
        branchId: meta.branchId,
        referenceId: meta.referenceId,
        to,
        customerName: meta.customerName,
        eventType: smsEventLogType(meta.eventType),
        preview: smsPreview(trimmedMessage),
        body: settings.storeFullBody ? trimmedMessage : null,
        status: 'sent',
        provider: settings.provider,
        providerRef,
        amount: meta.amount,
      },
    })
    return { to, messageId: row.id, segments: smsSegmentCount(trimmedMessage) }
  } catch (error) {
    const errorMessage = error instanceof AppError ? error.message : 'SMS send failed'
    await logSmsMessage({
      tenantId,
      branchId: meta.branchId,
      referenceId: meta.referenceId,
      to,
      customerName: meta.customerName,
      eventType: meta.eventType,
      message: trimmedMessage,
      status: 'failed',
      provider: settings.provider,
      errorMessage,
      amount: meta.amount,
      storeFullBody: settings.storeFullBody,
    })
    throw error instanceof AppError ? error : new AppError(errorMessage, 502)
  }
}

export async function sendSmsTest(
  tenantId: string,
  phone: string,
  message?: string,
  branchId?: string,
): Promise<{ to: string; messageId?: string; segments: number }> {
  const text = message?.trim() || 'Hexalyte SMS test — your gateway is working.'
  return sendSms(tenantId, phone, text, { eventType: 'TEST', branchId }, { allowDisabled: false })
}

export async function sendManualSms(
  tenantId: string,
  phone: string,
  message: string,
  branchId?: string,
  customerName?: string,
): Promise<{ to: string; messageId?: string; segments: number }> {
  return sendSms(tenantId, phone, message, {
    eventType: 'MANUAL',
    branchId,
    customerName,
  })
}

export async function getSmsStatus(tenantId: string) {
  const settings = await fetchRawSmsSettings(tenantId)
  const configured = !!(settings.apiKey && settings.apiSecret && settings.senderId)
  const [totalSent, lastMessage] = await Promise.all([
    prisma.smsMessage.count({ where: { tenantId } }),
    prisma.smsMessage.findFirst({
      where: { tenantId, status: 'sent' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ])
  let status: 'connected' | 'disabled' | 'not_configured' = 'not_configured'
  if (settings.enabled && configured) status = 'connected'
  else if (!settings.enabled && configured) status = 'disabled'
  return {
    enabled: settings.enabled,
    provider: settings.provider,
    senderId: settings.senderId,
    configured,
    status,
    totalSent,
    lastSentAt: lastMessage?.createdAt?.toISOString() ?? null,
  }
}

export async function getSmsStats(tenantId: string, branchId?: string) {
  const baseWhere = { tenantId, ...(branchId ? { branchId } : {}) }
  const [total, failed, saleCount, repairCount, hpCount] = await Promise.all([
    prisma.smsMessage.count({ where: baseWhere }),
    prisma.smsMessage.count({ where: { ...baseWhere, status: 'failed' } }),
    prisma.smsMessage.count({ where: { ...baseWhere, eventType: 'SALE' } }),
    prisma.smsMessage.count({ where: { ...baseWhere, eventType: 'REPAIR' } }),
    prisma.smsMessage.count({ where: { ...baseWhere, eventType: 'HP_REMINDER' } }),
  ])
  const sent = total - failed
  const deliveryRate = total > 0 ? Math.round((sent / total) * 1000) / 10 : 0

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
  sixMonthsAgo.setDate(1)
  sixMonthsAgo.setHours(0, 0, 0, 0)

  const messages = await prisma.smsMessage.findMany({
    where: { ...baseWhere, createdAt: { gte: sixMonthsAgo } },
    select: { status: true, createdAt: true },
  })

  const monthMap: Record<string, { sent: number; failed: number }> = {}
  messages.forEach(m => {
    const key = m.createdAt.toLocaleString('en', { month: 'short', year: '2-digit' })
    if (!monthMap[key]) monthMap[key] = { sent: 0, failed: 0 }
    if (m.status === 'failed') monthMap[key].failed++
    else monthMap[key].sent++
  })

  const monthlyData = Object.entries(monthMap).map(([month, v]) => ({
    month: month.split(' ')[0],
    sent: v.sent,
    failed: v.failed,
  }))

  return {
    totalSent: total,
    sent,
    failed,
    deliveryRate,
    saleMessages: saleCount,
    repairMessages: repairCount,
    hpMessages: hpCount,
    monthlyData,
  }
}

export async function getSmsHistory(tenantId: string, branchId?: string, take = 100) {
  const rows = await prisma.smsMessage.findMany({
    where: { tenantId, ...(branchId ? { branchId } : {}) },
    orderBy: { createdAt: 'desc' },
    take,
  })
  return rows.map(m => ({
    id: m.id,
    referenceId: m.referenceId ?? '',
    customerName: m.customerName ?? '',
    phone: m.to,
    eventType: m.eventType,
    preview: m.preview,
    status: m.status as 'sent' | 'failed',
    provider: m.provider ?? '',
    amount: m.amount ?? 0,
    errorMessage: m.errorMessage ?? '',
    sentAt: m.createdAt.toISOString(),
  }))
}

export async function getSmsRecentMessages(tenantId: string, branchId?: string) {
  const rows = await prisma.smsMessage.findMany({
    where: { tenantId, ...(branchId ? { branchId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  return rows.map(m => ({
    id: m.id,
    to: m.to,
    customerName: m.customerName ?? '',
    eventType: m.eventType,
    preview: m.preview,
    status: m.status as 'sent' | 'failed',
    timestamp: m.createdAt.toISOString(),
  }))
}

export async function renderAndSendTemplatedSms(opts: {
  tenantId: string
  templateKey: SmsEventType
  phone?: string | null
  vars: Record<string, string | number>
  branchId?: string
  amount?: number
}): Promise<void> {
  const settings = await fetchRawSmsSettings(opts.tenantId)
  if (!settings.enabled) return
  const tpl = settings.templates[opts.templateKey]
  if (!tpl?.enabled) return
  const phone = String(opts.phone ?? '').trim()
  if (!phone) return
  const message = renderSmsTemplate(tpl.body, opts.vars)
  if (!message) return
  await sendSms(opts.tenantId, phone, message, {
    eventType: opts.templateKey,
    referenceId: String(opts.vars.referenceId ?? opts.vars.invoiceNumber ?? opts.vars.ticketNumber ?? ''),
    branchId: opts.branchId,
    customerName: String(opts.vars.customerName ?? ''),
    amount: opts.amount,
  })
}

export { normalizeSmsSettings, maskSmsSettingsForClient, formatLkr, renderSmsTemplate }
