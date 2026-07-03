import { Request, Response, NextFunction } from 'express'
import { tenantsService } from './tenants.service'
import { sendSuccess } from '../../utils/response'
import { AppError } from '../../middleware/error.middleware'

// Non platform-admins may only act on their own tenant, regardless of the :id in the URL.
function assertTenantAccess(req: Request) {
  if (req.user?.role !== 'PLATFORM_ADMIN' && req.params.id !== req.tenantId) {
    throw new AppError('Forbidden: cannot access another tenant', 403)
  }
}

export const tenantsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await tenantsService.list()) } catch (e) { next(e) }
  },
  async getById(req: Request, res: Response, next: NextFunction) {
    try { assertTenantAccess(req); sendSuccess(res, await tenantsService.getById(req.params.id)) } catch (e) { next(e) }
  },
  async getMe(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await tenantsService.getById(req.tenantId!)) } catch (e) { next(e) }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      assertTenantAccess(req)
      const isAdmin = req.user?.role === 'PLATFORM_ADMIN'
      const body = req.body ?? {}
      // Only platform admins may change billing plan / account status.
      const safe: Record<string, unknown> = {}
      if (body.name !== undefined) safe.name = body.name
      if (isAdmin) {
        if (body.plan !== undefined) safe.plan = body.plan
        if (body.status !== undefined) safe.status = body.status
      }
      sendSuccess(res, await tenantsService.update(req.params.id, safe))
    } catch (e) { next(e) }
  },
  async getBranches(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await tenantsService.getBranches(req.tenantId!, req.user!.userId, req.user!.role))
    } catch (e) { next(e) }
  },
  async createBranch(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await tenantsService.createBranch(req.tenantId!, req.body), 'Branch created', 201) } catch (e) { next(e) }
  },
  async updateBranch(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await tenantsService.updateBranch(req.tenantId!, req.params.id, req.body, req.user!.userId, req.user!.role))
    } catch (e) { next(e) }
  },
  async getInvoiceSettings(req: Request, res: Response, next: NextFunction) {
    try {
      assertTenantAccess(req)
      const branchId = req.query.branchId as string | undefined
      sendSuccess(res, await tenantsService.getInvoiceSettings(req.params.id, branchId))
    } catch (e) { next(e) }
  },
  async listInvoiceTemplates(_req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, tenantsService.listInvoiceTemplates()) } catch (e) { next(e) }
  },
  async updateInvoiceSettings(req: Request, res: Response, next: NextFunction) {
    try { assertTenantAccess(req); sendSuccess(res, await tenantsService.updateInvoiceSettings(req.params.id, req.body)) } catch (e) { next(e) }
  },
  async getReloadSettings(req: Request, res: Response, next: NextFunction) {
    try { assertTenantAccess(req); sendSuccess(res, await tenantsService.getReloadSettings(req.params.id)) } catch (e) { next(e) }
  },
  async updateReloadSettings(req: Request, res: Response, next: NextFunction) {
    try { assertTenantAccess(req); sendSuccess(res, await tenantsService.updateReloadSettings(req.params.id, req.body)) } catch (e) { next(e) }
  },
  async getProductVariantSettings(req: Request, res: Response, next: NextFunction) {
    try { assertTenantAccess(req); sendSuccess(res, await tenantsService.getProductVariantSettings(req.params.id)) } catch (e) { next(e) }
  },
  async updateProductVariantSettings(req: Request, res: Response, next: NextFunction) {
    try { assertTenantAccess(req); sendSuccess(res, await tenantsService.updateProductVariantSettings(req.params.id, req.body)) } catch (e) { next(e) }
  },
}
