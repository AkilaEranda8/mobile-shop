import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/database'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { enforceModuleAccess } from '../../middleware/module-access.middleware'
import { validate } from '../../middleware/validate.middleware'
import { sendSuccess, sendPaginated } from '../../utils/response'
import { getPagination } from '../../utils/pagination'
import { AppError } from '../../middleware/error.middleware'
import { businessDateFromInstant } from '../../utils/date-range'
import {
  createFundSchema,
  updateFundSchema,
  saveAllocationSchema,
  fundMovementSchema,
  adjustmentSchema,
} from './profit-allocation.schema'
import * as profitAllocationService from './profit-allocation.service'
import { effectiveBranchId, resolveMutationBranchId } from '../../utils/active-branch'

const router = Router()
router.use(authenticate)
router.use(enforceModuleAccess('PROFIT_ALLOCATION'))

async function requireProfitAllocationFeature(req: Request, _res: Response, next: NextFunction) {
  try {
    const feat = await prisma.tenantFeature.findFirst({
      where: { tenantId: req.tenantId!, feature: 'PROFIT_ALLOCATION', enabled: true },
    })
    if (!feat) throw new AppError('Profit Allocation is not enabled. Enable it in Settings or contact admin.', 403)
    next()
  } catch (e) { next(e) }
}
router.use(requireProfitAllocationFeature)

router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = effectiveBranchId(req)
    const date = (req.query.date as string) || businessDateFromInstant()
    const live = req.query.live === 'true' || req.query.live === '1'
    if (!branchId) throw new AppError('branchId is required', 400)
    sendSuccess(res, await profitAllocationService.getDashboard(req.tenantId!, branchId, date, { live }))
  } catch (e) { next(e) }
})

router.post('/calculate', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, normalizePercentages } = req.body
    if (!date) throw new AppError('date is required', 400)
    const branchId = await resolveMutationBranchId(req, { preferred: req.body.branchId })
    if (normalizePercentages) {
      await profitAllocationService.normalizeFundPercentages(req.tenantId!, branchId)
    }
    sendSuccess(
      res,
      await profitAllocationService.calculateAllocationLines(req.tenantId!, branchId, date, {
        normalizePercentages: Boolean(normalizePercentages),
      }),
    )
  } catch (e) { next(e) }
})

router.post('/save', authorize('OWNER', 'MANAGER'), validate(saveAllocationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, notes } = req.body
    const branchId = await resolveMutationBranchId(req, { preferred: req.body.branchId })
    sendSuccess(
      res,
      await profitAllocationService.saveAllocation(
        req.tenantId!,
        branchId,
        date,
        req.user!.userId,
        req.user!.email,
        notes,
      ),
      'Allocation saved',
      201,
    )
  } catch (e) { next(e) }
})

router.delete('/allocations/:date', authorize('OWNER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = effectiveBranchId(req)
    if (!branchId) throw new AppError('branchId is required', 400)
    await profitAllocationService.deleteAllocation(req.tenantId!, branchId, req.params.date)
    sendSuccess(res, null, 'Allocation deleted')
  } catch (e) { next(e) }
})

router.post('/resave', authorize('OWNER', 'MANAGER'), validate(saveAllocationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, notes } = req.body
    const branchId = await resolveMutationBranchId(req, { preferred: req.body.branchId })
    sendSuccess(
      res,
      await profitAllocationService.resaveAllocation(
        req.tenantId!,
        branchId,
        date,
        req.user!.userId,
        req.user!.email,
        notes,
      ),
      'Allocation recalculated and saved',
    )
  } catch (e) { next(e) }
})

router.get('/category-table', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = effectiveBranchId(req)
    const date = (req.query.date as string) || businessDateFromInstant()
    if (!branchId) throw new AppError('branchId is required', 400)
    sendSuccess(res, await profitAllocationService.buildCategoryProfitTable(req.tenantId!, branchId, date))
  } catch (e) { next(e) }
})

router.get('/funds', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = effectiveBranchId(req)
    if (!branchId) throw new AppError('branchId is required', 400)
    sendSuccess(res, await profitAllocationService.listFunds(req.tenantId!, branchId))
  } catch (e) { next(e) }
})

router.post('/funds', authorize('OWNER', 'MANAGER'), validate(createFundSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await profitAllocationService.createFund(req.tenantId!, req.body), 'Fund created', 201)
  } catch (e) { next(e) }
})

router.put('/funds/:id', authorize('OWNER', 'MANAGER'), validate(updateFundSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await profitAllocationService.updateFund(req.tenantId!, req.params.id, req.body), 'Fund updated')
  } catch (e) { next(e) }
})

router.delete('/funds/:id', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await profitAllocationService.deleteFund(req.tenantId!, req.params.id)
    const msg = (result as { message?: string }).message ?? 'Fund removed'
    sendSuccess(res, result, msg)
  } catch (e) { next(e) }
})

router.patch('/funds/:id/toggle', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isActive = Boolean(req.body.isActive)
    sendSuccess(res, await profitAllocationService.toggleFund(req.tenantId!, req.params.id, isActive))
  } catch (e) { next(e) }
})

router.post('/funds/normalize-percentages', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = await resolveMutationBranchId(req, { preferred: req.body?.branchId })
    sendSuccess(
      res,
      await profitAllocationService.normalizeFundPercentages(req.tenantId!, branchId),
      'Percentage funds normalized to 100%',
    )
  } catch (e) { next(e) }
})

router.get('/transactions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = getPagination(req)
    const branchId = effectiveBranchId(req)
    const fundId = req.query.fundId as string | undefined
    const from = req.query.from as string | undefined
    const to = req.query.to as string | undefined
    const result = await profitAllocationService.listTransactions(req.tenantId!, {
      branchId,
      fundId,
      from,
      to,
      page,
      limit,
    })
    sendPaginated(res, result.data, result.total, page, limit)
  } catch (e) { next(e) }
})

router.post('/withdraw', authorize('OWNER', 'MANAGER'), validate(fundMovementSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fundId, amount, notes, date } = req.body
    const branchId = await resolveMutationBranchId(req, { preferred: req.body.branchId })
    sendSuccess(
      res,
      await profitAllocationService.withdrawFromFund(
        req.tenantId!, branchId, fundId, amount,
        req.user!.userId, req.user!.email, notes, date,
      ),
      'Withdrawal recorded',
    )
  } catch (e) { next(e) }
})

router.post('/deposit', authorize('OWNER', 'MANAGER'), validate(fundMovementSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fundId, amount, notes, date } = req.body
    const branchId = await resolveMutationBranchId(req, { preferred: req.body.branchId })
    sendSuccess(
      res,
      await profitAllocationService.depositToFund(
        req.tenantId!, branchId, fundId, amount,
        req.user!.userId, req.user!.email, notes, date,
      ),
      'Deposit recorded',
    )
  } catch (e) { next(e) }
})

router.post('/adjustment', authorize('OWNER', 'MANAGER'), validate(adjustmentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fundId, amount, notes, date } = req.body
    const branchId = await resolveMutationBranchId(req, { preferred: req.body.branchId })
    sendSuccess(
      res,
      await profitAllocationService.adjustFund(
        req.tenantId!, branchId, fundId, amount,
        req.user!.userId, req.user!.email, notes, date,
      ),
      'Adjustment recorded',
    )
  } catch (e) { next(e) }
})

router.get('/period-summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = effectiveBranchId(req)
    const from = req.query.from as string
    const to = req.query.to as string
    if (!branchId || !from || !to) throw new AppError('branchId, from and to are required', 400)
    sendSuccess(res, await profitAllocationService.getPeriodSummary(req.tenantId!, branchId, from, to))
  } catch (e) { next(e) }
})

router.get('/monthly-summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = effectiveBranchId(req)
    const month = req.query.month as string
    const from = req.query.from as string | undefined
    const to = req.query.to as string | undefined
    if (!branchId) throw new AppError('branchId is required', 400)
    if (from && to) {
      sendSuccess(res, await profitAllocationService.getPeriodSummary(req.tenantId!, branchId, from, to))
      return
    }
    if (!month) throw new AppError('month (YYYY-MM) or from/to range is required', 400)
    sendSuccess(res, await profitAllocationService.getMonthlySummary(req.tenantId!, branchId, month))
  } catch (e) { next(e) }
})

export default router
