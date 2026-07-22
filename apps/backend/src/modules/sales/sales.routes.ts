import { Router } from 'express'
import { Request, Response, NextFunction } from 'express'
import { salesService } from './sales.service'
import { processSaleReturn, updateSaleInvoice, voidSaleInvoice } from './sale-mutation.service'
import { sendSuccess, sendPaginated } from '../../utils/response'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { enforceModuleAccess } from '../../middleware/module-access.middleware'
import { prisma } from '../../config/database'
import { getPagination } from '../../utils/pagination'
import { effectiveBranchId } from '../../utils/active-branch'

const router = Router()
router.use(authenticate)
router.use(enforceModuleAccess('POS'))

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try { const r = await salesService.list(req.tenantId!, req); sendPaginated(res, r.data, r.total, r.page, r.limit) } catch (e) { next(e) }
})

router.get('/returns', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, limit, page } = getPagination(req)
    const branchId = effectiveBranchId(req)
    const where: any = {
      tenantId: req.tenantId!,
      ...(branchId ? { sale: { branchId } } : {}),
    }
    const [data, total] = await Promise.all([
      prisma.saleReturn.findMany({
        where,
        skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: true, sale: { select: { invoiceNumber: true, customerName: true, branchId: true } } },
      }),
      prisma.saleReturn.count({ where }),
    ])
    sendPaginated(res, data, total, page, limit)
  } catch (e) { next(e) }
})

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await salesService.getById(req.tenantId!, req.params.id, req)) } catch (e) { next(e) }
})

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const u = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { name: true } })
    const cashierName = u?.name || req.user!.email
    sendSuccess(res, await salesService.create(req.tenantId!, req.user!.userId, cashierName, req.body, req), 'Sale created', 201)
  } catch (e) { next(e) }
})

router.patch('/:id', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(
      res,
      await updateSaleInvoice({
        tenantId: req.tenantId!,
        saleId: req.params.id,
        adminPassword: String(req.body.adminPassword ?? ''),
        performedBy: req.user?.userId ?? 'system',
        actorEmail: req.user?.email,
        req,
        customerName: req.body.customerName,
        customerPhone: req.body.customerPhone,
        notes: req.body.notes,
        discount: req.body.discount != null ? Number(req.body.discount) : undefined,
        items: Array.isArray(req.body.items) ? req.body.items : undefined,
        payments: Array.isArray(req.body.payments) ? req.body.payments : undefined,
      }),
      'Sale updated',
    )
  } catch (e) { next(e) }
})

router.post('/:id/void', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(
      res,
      await voidSaleInvoice({
        tenantId: req.tenantId!,
        saleId: req.params.id,
        adminPassword: String(req.body.adminPassword ?? ''),
        reason: req.body.reason ? String(req.body.reason) : undefined,
        performedBy: req.user?.userId ?? 'system',
        actorEmail: req.user?.email,
        req,
      }),
      'Sale voided',
    )
  } catch (e) { next(e) }
})

router.delete('/:id', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(
      res,
      await voidSaleInvoice({
        tenantId: req.tenantId!,
        saleId: req.params.id,
        adminPassword: String(req.body?.adminPassword ?? req.query.adminPassword ?? ''),
        reason: req.body?.reason ? String(req.body.reason) : 'Deleted by admin',
        performedBy: req.user?.userId ?? 'system',
        actorEmail: req.user?.email,
        req,
      }),
      'Sale deleted',
    )
  } catch (e) { next(e) }
})

router.post('/:id/returns', authorize('OWNER', 'MANAGER', 'CASHIER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { items, reason, refundMethod, notes } = req.body
    sendSuccess(
      res,
      await processSaleReturn({
        tenantId: req.tenantId!,
        saleId: req.params.id,
        performedBy: req.user?.userId ?? 'system',
        actorEmail: req.user?.email,
        items: Array.isArray(items) ? items : [],
        reason: String(reason || 'Customer return'),
        refundMethod: String(refundMethod || 'CASH'),
        notes: notes ?? null,
        req,
      }),
      'Return processed successfully',
      201,
    )
  } catch (e) { next(e) }
})

export default router
