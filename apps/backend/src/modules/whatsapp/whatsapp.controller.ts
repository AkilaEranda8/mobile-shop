import { Request, Response, NextFunction } from 'express'
import { whatsappService } from './whatsapp.service'
import { sendSuccess } from '../../utils/response'
import { prisma } from '../../config/database'

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
      const data = await whatsappService.sendInvoice(req.user!.tenantId, req.body)
      sendSuccess(res, data, 'Invoice sent via WhatsApp')
    } catch (e) { next(e) }
  },

  async sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await whatsappService.sendMessage(req.user!.tenantId, req.body)
      sendSuccess(res, data, 'Message sent via WhatsApp')
    } catch (e) { next(e) }
  },

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await whatsappService.getStats(req.user!.tenantId)
      sendSuccess(res, data)
    } catch (e) { next(e) }
  },

  async getInvoiceHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await whatsappService.getInvoiceHistory(req.user!.tenantId)
      sendSuccess(res, data)
    } catch (e) { next(e) }
  },

  async getRecentMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await whatsappService.getRecentMessages(req.user!.tenantId)
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
    if (mode === 'subscribe' && token) {
      res.status(200).send(challenge)
    } else {
      res.sendStatus(403)
    }
  },

  // ── Meta webhook events (public) ────────────────────────────────────────────
  async webhookEvent(req: Request, res: Response) {
    const body = req.body
    if (body?.object === 'whatsapp_business_account') {
      for (const entry of body.entry ?? []) {
        for (const change of entry.changes ?? []) {
          const statuses = change?.value?.statuses ?? []
          for (const status of statuses) {
            if (status?.id && status?.status) {
              await prisma.whatsAppMessage.updateMany({
                where: { metaMessageId: status.id },
                data:  { status: status.status },
              }).catch(() => {})
            }
          }
        }
      }
    }
    res.sendStatus(200)
  },
}
