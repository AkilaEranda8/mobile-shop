import { Request, Response, NextFunction } from 'express'
import { whatsappService } from './whatsapp.service'
import { notifySaleInvoice } from '../notification-engine/notification-engine.service'
import { sendSuccess } from '../../utils/response'
import { prisma } from '../../config/database'
import { effectiveBranchId } from '../../utils/active-branch'
import { env } from '../../config/env'
import { createHmac, timingSafeEqual } from 'crypto'

export const whatsappController = {

  async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await whatsappService.getStatus(req.user!.tenantId)
      sendSuccess(res, data)
    } catch (e) { next(e) }
  },

  async getConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await whatsappService.getConfig(req.user!.tenantId)
      sendSuccess(res, data)
    } catch (e) { next(e) }
  },

  async connect(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await whatsappService.connect(req.user!.tenantId, req.body)
      sendSuccess(res, data, 'WhatsApp connected successfully')
    } catch (e) { next(e) }
  },

  async disconnect(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await whatsappService.disconnect(req.user!.tenantId)
      sendSuccess(res, data, 'WhatsApp disconnected')
    } catch (e) { next(e) }
  },

  async updateConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await whatsappService.updateConfig(req.user!.tenantId, req.body)
      sendSuccess(res, data, 'Config updated')
    } catch (e) { next(e) }
  },

  async testConnection(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await whatsappService.testConnection(req.user!.tenantId)
      sendSuccess(res, data)
    } catch (e) { next(e) }
  },

  async sendTestMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await whatsappService.sendTestMessage(req.user!.tenantId, req.body.phone)
      sendSuccess(res, data)
    } catch (e) { next(e) }
  },

  async sendInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await notifySaleInvoice(req.user!.tenantId, req.body, effectiveBranchId(req))
      sendSuccess(res, data, 'Invoice sent via WhatsApp')
    } catch (e) { next(e) }
  },

  async sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await whatsappService.sendMessage(req.user!.tenantId, req.body, effectiveBranchId(req))
      sendSuccess(res, data, 'Message sent via WhatsApp')
    } catch (e) { next(e) }
  },

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await whatsappService.getStats(req.user!.tenantId, effectiveBranchId(req))
      sendSuccess(res, data)
    } catch (e) { next(e) }
  },

  async getInvoiceHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await whatsappService.getInvoiceHistory(req.user!.tenantId, effectiveBranchId(req))
      sendSuccess(res, data)
    } catch (e) { next(e) }
  },

  async getRecentMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await whatsappService.getRecentMessages(req.user!.tenantId, effectiveBranchId(req))
      sendSuccess(res, data)
    } catch (e) { next(e) }
  },

  async getQrSession(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await whatsappService.getQrSession(req.user!.tenantId)
      sendSuccess(res, data)
    } catch (e) { next(e) }
  },

  async startQrConnect(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await whatsappService.startQrConnect(req.user!.tenantId)
      sendSuccess(res, data, 'QR session started')
    } catch (e) { next(e) }
  },

  async refreshQrConnect(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await whatsappService.refreshQrConnect(req.user!.tenantId)
      sendSuccess(res, data, 'QR code refreshed')
    } catch (e) { next(e) }
  },

  // ── Meta webhook verification (public) ──────────────────────────────────────
  async webhookVerify(req: Request, res: Response) {
    const mode      = req.query['hub.mode']
    const token     = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']
    if (mode !== 'subscribe' || !token) return res.sendStatus(403)

    const tokenStr = Array.isArray(token) ? token[0] : String(token)
    const challengeStr = Array.isArray(challenge) ? challenge[0] : String(challenge ?? '')
    if (!challengeStr) return res.sendStatus(403)

    // Multi-tenant: accept webhook verification only if the token matches
    // an enabled tenant WhatsApp config.
    const cfg = await prisma.whatsAppConfig.findFirst({
      where: { verifyToken: tokenStr, enabled: true },
      select: { id: true },
    })
    if (!cfg) return res.sendStatus(403)

    return res.status(200).send(challengeStr)
  },

  // ── Meta webhook events (public) ────────────────────────────────────────────
  async webhookEvent(req: Request, res: Response) {
    const body = req.body

    // Signature verification (best-effort). Meta sends `X-Hub-Signature-256: sha256=<hex>`.
    const signature = req.header('x-hub-signature-256')
    const secret = env.WHATSAPP_APP_SECRET || env.META_APP_SECRET
    if (secret) {
      if (!signature) return res.sendStatus(403)
      const rawBody = (req as any).rawBody as Buffer | undefined
      if (!rawBody) return res.sendStatus(400)

      const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex')
      const sigBuf = Buffer.from(signature)
      const expBuf = Buffer.from(expected)
      if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
        return res.sendStatus(403)
      }
    }

    if (body?.object === 'whatsapp_business_account') {
      const entries = body.entry ?? []
      const phoneNumberIds = entries.map((e: any) => String(e?.id ?? '')).filter(Boolean)

      const enabledConfigs = phoneNumberIds.length
        ? await prisma.whatsAppConfig.findMany({
            where: { phoneNumberId: { in: phoneNumberIds }, enabled: true },
            select: { id: true, phoneNumberId: true },
          })
        : []

      const cfgIdsByPhone = new Map<string, string[]>()
      for (const c of enabledConfigs) {
        const key = String(c.phoneNumberId ?? '')
        if (!key) continue
        cfgIdsByPhone.set(key, [...(cfgIdsByPhone.get(key) ?? []), c.id])
      }

      for (const entry of entries) {
        const phoneId = String(entry?.id ?? '')
        const cfgIds = cfgIdsByPhone.get(phoneId)
        if (!cfgIds?.length) continue

        for (const change of entry?.changes ?? []) {
          const statuses = change?.value?.statuses ?? []
          for (const status of statuses) {
            const metaMessageId = status?.id
            const nextStatus = status?.status
            if (metaMessageId && nextStatus) {
              await prisma.whatsAppMessage.updateMany({
                where: { metaMessageId: metaMessageId, configId: { in: cfgIds } },
                data: { status: nextStatus },
              }).catch(() => {})
            }
          }
        }
      }
    }
    res.sendStatus(200)
  },
}
