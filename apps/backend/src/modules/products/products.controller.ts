import { Request, Response, NextFunction } from 'express'
import { productsService } from './products.service'
import { sendSuccess, sendPaginated } from '../../utils/response'

export const productsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try { const r = await productsService.list(req.tenantId!, req); sendPaginated(res, r.data, r.total, r.page, r.limit) } catch (e) { next(e) }
  },
  async getById(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await productsService.getById(req.tenantId!, req.params.id)) } catch (e) { next(e) }
  },
  async create(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await productsService.create(req.tenantId!, req.body), 'Product created', 201) } catch (e) { next(e) }
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
    try { await productsService.deleteCategory(req.tenantId!, req.params.id); sendSuccess(res, null, 'Category deleted') } catch (e) { next(e) }
  },
  async getBrands(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await productsService.getBrands(req.tenantId!)) } catch (e) { next(e) }
  },
  async createBrand(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await productsService.createBrand(req.tenantId!, req.body), 'Brand created', 201) } catch (e) { next(e) }
  },
}
