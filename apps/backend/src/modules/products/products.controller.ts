import { Request, Response, NextFunction } from 'express'
import { productsService } from './products.service'
import { sendSuccess, sendPaginated } from '../../utils/response'
import { resolveActiveBranch, getUserBranchIds, assertBranchRecordAccess } from '../../utils/active-branch'
import { AppError } from '../../middleware/error.middleware'

export const productsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try { const r = await productsService.list(req.tenantId!, req); sendPaginated(res, r.data, r.total, r.page, r.limit) } catch (e) { next(e) }
  },
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await productsService.getById(req.tenantId!, req.params.id)
      assertBranchRecordAccess(req, (data as any).branchId)
      sendSuccess(res, data)
    } catch (e) { next(e) }
  },
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const body = { ...req.body }
      if (!body.branchId) {
        const branchId = await resolveActiveBranch(req, { required: true })
        body.branchId = branchId
      } else {
        const user = req.user!
        const allowed = await getUserBranchIds(user.userId, req.tenantId!, user.role)
        if (!allowed.includes(body.branchId)) throw new AppError('Branch access denied', 403)
      }
      sendSuccess(res, await productsService.create(req.tenantId!, body), 'Product created', 201)
    } catch (e) { next(e) }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await productsService.update(req.tenantId!, req.params.id, req.body)) } catch (e) { next(e) }
  },
  async remove(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await productsService.remove(req.tenantId!, req.params.id)) } catch (e) { next(e) }
  },
  async getCategories(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await productsService.getCategories(req.tenantId!)) } catch (e) { next(e) }
  },
  async createCategory(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await productsService.createCategory(req.tenantId!, req.body), 'Category created', 201) } catch (e) { next(e) }
  },
  async deleteCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const reassignToId = req.query.reassignToId as string | undefined
      await productsService.deleteCategory(req.tenantId!, req.params.id, reassignToId)
      sendSuccess(res, null, 'Category deleted')
    } catch (e) { next(e) }
  },
  async getBrands(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await productsService.getBrands(req.tenantId!)) } catch (e) { next(e) }
  },
  async createBrand(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await productsService.createBrand(req.tenantId!, req.body), 'Brand created', 201) } catch (e) { next(e) }
  },
  async getImeiHealth(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await productsService.getImeiHealth(req.tenantId!)) } catch (e) { next(e) }
  },
  async bulkInferTrackImei(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await productsService.bulkInferTrackImei(req.tenantId!), 'IMEI flags updated') } catch (e) { next(e) }
  },
}
