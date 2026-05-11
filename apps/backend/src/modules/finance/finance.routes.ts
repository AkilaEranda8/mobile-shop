import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/database'
import { sendSuccess, sendPaginated } from '../../utils/response'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { getPagination } from '../../utils/pagination'

const router = Router()
router.use(authenticate)

router.get('/transactions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, limit, page } = getPagination(req)
    const type = req.query.type as string | undefined
    const branchId = req.query.branchId as string | undefined
    const where: any = { tenantId: req.tenantId!, ...(type && { type }), ...(branchId && { branchId }) }
    const [data, total] = await Promise.all([prisma.transaction.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }), prisma.transaction.count({ where })])
    sendPaginated(res, data, total, page, limit)
  } catch (e) { next(e) }
})

router.post('/transactions', authorize('OWNER', 'MANAGER', 'CASHIER'), async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await prisma.transaction.create({ data: { ...req.body, tenantId: req.tenantId!, performedBy: req.user!.email } }), 'Transaction recorded', 201) } catch (e) { next(e) }
})

router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = req.query.branchId as string | undefined
    const from = req.query.from ? new Date(req.query.from as string) : new Date(new Date().setDate(1))
    const to = req.query.to ? new Date(req.query.to as string) : new Date()
    const where: any = { tenantId: req.tenantId!, ...(branchId && { branchId }), createdAt: { gte: from, lte: to } }
    const [income, expense] = await Promise.all([
      prisma.transaction.aggregate({ where: { ...where, type: 'INCOME' }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { ...where, type: 'EXPENSE' }, _sum: { amount: true } }),
    ])
    const totalIncome = income._sum.amount ?? 0
    const totalExpense = expense._sum.amount ?? 0
    sendSuccess(res, { totalIncome, totalExpense, profit: totalIncome - totalExpense, period: { from, to } })
  } catch (e) { next(e) }
})

router.get('/daily-summaries', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, limit, page } = getPagination(req)
    const branchId = req.query.branchId as string | undefined
    const where: any = { tenantId: req.tenantId!, ...(branchId && { branchId }) }
    const [data, total] = await Promise.all([prisma.dailySummary.findMany({ where, skip, take: limit, orderBy: { date: 'desc' } }), prisma.dailySummary.count({ where })])
    sendPaginated(res, data, total, page, limit)
  } catch (e) { next(e) }
})

export default router
