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
} from './daily-closing.service'

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
    const branchId = req.query.branchId as string
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10)
    if (!branchId) throw new AppError('branchId is required', 400)
    sendSuccess(res, await buildDailyClosingPreview(tenantId, branchId, date))
  } catch (e) { next(e) }
})

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const branchId = req.query.branchId as string | undefined
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

router.post('/draft', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branchId, date, openingCash, cashCount, notes } = req.body
    if (!branchId || !date) throw new AppError('branchId and date are required', 400)
    sendSuccess(res, await saveDailyClosingDraft(req.tenantId!, branchId, date, { openingCash, cashCount, notes }), 'Draft saved')
  } catch (e) { next(e) }
})

router.post('/cash-count', authorize('OWNER', 'MANAGER', 'CASHIER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branchId, date, cashCount, openingCash, notes } = req.body
    if (!branchId || !date || !cashCount) throw new AppError('branchId, date, and cashCount are required', 400)
    sendSuccess(res, await saveDailyClosingDraft(req.tenantId!, branchId, date, { openingCash, cashCount, notes }), 'Cash count saved')
  } catch (e) { next(e) }
})

router.post('/close', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branchId, date, openingCash, cashCount, notes } = req.body
    if (!branchId || !date || !cashCount) throw new AppError('branchId, date, and cashCount are required', 400)
    const user = req.user!
    sendSuccess(
      res,
      await closeBusinessDay(req.tenantId!, branchId, date, user.userId, user.email, { openingCash, cashCount, notes }),
      'Business day closed',
    )
  } catch (e) { next(e) }
})

router.post('/reopen', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branchId, date } = req.body
    if (!branchId || !date) throw new AppError('branchId and date are required', 400)
    sendSuccess(res, await reopenBusinessDay(req.tenantId!, branchId, date), 'Day reopened')
  } catch (e) { next(e) }
})

export default router
