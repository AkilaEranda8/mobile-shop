import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/database'
import { sendSuccess } from '../../utils/response'
import { authenticate } from '../../middleware/auth.middleware'

const router = Router()
router.use(authenticate)

router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const branchId = req.query.branchId as string | undefined
    const branchFilter = branchId ? { branchId } : {}
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999)
    const [todaySales, activeRepairs, totalCustomers, lowStockCount, totalRevenue] = await Promise.all([
      prisma.sale.aggregate({ where: { tenantId, ...branchFilter, createdAt: { gte: today, lte: todayEnd } }, _sum: { total: true }, _count: true }),
      prisma.repairTicket.count({ where: { tenantId, ...branchFilter, status: { notIn: ['DELIVERED', 'CANCELLED'] } } }),
      prisma.customer.count({ where: { tenantId } }),
      prisma.product.count({ where: { tenantId, isActive: true, stock: { lte: 5 } } }),
      prisma.sale.aggregate({ where: { tenantId, ...branchFilter }, _sum: { total: true } }),
    ])
    sendSuccess(res, { todayRevenue: todaySales._sum.total ?? 0, todaySalesCount: todaySales._count, activeRepairs, totalCustomers, lowStockCount, totalRevenue: totalRevenue._sum.total ?? 0 })
  } catch (e) { next(e) }
})

router.get('/revenue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const days = parseInt(req.query.days as string) || 30
    const from = new Date(); from.setDate(from.getDate() - days); from.setHours(0, 0, 0, 0)

    // Group sales by calendar date directly
    const salesRaw: Array<{ date: Date; total: number }> = await prisma.$queryRaw`
      SELECT DATE_TRUNC('day', "createdAt" AT TIME ZONE 'UTC') AS date,
             COALESCE(SUM(total), 0)::float                    AS total
      FROM   "Sale"
      WHERE  "tenantId" = ${tenantId}
        AND  "createdAt" >= ${from}
      GROUP  BY 1
      ORDER  BY 1 ASC
    `

    // Group EXPENSE transactions by calendar date
    const expensesRaw: Array<{ date: Date; total: number }> = await prisma.$queryRaw`
      SELECT DATE_TRUNC('day', "createdAt" AT TIME ZONE 'UTC') AS date,
             COALESCE(SUM(amount), 0)::float                   AS total
      FROM   "Transaction"
      WHERE  "tenantId" = ${tenantId}
        AND  type = 'EXPENSE'
        AND  "createdAt" >= ${from}
      GROUP  BY 1
      ORDER  BY 1 ASC
    `

    // Build a map of date → { revenue, expenses }
    const map: Record<string, { totalRevenue: number; totalExpenses: number }> = {}
    salesRaw.forEach((r) => {
      const key = new Date(r.date).toISOString().split('T')[0]
      map[key] = { totalRevenue: Number(r.total), totalExpenses: 0 }
    })
    expensesRaw.forEach((r) => {
      const key = new Date(r.date).toISOString().split('T')[0]
      if (!map[key]) map[key] = { totalRevenue: 0, totalExpenses: 0 }
      map[key].totalExpenses = Number(r.total)
    })

    const result = Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        totalRevenue:  v.totalRevenue,
        totalExpenses: v.totalExpenses,
        profit:        v.totalRevenue - v.totalExpenses,
      }))

    sendSuccess(res, result)
  } catch (e) { next(e) }
})

router.get('/top-products', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const limit = parseInt(req.query.limit as string) || 10
    const items = await prisma.saleItem.groupBy({
      by: ['productId', 'productName'],
      where: { sale: { tenantId } },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: limit,
    })
    sendSuccess(res, items.map((i: (typeof items)[number]) => ({ productId: i.productId, productName: i.productName, quantitySold: i._sum.quantity ?? 0, revenue: i._sum.total ?? 0 })))
  } catch (e) { next(e) }
})

router.get('/repairs-by-status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const counts = await prisma.repairTicket.groupBy({ by: ['status'], where: { tenantId: req.tenantId! }, _count: true })
    sendSuccess(res, counts.map((c: any) => ({ status: c.status, count: typeof c._count === 'object' ? (c._count._all ?? 0) : (c._count ?? 0) })))
  } catch (e) { next(e) }
})

export default router
