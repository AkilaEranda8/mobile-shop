import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import type { ConnectInput, UpdateConfigInput, SendInvoiceInput, SendMessageInput } from './whatsapp.schema'
import {
  startQrSession,
  getQrState,
  disconnectQrSession,
  sendQrText,
  sendQrDocument,
  isQrConnected,
  restoreQrSessions,
  type QrSessionState,
} from './whatsapp-session.manager'

export { restoreQrSessions }

const META_API = 'https://graph.facebook.com/v25.0'

// ── Meta Cloud API helpers ────────────────────────────────────────────────────

async function metaGet(path: string, token: string) {
  const res = await fetch(`${META_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json() as Record<string, any>
  if (!res.ok) throw new Error(json?.error?.message ?? 'Meta API error')
  return json
}

async function metaPost(path: string, token: string, body: Record<string, any>) {
  const res = await fetch(`${META_API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json() as Record<string, any>
  if (!res.ok) throw new Error(json?.error?.message ?? 'Meta API error')
  return json
}

function maskToken(token: string): string {
  if (!token || token.length <= 12) return token ? '***' : ''
  return token.slice(0, 8) + '***' + token.slice(-4)
}

function formatTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (t, [k, v]) => t.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v),
    template,
  )
}

function decodePdfBase64(input: string): Buffer {
  const raw = input.includes(',') ? input.split(',')[1]! : input
  return Buffer.from(raw, 'base64')
}

function sanitizePdfFilename(name: string, fallback: string): string {
  const base = (name || fallback).replace(/[^\w.\-() ]+/g, '_').trim() || fallback
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`
}

function normalizeWaPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('94') && digits.length >= 11) return `+${digits}`
  if (digits.startsWith('0') && digits.length >= 10) return `+94${digits.slice(1)}`
  if (digits.length >= 9) return `+94${digits}`
  return phone.startsWith('+') ? phone.trim() : `+${digits}`
}

function isValidWaPhone(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone)
}

async function ensureWhatsAppConfig(
  tenantId: string,
  opts: { connectionMode?: 'qr' | 'meta'; enabled?: boolean } = {},
) {
  await prisma.whatsAppConfig.upsert({
    where:  { tenantId },
    create: {
      tenantId,
      connectionMode: opts.connectionMode ?? 'qr',
      enabled:        opts.enabled ?? true,
      status:         'disconnected',
    },
    update: {
      ...(opts.connectionMode !== undefined && { connectionMode: opts.connectionMode }),
      ...(opts.enabled !== undefined && { enabled: opts.enabled }),
    },
  })
}

async function metaUploadDocument(
  phoneNumberId: string,
  token: string,
  buffer: Buffer,
  filename: string,
): Promise<string> {
  const form = new FormData()
  form.append('messaging_product', 'whatsapp')
  form.append('type', 'application/pdf')
  form.append('file', new Blob([new Uint8Array(buffer)], { type: 'application/pdf' }), filename)

  const res = await fetch(`${META_API}/${phoneNumberId}/media`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}` },
    body:    form,
  })
  const json = await res.json() as Record<string, any>
  if (!res.ok) throw new Error(json?.error?.message ?? 'Failed to upload PDF to WhatsApp')
  if (!json.id) throw new Error('Media upload did not return an ID')
  return String(json.id)
}

// ── Service ───────────────────────────────────────────────────────────────────

export const whatsappService = {

  async getStatus(tenantId: string) {
    const cfg = await prisma.whatsAppConfig.findUnique({ where: { tenantId } })
    if (!cfg) return { status: 'disconnected' as const, connectionMode: 'qr' as const, enabled: false }

    const base = { enabled: cfg.enabled, connectionMode: (cfg.connectionMode ?? 'qr') as 'meta' | 'qr' }

    if (cfg.connectionMode === 'qr') {
      const qr = getQrState(tenantId)
      if (qr.status === 'connected' || isQrConnected(tenantId)) {
        return {
          ...base,
          status:         'connected' as const,
          phoneNumber:    qr.phoneNumber ?? cfg.phoneNumber ?? undefined,
          displayName:    qr.displayName ?? cfg.displayName ?? undefined,
          lastChecked:    qr.lastChecked,
        }
      }
      if (qr.status === 'qr_pending' || qr.status === 'connecting') {
        return {
          ...base,
          status:         qr.status,
          qr:             qr.qr,
          phoneNumber:    cfg.phoneNumber ?? undefined,
          displayName:    cfg.displayName ?? undefined,
          lastChecked:    qr.lastChecked,
        }
      }
      if (cfg.status === 'connected') {
        if (!isQrConnected(tenantId)) {
          startQrSession(tenantId).catch(() => {})
        }
        return {
          ...base,
          status:         isQrConnected(tenantId) ? 'connected' as const : 'connecting' as const,
          phoneNumber:    cfg.phoneNumber ?? undefined,
          displayName:    cfg.displayName ?? undefined,
          lastChecked:    cfg.lastCheckedAt?.toISOString(),
        }
      }
    }

    return {
      ...base,
      status:         cfg.status as 'connected' | 'disconnected' | 'token_expired',
      phoneNumber:    cfg.phoneNumber   ?? undefined,
      displayName:    cfg.displayName   ?? undefined,
      qualityRating:  cfg.qualityRating ?? undefined,
      lastChecked:    cfg.lastCheckedAt?.toISOString(),
    }
  },

  async getQrSession(tenantId: string): Promise<QrSessionState & { connectionMode: 'qr' }> {
    return { ...getQrState(tenantId), connectionMode: 'qr' }
  },

  async startQrConnect(tenantId: string) {
    await ensureWhatsAppConfig(tenantId, { connectionMode: 'qr', enabled: true })
    const state = await startQrSession(tenantId, { force: false })
    return { ...state, connectionMode: 'qr' as const }
  },

  async refreshQrConnect(tenantId: string) {
    await ensureWhatsAppConfig(tenantId, { connectionMode: 'qr', enabled: true })
    const state = await startQrSession(tenantId, { force: true })
    return { ...state, connectionMode: 'qr' as const }
  },

  async getConfig(tenantId: string) {
    const cfg = await prisma.whatsAppConfig.findUnique({ where: { tenantId } })
    if (!cfg) return null
    return {
      connectionMode:  (cfg.connectionMode ?? 'qr') as 'meta' | 'qr',
      accessToken:     cfg.accessToken ? maskToken(cfg.accessToken) : '',
      phoneNumberId:   cfg.phoneNumberId,
      wabaId:          cfg.wabaId,
      verifyToken:     cfg.verifyToken,
      enabled:         cfg.enabled,
      autoSendInvoice: cfg.autoSendInvoice,
      sendPdfInvoice:  cfg.sendPdfInvoice,
      validatePhones:  cfg.validatePhones,
      invoiceTemplate: cfg.invoiceTemplate,
    }
  },

  async connect(tenantId: string, input: ConnectInput) {
    await disconnectQrSession(tenantId).catch(() => {})

    // Verify credentials with Meta API
    let phoneNumber: string | undefined
    let displayName: string | undefined
    let qualityRating: string | undefined
    let status: 'connected' | 'disconnected' | 'token_expired' = 'disconnected'

    try {
      const data = await metaGet(
        `/${input.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
        input.accessToken,
      )
      phoneNumber   = data.display_phone_number
      displayName   = data.verified_name
      const qr      = data.quality_rating?.toUpperCase()
      qualityRating = (qr && qr !== 'UNKNOWN') ? qr : undefined
      status        = 'connected'
    } catch (err: any) {
      const msg = String(err?.message ?? '')
      if (msg.toLowerCase().includes('token') || msg.includes('190')) {
        status = 'token_expired'
      }
      throw new Error(`WhatsApp verification failed: ${err?.message}`)
    }

    const cfg = await prisma.whatsAppConfig.upsert({
      where:  { tenantId },
      create: {
        tenantId,
        connectionMode: 'meta',
        accessToken:   input.accessToken,
        phoneNumberId: input.phoneNumberId,
        wabaId:        input.wabaId,
        verifyToken:   input.verifyToken ?? '',
        enabled:       input.enabled ?? true,
        status,
        phoneNumber,
        displayName,
        qualityRating,
        lastCheckedAt: new Date(),
      },
      update: {
        connectionMode: 'meta',
        accessToken:   input.accessToken,
        phoneNumberId: input.phoneNumberId,
        wabaId:        input.wabaId,
        verifyToken:   input.verifyToken ?? '',
        enabled:       input.enabled ?? true,
        status,
        phoneNumber,
        displayName,
        qualityRating,
        lastCheckedAt: new Date(),
      },
    })

    return {
      status:         cfg.status as 'connected' | 'disconnected' | 'token_expired',
      connectionMode: 'meta' as const,
      phoneNumber:    cfg.phoneNumber   ?? undefined,
      displayName:    cfg.displayName   ?? undefined,
      lastChecked:    cfg.lastCheckedAt?.toISOString(),
    }
  },

  async disconnect(tenantId: string) {
    const cfg = await prisma.whatsAppConfig.findUnique({ where: { tenantId } })
    if (cfg?.connectionMode === 'qr') {
      await disconnectQrSession(tenantId)
    } else {
      await prisma.whatsAppConfig.updateMany({
        where: { tenantId },
        data:  { status: 'disconnected', enabled: false },
      })
    }
    return { success: true }
  },

  async updateConfig(tenantId: string, input: UpdateConfigInput) {
    const existing = await prisma.whatsAppConfig.findUnique({ where: { tenantId } })
    if (!existing) {
      const cfg = await prisma.whatsAppConfig.create({
        data: {
          tenantId,
          connectionMode: 'qr',
          accessToken:     input.accessToken     ?? '',
          phoneNumberId:   input.phoneNumberId   ?? '',
          wabaId:          input.wabaId          ?? '',
          verifyToken:     input.verifyToken     ?? '',
          enabled:         input.enabled         ?? true,
          autoSendInvoice: input.autoSendInvoice ?? false,
          sendPdfInvoice:  input.sendPdfInvoice  ?? false,
          validatePhones:  input.validatePhones  ?? true,
          invoiceTemplate: input.invoiceTemplate ?? '',
          status:          'disconnected',
        },
      })
      return {
        connectionMode:  'qr' as const,
        accessToken:     '',
        phoneNumberId:   cfg.phoneNumberId,
        wabaId:          cfg.wabaId,
        verifyToken:     cfg.verifyToken,
        enabled:         cfg.enabled,
        autoSendInvoice: cfg.autoSendInvoice,
        sendPdfInvoice:  cfg.sendPdfInvoice,
        validatePhones:  cfg.validatePhones,
        invoiceTemplate: cfg.invoiceTemplate,
      }
    }
    const cfg = await prisma.whatsAppConfig.update({
      where: { tenantId },
      data:  {
        ...(input.accessToken     !== undefined && { accessToken:     input.accessToken     }),
        ...(input.phoneNumberId   !== undefined && { phoneNumberId:   input.phoneNumberId   }),
        ...(input.wabaId          !== undefined && { wabaId:          input.wabaId          }),
        ...(input.verifyToken     !== undefined && { verifyToken:     input.verifyToken     }),
        ...(input.enabled         !== undefined && { enabled:         input.enabled         }),
        ...(input.autoSendInvoice !== undefined && { autoSendInvoice: input.autoSendInvoice }),
        ...(input.sendPdfInvoice  !== undefined && { sendPdfInvoice:  input.sendPdfInvoice  }),
        ...(input.validatePhones  !== undefined && { validatePhones:  input.validatePhones  }),
        ...(input.invoiceTemplate !== undefined && { invoiceTemplate: input.invoiceTemplate }),
      },
    })
    return {
      connectionMode:  (cfg.connectionMode ?? 'qr') as 'meta' | 'qr',
      accessToken:     cfg.accessToken ? maskToken(cfg.accessToken) : '',
      phoneNumberId:   cfg.phoneNumberId,
      wabaId:          cfg.wabaId,
      verifyToken:     cfg.verifyToken,
      enabled:         cfg.enabled,
      autoSendInvoice: cfg.autoSendInvoice,
      sendPdfInvoice:  cfg.sendPdfInvoice,
      validatePhones:  cfg.validatePhones,
      invoiceTemplate: cfg.invoiceTemplate,
    }
  },

  async testConnection(tenantId: string) {
    const cfg = await prisma.whatsAppConfig.findUnique({ where: { tenantId } })
    if (!cfg) throw new Error('WhatsApp not configured')

    if (cfg.connectionMode === 'qr') {
      if (!isQrConnected(tenantId)) {
        await startQrSession(tenantId).catch(() => {})
      }
      if (!isQrConnected(tenantId)) {
        throw new Error('WhatsApp QR session is not connected. Scan the QR code on your phone.')
      }
      await prisma.whatsAppConfig.update({
        where: { tenantId },
        data:  { status: 'connected', lastCheckedAt: new Date() },
      })
      return { success: true, message: 'WhatsApp QR connection is active.' }
    }

    try {
      await metaGet(
        `/${cfg.phoneNumberId}?fields=display_phone_number,verified_name`,
        cfg.accessToken,
      )
      await prisma.whatsAppConfig.update({
        where: { tenantId },
        data:  { status: 'connected', lastCheckedAt: new Date() },
      })
      return { success: true, message: 'Connection test passed! API credentials are valid.' }
    } catch (err: any) {
      const expired = String(err?.message ?? '').includes('190')
      await prisma.whatsAppConfig.update({
        where: { tenantId },
        data:  { status: expired ? 'token_expired' : 'disconnected', lastCheckedAt: new Date() },
      })
      throw new Error(err?.message ?? 'Connection test failed')
    }
  },

  async sendTestMessage(tenantId: string, phone: string) {
    const cfg = await prisma.whatsAppConfig.findUnique({ where: { tenantId } })
    if (!cfg) throw new AppError('WhatsApp not configured. Please connect first.', 400)

    const body = '\u2705 This is a test message from your Hexalyte POS. WhatsApp integration is working!'
    let result: any
    let msgStatus = 'sent'
    let sendErr: string | undefined

    if (cfg.connectionMode === 'qr') {
      try {
        await sendQrText(tenantId, phone, body)
        await prisma.whatsAppConfig.update({
          where: { tenantId },
          data:  { status: 'connected', lastCheckedAt: new Date() },
        }).catch(() => {})
      } catch (err: any) {
        msgStatus = 'failed'
        sendErr   = err?.message ?? 'WhatsApp send failed'
      }
    } else {
      if (!cfg.accessToken || !cfg.phoneNumberId)
        throw new AppError('WhatsApp not configured. Please save your credentials first.', 400)

      const normalizedPhone = phone.startsWith('+') ? phone.slice(1) : phone
      try {
        result = await metaPost(`/${cfg.phoneNumberId}/messages`, cfg.accessToken, {
          messaging_product: 'whatsapp',
          to:                normalizedPhone,
          type:              'text',
          text:              { body },
        })
        await prisma.whatsAppConfig.update({
          where: { tenantId },
          data:  { status: 'connected', lastCheckedAt: new Date() },
        }).catch(() => {})
      } catch (err: any) {
        msgStatus = 'failed'
        sendErr   = err?.message ?? 'Meta API error'
      }
    }

    await prisma.whatsAppMessage.create({
      data: {
        tenantId,
        configId:      cfg.id,
        to:            phone,
        customerName:  'Test',
        type:          'test',
        preview:       'WhatsApp connection test message',
        status:        msgStatus,
        metaMessageId: result?.messages?.[0]?.id,
      },
    }).catch(() => {})

    if (sendErr) {
      const metaErr = sendErr
      const friendly =
        metaErr.includes('131047') || metaErr.includes('Re-engagement') ?
          'Cannot send to this number: the customer must message your WhatsApp number first (within 24 h).' :
        metaErr.includes('131026') || metaErr.includes('Undeliverable') ?
          'Message undeliverable: the number may not have WhatsApp or is not in your contacts.' :
        metaErr.includes('131030') ?
          'Rate limit reached. Please wait a minute and try again.' :
        metaErr.includes('131058') || metaErr.includes('Public Test') ?
          'Your phone number is a production number. To test, first send a WhatsApp message TO your business number, then retry within 24 h.' :
        metaErr
      throw new AppError(friendly, 400)
    }
    return { success: true, message: 'Test message sent successfully!' }
  },

  async sendInvoice(tenantId: string, input: SendInvoiceInput) {
    const cfg = await prisma.whatsAppConfig.findUnique({ where: { tenantId } })
    if (!cfg) throw new AppError('WhatsApp not configured. Connect WhatsApp in settings first.', 400)
    if (!cfg.enabled) throw new AppError('WhatsApp integration is disabled. Turn it on in WhatsApp settings.', 400)

    const phone = normalizeWaPhone(input.phone)
    if (!phone) throw new AppError('Customer phone number is required', 400)
    if (cfg.validatePhones && !isValidWaPhone(phone)) {
      throw new AppError('Invalid customer phone number. Use format 0771234567 or +94771234567.', 400)
    }

    const isConnected = cfg.connectionMode === 'qr'
      ? isQrConnected(tenantId)
      : cfg.status === 'connected'
    if (!isConnected) {
      throw new AppError(
        cfg.connectionMode === 'qr'
          ? 'WhatsApp is not connected. Open WhatsApp settings and scan the QR code.'
          : 'WhatsApp is not connected',
        400,
      )
    }

    const template = cfg.invoiceTemplate || `Hello {{customer_name}},\n\nThank you for your purchase! 🎉\n\nOrder: {{order_id}}\nAmount: LKR {{amount}}\n\nThank you for choosing us!`

    const messageBody = input.message ?? formatTemplate(template, {
      customer_name: input.customerName ?? 'Customer',
      order_id:      input.orderId,
      amount:        input.amount ? input.amount.toLocaleString() : '0',
      currency:      'LKR',
      date:          new Date().toLocaleDateString(),
      shop_name:     'Hexalyte',
    })

    const sendPdf = !!input.pdfBase64 && (input.attachPdf === true || cfg.sendPdfInvoice)
    const pdfFilename = sendPdf
      ? sanitizePdfFilename(input.pdfFilename ?? '', `Invoice-${input.orderId}.pdf`)
      : ''

    const WA_DOC_CAPTION_MAX = 1024
    const docCaption = sendPdf && messageBody.length <= WA_DOC_CAPTION_MAX ? messageBody : undefined

    let result: any
    if (sendPdf) {
      const pdfBuffer = decodePdfBase64(input.pdfBase64!)
      if (pdfBuffer.length < 100) throw new AppError('Invalid PDF data', 400)
      if (pdfBuffer.length > 16 * 1024 * 1024) throw new AppError('PDF is too large (max 16 MB)', 400)

      if (cfg.connectionMode === 'qr') {
        await sendQrDocument(tenantId, phone, pdfBuffer, pdfFilename, docCaption)
        if (!docCaption) {
          await sendQrText(tenantId, phone, messageBody)
        }
      } else {
        const mediaId = await metaUploadDocument(cfg.phoneNumberId, cfg.accessToken, pdfBuffer, pdfFilename)
        const normalizedPhone = phone.startsWith('+') ? phone.slice(1) : phone
        result = await metaPost(`/${cfg.phoneNumberId}/messages`, cfg.accessToken, {
          messaging_product: 'whatsapp',
          to:                normalizedPhone,
          type:              'document',
          document:          {
            id:       mediaId,
            ...(docCaption ? { caption: docCaption } : {}),
            filename: pdfFilename,
          },
        })
        if (!docCaption) {
          await metaPost(`/${cfg.phoneNumberId}/messages`, cfg.accessToken, {
            messaging_product: 'whatsapp',
            to:                normalizedPhone,
            type:              'text',
            text:              { body: messageBody },
          })
        }
      }
    } else if (cfg.connectionMode === 'qr') {
      await sendQrText(tenantId, phone, messageBody)
    } else {
      const normalizedPhone = phone.startsWith('+') ? phone.slice(1) : phone
      result = await metaPost(`/${cfg.phoneNumberId}/messages`, cfg.accessToken, {
        messaging_product: 'whatsapp',
        to:                normalizedPhone,
        type:              'text',
        text:              { body: messageBody },
      })
    }

    const preview = `Invoice #${input.orderId}${input.amount ? ` · LKR ${input.amount.toLocaleString()}` : ''}${sendPdf ? ' (PDF)' : ''}`

    const msg = await prisma.whatsAppMessage.create({
      data: {
        tenantId,
        configId:     cfg.id,
        orderId:      input.orderId,
        to:           phone,
        customerName: input.customerName,
        type:         'invoice',
        preview,
        status:       'sent',
        metaMessageId: result?.messages?.[0]?.id,
        amount:       input.amount,
      },
    })

    return { success: true, messageId: msg.id }
  },

  async sendMessage(tenantId: string, input: SendMessageInput) {
    const cfg = await prisma.whatsAppConfig.findUnique({ where: { tenantId } })
    if (!cfg) throw new AppError('WhatsApp not configured. Connect WhatsApp in settings first.', 400)
    if (!cfg.enabled) throw new AppError('WhatsApp integration is disabled. Turn it on in WhatsApp settings.', 400)

    const phone = normalizeWaPhone(input.phone)
    if (!phone) throw new AppError('Phone number is required', 400)
    if (cfg.validatePhones && !isValidWaPhone(phone)) {
      throw new AppError('Invalid phone number. Use format 0771234567 or +94771234567.', 400)
    }

    await whatsappService.sendTextMessage(tenantId, phone, input.message)

    const preview = input.message.length > 80
      ? `${input.message.slice(0, 80)}…`
      : input.message

    const msg = await prisma.whatsAppMessage.create({
      data: {
        tenantId,
        configId:     cfg.id,
        orderId:      input.referenceId,
        to:           phone,
        customerName: input.customerName,
        type:         input.type ?? 'custom',
        preview,
        status:       'sent',
        amount:       input.amount,
      },
    })

    return { success: true, messageId: msg.id }
  },

  async getStats(tenantId: string) {
    const cfg = await prisma.whatsAppConfig.findUnique({ where: { tenantId } })
    if (!cfg) return { totalSent: 0, delivered: 0, failed: 0, pending: 0, invoicesSent: 0, deliveryRate: 0, monthlyData: [] }

    const [total, delivered, failed, pending, invoices] = await Promise.all([
      prisma.whatsAppMessage.count({ where: { tenantId } }),
      prisma.whatsAppMessage.count({ where: { tenantId, status: 'delivered' } }),
      prisma.whatsAppMessage.count({ where: { tenantId, status: 'failed' } }),
      prisma.whatsAppMessage.count({ where: { tenantId, status: 'sent' } }),
      prisma.whatsAppMessage.count({ where: { tenantId, type: 'invoice' } }),
    ])

    const deliveryRate = total > 0 ? Math.round((delivered / total) * 1000) / 10 : 0

    // Monthly data for last 6 months
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
    sixMonthsAgo.setDate(1)
    sixMonthsAgo.setHours(0, 0, 0, 0)

    const messages = await prisma.whatsAppMessage.findMany({
      where:  { tenantId, createdAt: { gte: sixMonthsAgo } },
      select: { status: true, createdAt: true },
    })

    const monthMap: Record<string, { sent: number; delivered: number }> = {}
    messages.forEach(m => {
      const key = m.createdAt.toLocaleString('en', { month: 'short', year: '2-digit' })
      if (!monthMap[key]) monthMap[key] = { sent: 0, delivered: 0 }
      monthMap[key].sent++
      if (m.status === 'delivered' || m.status === 'read') monthMap[key].delivered++
    })

    const monthlyData = Object.entries(monthMap).map(([month, v]) => ({ month: month.split(' ')[0], ...v }))

    return { totalSent: total, delivered, failed, pending, invoicesSent: invoices, deliveryRate, monthlyData }
  },

  async getInvoiceHistory(tenantId: string) {
    const cfg = await prisma.whatsAppConfig.findUnique({ where: { tenantId } })
    if (!cfg) return []

    const messages = await prisma.whatsAppMessage.findMany({
      where:   { tenantId, type: 'invoice' },
      orderBy: { createdAt: 'desc' },
      take:    50,
    })

    return messages.map(m => ({
      id:           m.id,
      orderId:      m.orderId ?? '',
      customerName: m.customerName ?? '',
      phone:        m.to,
      amount:       m.amount ?? 0,
      status:       (m.status === 'delivered' || m.status === 'read'
        ? 'delivered'
        : m.status === 'failed'
          ? 'failed'
          : 'pending') as 'delivered' | 'failed' | 'pending',
      sentAt:       m.createdAt.toISOString(),
    }))
  },

  async getRecentMessages(tenantId: string) {
    const cfg = await prisma.whatsAppConfig.findUnique({ where: { tenantId } })
    if (!cfg) return []

    const messages = await prisma.whatsAppMessage.findMany({
      where:   { tenantId },
      orderBy: { createdAt: 'desc' },
      take:    20,
    })

    return messages.map(m => ({
      id:           m.id,
      to:           m.to,
      customerName: m.customerName ?? '',
      type:         m.type as 'invoice' | 'test' | 'custom',
      preview:      m.preview,
      status:       m.status as 'sent' | 'delivered' | 'read' | 'failed',
      timestamp:    m.createdAt.toISOString(),
    }))
  },

  /** Send a plain text WhatsApp message for the given tenant (QR or Meta). */
  async sendTextMessage(tenantId: string, phone: string, text: string) {
    const cfg = await prisma.whatsAppConfig.findUnique({ where: { tenantId } })
    if (!cfg) throw new AppError('WhatsApp not configured for this shop', 400)
    if (!cfg.enabled) throw new AppError('WhatsApp integration is disabled for this shop', 400)

    if (cfg.connectionMode === 'qr') {
      if (!isQrConnected(tenantId)) {
        await startQrSession(tenantId).catch(() => {})
      }
      if (!isQrConnected(tenantId)) {
        throw new AppError('WhatsApp is not connected for this shop. Scan the QR code first.', 400)
      }
      await sendQrText(tenantId, phone, text)
      return
    }

    if (!cfg.accessToken || !cfg.phoneNumberId) {
      throw new AppError('WhatsApp Meta API is not configured for this shop', 400)
    }
    if (cfg.status !== 'connected') {
      throw new AppError('WhatsApp is not connected for this shop', 400)
    }

    const normalizedPhone = phone.startsWith('+') ? phone.slice(1) : phone
    await metaPost(`/${cfg.phoneNumberId}/messages`, cfg.accessToken, {
      messaging_product: 'whatsapp',
      to:                normalizedPhone,
      type:              'text',
      text:              { body: text },
    })
  },
}
