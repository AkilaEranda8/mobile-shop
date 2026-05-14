import { Request, Response, NextFunction } from 'express'
import { tenantsService } from './tenants.service'
import { sendSuccess } from '../../utils/response'

export const tenantsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await tenantsService.list()) } catch (e) { next(e) }
  },
  async getById(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await tenantsService.getById(req.params.id)) } catch (e) { next(e) }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await tenantsService.update(req.params.id, req.body)) } catch (e) { next(e) }
  },
  async getBranches(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await tenantsService.getBranches(req.tenantId!)) } catch (e) { next(e) }
  },
  async createBranch(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await tenantsService.createBranch(req.tenantId!, req.body), 'Branch created', 201) } catch (e) { next(e) }
  },
  async updateBranch(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await tenantsService.updateBranch(req.tenantId!, req.params.id, req.body)) } catch (e) { next(e) }
  },
  async getInvoiceSettings(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await tenantsService.getInvoiceSettings(req.params.id)) } catch (e) { next(e) }
  },
  async updateInvoiceSettings(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await tenantsService.updateInvoiceSettings(req.params.id, req.body)) } catch (e) { next(e) }
  },
}
