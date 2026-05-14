import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import type { ConnectInput, UpdateConfigInput, SendInvoiceInput } from './whatsapp.schema'

const META_API = 'https://graph.facebook.com/v19.0'

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
  if (token.length <= 12) return '***'
  return token.slice(0, 8) + '***' + token.slice(-4)
}

function formatTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (t, [k, v]) => t.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v),
    template,
  )
}

// ── Service ───────────────────────────────────────────────────────────────────

export const whatsappService = {

  async getStatus(tenantId: string) {
    const cfg = await prisma.whatsAppConfig.findUnique({ where: { tenantId } })
    if (!cfg) return { status: 'disconnected' as const }
    return {
      status:        cfg.status as 'connected' | 'disconnected' | 'token_expired',
      phoneNumber:   cfg.phoneNumber   ?? undefined,
      displayName:   cfg.displayName   ?? undefined,
      qualityRating: cfg.qualityRating ?? undefined,
      lastChecked:   cfg.lastCheckedAt?.toISOString(),
    }
  },

  async getConfig(tenantId: string) {
    const cfg = await prisma.whatsAppConfig.findUnique({ where: { tenantId } })
    if (!cfg) return null
    return {
      accessToken:     maskToken(cfg.accessToken),
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
      status:      cfg.status as 'connected' | 'disconnected' | 'token_expired',
      phoneNumber: cfg.phoneNumber   ?? undefined,
      displayName: cfg.displayName   ?? undefined,
      lastChecked: cfg.lastCheckedAt?.toISOString(),
    }
  },

  async disconnect(tenantId: string) {
    await prisma.whatsAppConfig.updateMany({
      where: { tenantId },
      data:  { status: 'disconnected', enabled: false },
    })
    return { success: true }
  },

  async updateConfig(tenantId: string, input: UpdateConfigInput) {
    const existing = await prisma.whatsAppConfig.findUnique({ where: { tenantId } })
    if (!existing) throw new Error('WhatsApp not configured. Please connect first.')
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
      accessToken:     maskToken(cfg.accessToken),
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
    if (!cfg || !cfg.accessToken || !cfg.phoneNumberId)
      throw new AppError('WhatsApp not configured. Please save your credentials first.', 400)

    const normalizedPhone = phone.startsWith('+') ? phone.slice(1) : phone

    let result: any
    let msgStatus = 'sent'
    let metaErr: string | undefined
    try {
      result = await metaPost(`/${cfg.phoneNumberId}/messages`, cfg.accessToken, {
        messaging_product: 'whatsapp',
        to:                normalizedPhone,
        type:              'template',
        template:          { name: 'hello_world', language: { code: 'en_US' } },
      })
      // Update DB status to connected since send succeeded
      await prisma.whatsAppConfig.update({
        where: { tenantId },
        data:  { status: 'connected', lastCheckedAt: new Date() },
      }).catch(() => {})
    } catch (err: any) {
      msgStatus = 'failed'
      metaErr   = err?.message ?? 'Meta API error'
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

    if (metaErr) throw new AppError(metaErr, 400)
    return { success: true, message: 'Test message sent successfully!' }
  },

  async sendInvoice(tenantId: string, input: SendInvoiceInput) {
    const cfg = await prisma.whatsAppConfig.findUnique({ where: { tenantId } })
    if (!cfg) throw new Error('WhatsApp not configured')
    if (!cfg.enabled) throw new Error('WhatsApp integration is disabled')
    if (cfg.status !== 'connected') throw new Error('WhatsApp is not connected')

    const normalizedPhone = input.phone.startsWith('+') ? input.phone.slice(1) : input.phone

    const template = cfg.invoiceTemplate || `Hello {{customer_name}},\n\nThank you for your purchase! 🎉\n\nOrder: {{order_id}}\nAmount: LKR {{amount}}\n\nThank you for choosing us!`

    const messageBody = formatTemplate(template, {
      customer_name: input.customerName ?? 'Customer',
      order_id:      input.orderId,
      amount:        input.amount ? input.amount.toLocaleString() : '0',
      currency:      'LKR',
      date:          new Date().toLocaleDateString(),
      shop_name:     'Hexalyte',
    })

    const result = await metaPost(`/${cfg.phoneNumberId}/messages`, cfg.accessToken, {
      messaging_product: 'whatsapp',
      to:                normalizedPhone,
      type:              'text',
      text:              { body: messageBody },
    })

    const preview = `Invoice #${input.orderId}${input.amount ? ` · LKR ${input.amount.toLocaleString()}` : ''}`

    const msg = await prisma.whatsAppMessage.create({
      data: {
        tenantId,
        configId:     cfg.id,
        orderId:      input.orderId,
        to:           input.phone,
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
      status:       m.status as 'delivered' | 'failed' | 'pending',
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
}
