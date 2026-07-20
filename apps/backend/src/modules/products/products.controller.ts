import { Request, Response, NextFunction } from 'express'
import { productsService } from './products.service'
import { sendSuccess, sendPaginated } from '../../utils/response'
import { resolveActiveBranch, getUserBranchIds, assertBranchRecordAccess, effectiveBranchId } from '../../utils/active-branch'
import { AppError } from '../../middleware/error.middleware'
import { prisma } from '../../config/database'
import { masterCatalogImportService } from '../master-catalog/master-catalog-import.service'

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
      const tenantId = req.tenantId!
      const activeBranches = await prisma.branch.findMany({
        where: { tenantId, isActive: true },
        select: { id: true },
        orderBy: [{ isDefault: 'desc' }, { isHeadquarters: 'desc' }, { createdAt: 'asc' }],
      })
      if (activeBranches.length <= 1) {
        const onlyId = activeBranches[0]?.id ?? await resolveActiveBranch(req, { required: true })
        body.branchId = onlyId
      } else if (!body.branchId) {
        const branchId = await resolveActiveBranch(req, { required: true })
        body.branchId = branchId
      } else {
        const user = req.user!
        const allowed = await getUserBranchIds(user.userId, tenantId, user.role)
        if (!allowed.includes(body.branchId)) throw new AppError('Branch access denied', 403)
      }
      sendSuccess(res, await productsService.create(tenantId, body, req), 'Product created', 201)
    } catch (e) { next(e) }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const existing = await productsService.getById(req.tenantId!, req.params.id) as { branchId?: string }
      assertBranchRecordAccess(req, existing.branchId)
      sendSuccess(res, await productsService.update(req.tenantId!, req.params.id, req.body, req))
    } catch (e) { next(e) }
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
  async nextCodes(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await productsService.nextCodes(req.tenantId!)) } catch (e) { next(e) }
  },
  async lookupByCode(req: Request, res: Response, next: NextFunction) {
    try {
      const code = String(req.query.code ?? '').trim()
      if (!code) throw new AppError('Barcode or SKU code is required', 400)
      const branchId = effectiveBranchId(req)
      const data = await productsService.lookupByCode(req.tenantId!, code, branchId)
      if (branchId && (data.product as any)?.branchId && (data.product as any).branchId !== branchId) {
        throw new AppError('Product belongs to another branch', 403)
      }
      sendSuccess(res, data)
    } catch (e) { next(e) }
  },
  async importFromMaster(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!
      const body = { ...req.body }
      const activeBranches = await prisma.branch.findMany({
        where: { tenantId, isActive: true },
        select: { id: true },
        orderBy: [{ isDefault: 'desc' }, { isHeadquarters: 'desc' }, { createdAt: 'asc' }],
      })
      if (activeBranches.length <= 1) {
        body.branchId = activeBranches[0]?.id ?? await resolveActiveBranch(req, { required: true })
      } else if (!body.branchId) {
        body.branchId = await resolveActiveBranch(req, { required: true })
      } else {
        const user = req.user!
        const allowed = await getUserBranchIds(user.userId, tenantId, user.role)
        if (!allowed.includes(body.branchId)) throw new AppError('Branch access denied', 403)
      }
      sendSuccess(res, await masterCatalogImportService.importToTenant(tenantId, body), 'Import complete')
    } catch (e) { next(e) }
  },
}
