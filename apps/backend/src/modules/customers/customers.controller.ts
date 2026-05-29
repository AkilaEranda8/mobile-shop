import { Request, Response, NextFunction } from 'express'
import { customersService } from './customers.service'
import { sendSuccess, sendPaginated } from '../../utils/response'

export const customersController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try { const r = await customersService.list(req.tenantId!, req); sendPaginated(res, r.data, r.total, r.page, r.limit) } catch (e) { next(e) }
  },
  async getById(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await customersService.getById(req.tenantId!, req.params.id)) } catch (e) { next(e) }
  },
  async create(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await customersService.create(req.tenantId!, req.body), 'Customer created', 201) } catch (e) { next(e) }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await customersService.update(req.tenantId!, req.params.id, req.body)) } catch (e) { next(e) }
  },
  async search(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await customersService.search(req.tenantId!, req.query.q as string)) } catch (e) { next(e) }
  },
  async creditPayment(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await customersService.creditPayment(req.tenantId!, req.params.id, req.body)) } catch (e) { next(e) }
  },
}
