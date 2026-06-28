import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/database'
import { sendSuccess, sendPaginated } from '../../utils/response'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { getPagination } from '../../utils/pagination'
import { assertBusinessDayOpenIfEnabled } from '../daily-closing/day-lock.util'
import { resolveQueryDateRange } from '../../utils/date-range'
import { getPeriodFinancials, toFinanceSummaryResponse } from './business-financials.service'
import { effectiveBranchId } from '../../utils/active-branch'

const router = Router()
router.use(authenticate)

router.get('/transactions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, limit, page } = getPagination(req)
    const type     = req.query.type     as string | undefined
    const branchId = effectiveBranchId(req)
    const category = req.query.category as string | undefined
    const search   = req.query.search   as string | undefined
    const where: any = {
      tenantId: req.tenantId!,
      ...(type     && { type }),
      ...(branchId && { branchId }),
      ...(category && { category }),
      ...(search   && { description: { contains: search, mode: 'insensitive' } }),
    }
    const [data, total] = await Promise.all([prisma.transaction.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }), prisma.transaction.count({ where })])
    sendPaginated(res, data, total, page, limit)
  } catch (e) { next(e) }
})

router.post('/transactions', authorize('OWNER', 'MANAGER', 'CASHIER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await assertBusinessDayOpenIfEnabled(req.tenantId!, req.body.branchId)
    sendSuccess(res, await prisma.transaction.create({ data: { ...req.body, tenantId: req.tenantId!, performedBy: req.user!.email } }), 'Transaction recorded', 201)
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
