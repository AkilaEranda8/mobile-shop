import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/database'
import { sendSuccess, sendPaginated } from '../../utils/response'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { AppError } from '../../middleware/error.middleware'
import { validate } from '../../middleware/validate.middleware'
import { getPagination } from '../../utils/pagination'
import { assertBusinessDayOpenIfEnabled } from '../daily-closing/day-lock.util'
import { resolveQueryDateRange, businessDayRange } from '../../utils/date-range'
import { getPeriodFinancials, toFinanceSummaryResponse } from './business-financials.service'
import { effectiveBranchId } from '../../utils/active-branch'
import { createTransactionSchema } from './finance.schema'
import { buildPlStatement } from './pl-statement.service'

const router = Router()
router.use(authenticate)

router.get('/transactions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, limit, page } = getPagination(req)
    const type     = req.query.type     as string | undefined
    const branchId = effectiveBranchId(req)
    const category = req.query.category as string | undefined
    const search   = req.query.search   as string | undefined
    const from     = req.query.from     as string | undefined
    const to       = req.query.to       as string | undefined
    const where: any = {
      tenantId: req.tenantId!,
      ...(type     && { type }),
      ...(branchId && { branchId }),
      ...(category && { category }),
      ...(search   && { description: { contains: search, mode: 'insensitive' } }),
    }
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = businessDayRange(from).start
      if (to) where.createdAt.lte = businessDayRange(to).end
    }
    const [data, total] = await Promise.all([prisma.transaction.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }), prisma.transaction.count({ where })])
    sendPaginated(res, data, total, page, limit)
  } catch (e) { next(e) }
})

router.post('/transactions', authorize('OWNER', 'MANAGER', 'CASHIER'), validate(createTransactionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as ReturnType<typeof createTransactionSchema.parse>
    const branchId = body.branchId ?? effectiveBranchId(req)
    if (!branchId) throw new AppError('branchId is required — select an active branch', 400)

    await assertBusinessDayOpenIfEnabled(req.tenantId!, branchId)
    sendSuccess(res, await prisma.transaction.create({
      data: {
        tenantId: req.tenantId!,
        branchId,
        type: body.type,
        category: body.category,
        amount: body.amount,
        description: body.description,
        paymentMethod: body.paymentMethod,
        reference: body.reference,
        performedBy: req.user!.email,
      },
    }), 'Transaction recorded', 201)
  } catch (e) { next(e) }
})

router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const branchId = effectiveBranchId(req)
    const { fromKey, toKey } = resolveQueryDateRange({
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      defaultFrom: 'month_start',
    })

    const fin = await getPeriodFinancials(tenantId, fromKey, toKey, branchId)
    sendSuccess(res, toFinanceSummaryResponse(fin, { from: fromKey, to: toKey }))
  } catch (e) { next(e) }
})

router.get('/pl-statement', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const branchId = effectiveBranchId(req)
    const { fromKey, toKey } = resolveQueryDateRange({
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      defaultFrom: 'month_start',
    })
    sendSuccess(res, await buildPlStatement(tenantId, fromKey, toKey, branchId))
  } catch (e) { next(e) }
})

router.get('/daily-summaries', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, limit, page } = getPagination(req)
    const branchId = effectiveBranchId(req)
    const where: any = { tenantId: req.tenantId!, ...(branchId && { branchId }) }
    const [data, total] = await Promise.all([prisma.dailySummary.findMany({ where, skip, take: limit, orderBy: { date: 'desc' } }), prisma.dailySummary.count({ where })])
    sendPaginated(res, data, total, page, limit)
  } catch (e) { next(e) }
})

export default router
