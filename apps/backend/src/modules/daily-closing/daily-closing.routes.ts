import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/database'
import { sendSuccess } from '../../utils/response'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { AppError } from '../../middleware/error.middleware'
import {
  buildDailyClosingPreview,
  saveDailyClosingDraft,
  closeBusinessDay,
  reopenBusinessDay,
  getDayStartStatus,
  startBusinessDay,
  saveOpeningCash,
} from './daily-closing.service'
import { normalizeBusinessDate, businessDateDb } from '../../utils/date-range'
import { isTenantFeatureEnabled } from '../../utils/tenant-feature.util'
import { saveAllocation } from '../profit-allocation/profit-allocation.service'
import { effectiveBranchId } from '../../utils/active-branch'

function resolveBusinessDate(input?: string): string {
  return normalizeBusinessDate(input)
}

const router = Router()
router.use(authenticate)

async function requireDailyClosingFeature(req: Request, _res: Response, next: NextFunction) {
  try {
    const feat = await prisma.tenantFeature.findFirst({
      where: { tenantId: req.tenantId!, feature: 'DAILY_CLOSING', enabled: true },
    })
    if (!feat) throw new AppError('Daily Closing is not enabled. Enable it in Settings → Shop Features.', 403)
    next()
  } catch (e) { next(e) }
}
router.use(requireDailyClosingFeature)

router.get('/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const branchId = effectiveBranchId(req)
    const date = resolveBusinessDate(req.query.date as string | undefined)
    if (!branchId) throw new AppError('branchId is required', 400)
    sendSuccess(res, await buildDailyClosingPreview(tenantId, branchId, date))
  } catch (e) { next(e) }
})

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const branchId = effectiveBranchId(req)
    const from = req.query.from as string | undefined
    const to = req.query.to as string | undefined
    const where: any = { tenantId, ...(branchId && { branchId }) }
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from + 'T00:00:00.000Z')
      if (to) where.date.lte = new Date(to + 'T00:00:00.000Z')
    }
    const rows = await prisma.dailyClosing.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 60,
      include: { cashCount: true, branch: { select: { name: true } } },
    })
    sendSuccess(res, rows)
  } catch (e) { next(e) }
})

router.get('/day-start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = effectiveBranchId(req)
    const date = resolveBusinessDate(req.query.date as string | undefined)
    if (!branchId) throw new AppError('branchId is required', 400)
    sendSuccess(res, await getDayStartStatus(req.tenantId!, branchId, date))
  } catch (e) { next(e) }
})

router.post('/opening-cash', authorize('OWNER', 'MANAGER', 'CASHIER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branchId, date, openingCash } = req.body
    if (!branchId || !date) throw new AppError('branchId and date are required', 400)
    if (openingCash == null || Number.isNaN(Number(openingCash))) throw new AppError('openingCash is required', 400)
    sendSuccess(
      res,
      await saveOpeningCash(req.tenantId!, branchId, resolveBusinessDate(date), Number(openingCash)),
      'Opening cash saved',
    )
  } catch (e) { next(e) }
})

router.post('/day-start', authorize('OWNER', 'MANAGER', 'CASHIER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branchId, date, openingCash } = req.body
    if (!branchId || !date) throw new AppError('branchId and date are required', 400)
    if (openingCash == null || Number.isNaN(Number(openingCash))) throw new AppError('openingCash is required', 400)
    const user = req.user!
    sendSuccess(
      res,
      await startBusinessDay(
        req.tenantId!,
        branchId,
        resolveBusinessDate(date),
        Number(openingCash),
        user.userId,
        user.email,
      ),
      'Day started',
    )
  } catch (e) { next(e) }
})

router.post('/draft', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branchId, date, openingCash, cashCount, notes } = req.body
    if (!branchId || !date) throw new AppError('branchId and date are required', 400)
    const dateKey = resolveBusinessDate(date)
    sendSuccess(res, await saveDailyClosingDraft(req.tenantId!, branchId, dateKey, { openingCash, cashCount, notes }), 'Draft saved')
  } catch (e) { next(e) }
})

router.post('/cash-count', authorize('OWNER', 'MANAGER', 'CASHIER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branchId, date, cashCount, openingCash, notes } = req.body
    if (!branchId || !date || !cashCount) throw new AppError('branchId, date, and cashCount are required', 400)
    const dateKey = resolveBusinessDate(date)
    sendSuccess(res, await saveDailyClosingDraft(req.tenantId!, branchId, dateKey, { openingCash, cashCount, notes }), 'Cash count saved')
  } catch (e) { next(e) }
})

router.post('/close', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branchId, date, openingCash, cashCount, notes } = req.body
    if (!branchId || !date || !cashCount) throw new AppError('branchId, date, and cashCount are required', 400)
    const user = req.user!
    const dateKey = resolveBusinessDate(date)
    const preview = await closeBusinessDay(req.tenantId!, branchId, dateKey, user.userId, user.email, { openingCash, cashCount, notes })

    const profitFeat = await isTenantFeatureEnabled(req.tenantId!, 'PROFIT_ALLOCATION')
    if (profitFeat) {
      try {
        const allocDate = businessDateDb(dateKey)
        const existingAlloc = await prisma.profitAllocation.findUnique({
          where: { tenantId_branchId_date: { tenantId: req.tenantId!, branchId, date: allocDate } },
        })
        if (!existingAlloc) {
          await saveAllocation(
            req.tenantId!,
            branchId,
            dateKey,
            user.userId,
            user.email,
            'Auto-saved on day close',
          )
        }
      } catch {
        // Day close succeeds even if allocation auto-save fails
      }
    }

    sendSuccess(res, preview, 'Business day closed')
  } catch (e) { next(e) }
})

router.post('/reopen', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branchId, date } = req.body
    if (!branchId || !date) throw new AppError('branchId and date are required', 400)
    sendSuccess(res, await reopenBusinessDay(req.tenantId!, branchId, resolveBusinessDate(date)), 'Day reopened')
  } catch (e) { next(e) }
})

export default router
