import { Request, Response, NextFunction } from 'express'
import { customersService } from './customers.service'
import { customerCreditControlService } from './customer-credit-control.service'
import { sendSuccess, sendPaginated } from '../../utils/response'

export const customersController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try { const r = await customersService.list(req.tenantId!, req); sendPaginated(res, r.data, r.total, r.page, r.limit) } catch (e) { next(e) }
  },
  async getById(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await customersService.getById(req.tenantId!, req.params.id, req)) } catch (e) { next(e) }
  },
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(
        res,
        await customersService.create(req.tenantId!, req.body, req.user?.email, req),
        'Customer created',
        201,
      )
    } catch (e) { next(e) }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await customersService.update(req.tenantId!, req.params.id, req.body, req)) } catch (e) { next(e) }
  },
  async search(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await customersService.search(req.tenantId!, req.query.q as string, req)) } catch (e) { next(e) }
  },
  async setActive(req: Request, res: Response, next: NextFunction) {
    try {
      const isActive = req.body?.isActive !== false
      sendSuccess(
        res,
        await customersService.setActive(req.tenantId!, req.params.id, isActive, req),
        isActive ? 'Customer activated' : 'Customer deactivated',
      )
    } catch (e) { next(e) }
  },
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await customersService.remove(req.tenantId!, req.params.id, req), 'Customer deleted')
    } catch (e) { next(e) }
  },
  async unpaidInvoices(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await customersService.unpaidInvoices(req.tenantId!, req.params.id, req)) } catch (e) { next(e) }
  },
  async creditPayment(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await customersService.creditPayment(req.tenantId!, req.params.id, req.body, req)) } catch (e) { next(e) }
  },
  async getCreditControl(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await customerCreditControlService.getControl(req.tenantId!, req)) } catch (e) { next(e) }
  },
  async updateCreditControl(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(
        res,
        await customerCreditControlService.updateControl(req.tenantId!, req.body, req),
        'Credit control settings saved',
      )
    } catch (e) { next(e) }
  },
  async sendCreditReminder(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(
        res,
        await customerCreditControlService.sendOne(req.tenantId!, req.params.id, req.body, req),
        'Credit reminder sent',
      )
    } catch (e) { next(e) }
  },
  async sendCreditRemindersBulk(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(
        res,
        await customerCreditControlService.sendBulk(req.tenantId!, req.body, req),
        'Bulk credit reminders processed',
      )
    } catch (e) { next(e) }
  },
}
