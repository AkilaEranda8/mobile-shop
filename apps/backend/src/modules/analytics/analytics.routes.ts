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
    const in30Days = new Date(); in30Days.setDate(in30Days.getDate() + 30)

    const [todaySales, activeRepairs, totalCustomers, lowStockProducts, totalRevenue, expiringWarranties, readyForPickup] = await Promise.all([
      prisma.sale.aggregate({ where: { tenantId, ...branchFilter, createdAt: { gte: today, lte: todayEnd } }, _sum: { total: true }, _count: true }),
      prisma.repairTicket.count({ where: { tenantId, ...branchFilter, status: { notIn: ['DELIVERED', 'CANCELLED'] } } }),
      prisma.customer.count({ where: { tenantId } }),
      prisma.product.findMany({ where: { tenantId, isActive: true, stock: { lte: 5 } }, select: { id: true, name: true, stock: true, minStock: true }, orderBy: { stock: 'asc' }, take: 5 }),
      prisma.sale.aggregate({ where: { tenantId, ...branchFilter }, _sum: { total: true } }),
      prisma.warranty.count({ where: { tenantId, endDate: { lte: in30Days }, status: 'ACTIVE' } }),
      prisma.repairTicket.count({ where: { tenantId, ...branchFilter, status: 'READY' } }),
    ])

    sendSuccess(res, {
      todayRevenue:    todaySales._sum.total ?? 0,
      todaySalesCount: todaySales._count,
      activeRepairs,
      totalCustomers,
      lowStockCount:    lowStockProducts.length,
      lowStockProducts,
      totalRevenue:    totalRevenue._sum.total ?? 0,
      expiringWarranties,
      readyForPickup,
    })
  } catch (e) { next(e) }
})

router.get('/revenue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const days = parseInt(req.query.days as string) || 30
    const from = new Date(); from.setDate(from.getDate() - days); from.setHours(0, 0, 0, 0)

    // 1. POS sales revenue per day
    const salesRaw: Array<{ date: Date; total: number }> = await prisma.$queryRaw`
      SELECT DATE_TRUNC('day', "createdAt" AT TIME ZONE 'UTC') AS date,
             COALESCE(SUM(total), 0)::float                    AS total
      FROM   "Sale"
      WHERE  "tenantId" = ${tenantId}
        AND  "createdAt" >= ${from}
      GROUP  BY 1
      ORDER  BY 1 ASC
    `

    // 2. COGS per day (qty sold × buying price at product level)
    const cogsRaw: Array<{ date: Date; cogs: number }> = await prisma.$queryRaw`
      SELECT DATE_TRUNC('day', s."createdAt" AT TIME ZONE 'UTC') AS date,
             COALESCE(SUM(si.quantity::float * p."buyingPrice"), 0)::float AS cogs
      FROM   "SaleItem" si
      JOIN   "Sale"    s ON s.id = si."saleId"
      JOIN   "Product" p ON p.id = si."productId"
      WHERE  s."tenantId" = ${tenantId}
        AND  s."createdAt" >= ${from}
      GROUP  BY 1
      ORDER  BY 1 ASC
    `

    // 3. Operating expenses per day (Transaction.EXPENSE)
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

    // 4. Other income per day (Transaction.INCOME — repair fees, service charges, etc.)
    const incomeRaw: Array<{ date: Date; total: number }> = await prisma.$queryRaw`
      SELECT DATE_TRUNC('day', "createdAt" AT TIME ZONE 'UTC') AS date,
             COALESCE(SUM(amount), 0)::float                   AS total
      FROM   "Transaction"
      WHERE  "tenantId" = ${tenantId}
        AND  type = 'INCOME'
        AND  "createdAt" >= ${from}
      GROUP  BY 1
      ORDER  BY 1 ASC
    `

    // Merge all into date-keyed map
    type DayData = { salesRevenue: number; cogs: number; opExpenses: number; otherIncome: number }
    const map: Record<string, DayData> = {}
    const ensure = (key: string) => { if (!map[key]) map[key] = { salesRevenue: 0, cogs: 0, opExpenses: 0, otherIncome: 0 } }

    salesRaw.forEach  ((r) => { const k = new Date(r.date).toISOString().split('T')[0]; ensure(k); map[k].salesRevenue = Number(r.total) })
    cogsRaw.forEach   ((r) => { const k = new Date(r.date).toISOString().split('T')[0]; ensure(k); map[k].cogs        = Number(r.cogs)  })
    expensesRaw.forEach((r) => { const k = new Date(r.date).toISOString().split('T')[0]; ensure(k); map[k].opExpenses  = Number(r.total) })
    incomeRaw.forEach ((r) => { const k = new Date(r.date).toISOString().split('T')[0]; ensure(k); map[k].otherIncome = Number(r.total) })

    const result = Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        totalRevenue:  v.salesRevenue + v.otherIncome,
        salesRevenue:  v.salesRevenue,
        otherIncome:   v.otherIncome,
        cogs:          v.cogs,
        totalExpenses: v.opExpenses,
        grossProfit:   v.salesRevenue - v.cogs,
        profit:        (v.salesRevenue + v.otherIncome) - v.cogs - v.opExpenses,
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
