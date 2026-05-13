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
    const type     = req.query.type     as string | undefined
    const branchId = req.query.branchId as string | undefined
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
  try { sendSuccess(res, await prisma.transaction.create({ data: { ...req.body, tenantId: req.tenantId!, performedBy: req.user!.email } }), 'Transaction recorded', 201) } catch (e) { next(e) }
})

router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const branchId = req.query.branchId as string | undefined
    const from = req.query.from ? new Date(req.query.from as string) : new Date(new Date().setDate(1))
    const to   = req.query.to   ? new Date(req.query.to   as string) : new Date()
    to.setHours(23, 59, 59, 999)

    const txWhere: any = { tenantId, ...(branchId && { branchId }), createdAt: { gte: from, lte: to } }
    const saleWhere: any = { tenantId, ...(branchId && { branchId }), createdAt: { gte: from, lte: to } }

    const [txIncome, txExpense, salesAgg, cogsRaw] = await Promise.all([
      // Manual income transactions (repair fees, other income)
      prisma.transaction.aggregate({ where: { ...txWhere, type: 'INCOME'  }, _sum: { amount: true } }),
      // Operating expense transactions (rent, salary, utilities, etc.)
      prisma.transaction.aggregate({ where: { ...txWhere, type: 'EXPENSE' }, _sum: { amount: true } }),
      // POS sales revenue
      prisma.sale.aggregate({ where: saleWhere, _sum: { total: true }, _count: true }),
      // COGS: qty sold × current buying price
      branchId
        ? prisma.$queryRaw<Array<{ cogs: number }>>`
            SELECT COALESCE(SUM(si.quantity::float * p."buyingPrice"), 0)::float AS cogs
            FROM   "SaleItem" si
            JOIN   "Sale"    s ON s.id = si."saleId"
            JOIN   "Product" p ON p.id = si."productId"
            WHERE  s."tenantId" = ${tenantId}
              AND  s."branchId" = ${branchId}
              AND  s."createdAt" >= ${from}
              AND  s."createdAt" <= ${to}
          `
        : prisma.$queryRaw<Array<{ cogs: number }>>`
            SELECT COALESCE(SUM(si.quantity::float * p."buyingPrice"), 0)::float AS cogs
            FROM   "SaleItem" si
            JOIN   "Sale"    s ON s.id = si."saleId"
            JOIN   "Product" p ON p.id = si."productId"
            WHERE  s."tenantId" = ${tenantId}
              AND  s."createdAt" >= ${from}
              AND  s."createdAt" <= ${to}
          `,
    ])

    const salesRevenue  = salesAgg._sum.total    ?? 0
    const salesCount    = salesAgg._count
    const cogs          = Number((cogsRaw as any[])[0]?.cogs ?? 0)
    const otherIncome   = txIncome._sum.amount   ?? 0
    const opExpenses    = txExpense._sum.amount  ?? 0

    const totalRevenue  = salesRevenue + otherIncome
    const totalExpense  = cogs + opExpenses
    const grossProfit   = salesRevenue - cogs
    const netProfit     = totalRevenue - totalExpense

    sendSuccess(res, {
      salesRevenue,
      salesCount,
      otherIncome,
      totalIncome:  totalRevenue,
      cogs,
      opExpenses,
      totalExpense,
      grossProfit,
      profit:       netProfit,
      period: { from, to },
    })
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
