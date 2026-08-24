import { Request, Response, NextFunction } from 'express'
import { sendSuccess } from '../../utils/response'
import { effectiveBranchId } from '../../utils/active-branch'
import {
  getSmsHistory,
  getSmsRecentMessages,
  getSmsSettingsForClient,
  getSmsStats,
  getSmsStatus,
  sendManualSms,
  sendSmsTest,
  updateSmsSettingsForClient,
} from './sms.service'
import { sendSaleSmsForPos } from './sms-notify.service'

export const smsController = {
  async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await getSmsStatus(req.tenantId!))
    } catch (e) { next(e) }
  },

  async getConfig(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await getSmsSettingsForClient(req.tenantId!))
    } catch (e) { next(e) }
  },

  async updateConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await updateSmsSettingsForClient(req.tenantId!, req.body ?? {})
      sendSuccess(res, data, 'SMS settings saved')
    } catch (e) { next(e) }
  },

  async sendTestMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await sendSmsTest(
        req.tenantId!,
        req.body.phone,
        req.body.message,
        effectiveBranchId(req),
      )
      sendSuccess(res, data, 'Test SMS sent')
    } catch (e) { next(e) }
  },

  async sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await sendManualSms(
        req.tenantId!,
        req.body.phone,
        req.body.message,
        effectiveBranchId(req),
        req.body.customerName,
      )
      sendSuccess(res, data, 'SMS sent')
    } catch (e) { next(e) }
  },

  async sendSaleSms(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await sendSaleSmsForPos({
        tenantId: req.tenantId!,
        saleId: req.body.saleId,
        phone: req.body.phone,
        branchId: effectiveBranchId(req),
      })
      sendSuccess(res, data, 'Sale SMS sent')
    } catch (e) { next(e) }
  },

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await getSmsStats(req.tenantId!, effectiveBranchId(req)))
    } catch (e) { next(e) }
  },

  async getHistory(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await getSmsHistory(req.tenantId!, effectiveBranchId(req)))
    } catch (e) { next(e) }
  },

  async getRecentMessages(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await getSmsRecentMessages(req.tenantId!, effectiveBranchId(req)))
    } catch (e) { next(e) }
  },
}
