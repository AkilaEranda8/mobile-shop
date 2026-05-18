import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/database'
import { Prisma } from '@prisma/client'
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
      prisma.sale.aggregate({ where: { tenantId, ...branchFilter, status: { not: 'RETURNED' }, createdAt: { gte: today, lte: todayEnd } }, _sum: { total: true }, _count: true }),
      prisma.repairTicket.count({ where: { tenantId, ...branchFilter, status: { notIn: ['DELIVERED', 'CANCELLED'] } } }),
      prisma.customer.count({ where: { tenantId } }),
      prisma.product.findMany({ where: { tenantId, isActive: true, stock: { lte: 5 } }, select: { id: true, name: true, stock: true, minStock: true }, orderBy: { stock: 'asc' }, take: 5 }),
      prisma.sale.aggregate({ where: { tenantId, ...branchFilter, status: { not: 'RETURNED' } }, _sum: { total: true } }),
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
    const branchId = req.query.branchId as string | undefined
    let from: Date
    let to = new Date(); to.setHours(23, 59, 59, 999)
    if (req.query.from) {
      from = new Date(req.query.from as string); from.setHours(0, 0, 0, 0)
      if (req.query.to) { to = new Date(req.query.to as string); to.setHours(23, 59, 59, 999) }
    } else {
      const days = parseInt(req.query.days as string) || 30
      from = new Date(); from.setDate(from.getDate() - days); from.setHours(0, 0, 0, 0)
    }
    const saleBranch = branchId ? Prisma.sql`AND "branchId" = ${branchId}` : Prisma.empty
    const sBranch    = branchId ? Prisma.sql`AND s."branchId" = ${branchId}` : Prisma.empty
    const txBranch   = branchId ? Prisma.sql`AND "branchId" = ${branchId}` : Prisma.empty

    // 1. POS sales revenue per day (exclude returned orders)
    const salesRaw: Array<{ date: Date; total: number }> = await prisma.$queryRaw`
      SELECT DATE_TRUNC('day', "createdAt" AT TIME ZONE 'UTC') AS date,
             COALESCE(SUM(total), 0)::float                    AS total
      FROM   "Sale"
      WHERE  "tenantId" = ${tenantId}
        ${saleBranch}
        AND  "createdAt" >= ${from}
        AND  "createdAt" <= ${to}
        AND  status != 'RETURNED'
      GROUP  BY 1
      ORDER  BY 1 ASC
    `

    // 2. COGS per day (exclude returned orders)
    const cogsRaw: Array<{ date: Date; cogs: number }> = await prisma.$queryRaw`
      SELECT DATE_TRUNC('day', s."createdAt" AT TIME ZONE 'UTC') AS date,
             COALESCE(SUM(si.quantity::float * p."buyingPrice"), 0)::float AS cogs
      FROM   "SaleItem" si
      JOIN   "Sale"    s ON s.id = si."saleId"
      JOIN   "Product" p ON p.id = si."productId"
      WHERE  s."tenantId" = ${tenantId}
        ${sBranch}
        AND  s."createdAt" >= ${from}
        AND  s."createdAt" <= ${to}
        AND  s.status != 'RETURNED'
      GROUP  BY 1
      ORDER  BY 1 ASC
    `

    // 3. Operating expenses per day (exclude Refund category)
    const expensesRaw: Array<{ date: Date; total: number }> = await prisma.$queryRaw`
      SELECT DATE_TRUNC('day', "createdAt" AT TIME ZONE 'UTC') AS date,
             COALESCE(SUM(amount), 0)::float                   AS total
      FROM   "Transaction"
      WHERE  "tenantId" = ${tenantId}
        ${txBranch}
        AND  type = 'EXPENSE'
        AND  category != 'Refund'
        AND  "createdAt" >= ${from}
        AND  "createdAt" <= ${to}
      GROUP  BY 1
      ORDER  BY 1 ASC
    `

    // 4. Other income per day (Transaction.INCOME)
    const incomeRaw: Array<{ date: Date; total: number }> = await prisma.$queryRaw`
      SELECT DATE_TRUNC('day', "createdAt" AT TIME ZONE 'UTC') AS date,
             COALESCE(SUM(amount), 0)::float                   AS total
      FROM   "Transaction"
      WHERE  "tenantId" = ${tenantId}
        ${txBranch}
        AND  type = 'INCOME'
        AND  "createdAt" >= ${from}
        AND  "createdAt" <= ${to}
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
    const fromDate = req.query.from ? new Date(req.query.from as string) : undefined
    const toDate   = req.query.to   ? (() => { const d = new Date(req.query.to as string); d.setHours(23,59,59,999); return d })() : undefined
    const dateFilter = fromDate ? { createdAt: { gte: fromDate, ...(toDate ? { lte: toDate } : {}) } } : {}
    const branchId = req.query.branchId as string | undefined
    const items = await prisma.saleItem.groupBy({
      by: ['productId', 'productName'],
      where: { sale: { tenantId, status: { not: 'RETURNED' }, ...(branchId && { branchId }), ...dateFilter } },
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

router.get('/inventory-summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const products = await prisma.product.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, stock: true, minStock: true, buyingPrice: true, sellingPrice: true, category: { select: { name: true } } },
    })

    const catMap: Record<string, { name: string; products: number; totalStock: number; stockValue: number; lowStock: number; outOfStock: number }> = {}
    let totalStockValue = 0, totalProducts = 0, totalLow = 0, totalOut = 0

    products.forEach(p => {
      const cat = (p as any).category?.name ?? 'Uncategorised'
      if (!catMap[cat]) catMap[cat] = { name: cat, products: 0, totalStock: 0, stockValue: 0, lowStock: 0, outOfStock: 0 }
      const val = p.stock * p.buyingPrice
      catMap[cat].products++; catMap[cat].totalStock += p.stock; catMap[cat].stockValue += val
      if (p.stock === 0) { catMap[cat].outOfStock++; totalOut++ }
      else if (p.stock < p.minStock) { catMap[cat].lowStock++; totalLow++ }
      totalStockValue += val; totalProducts++
    })

    sendSuccess(res, {
      totalProducts, totalStockValue, lowStockCount: totalLow, outOfStockCount: totalOut,
      byCategory: Object.values(catMap).sort((a, b) => b.stockValue - a.stockValue),
    })
  } catch (e) { next(e) }
})

router.get('/delivery-summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const days = parseInt(req.query.days as string) || 30
    const from = new Date(); from.setDate(from.getDate() - days); from.setHours(0, 0, 0, 0)

    const [byStatus, revenue, codTotal] = await Promise.all([
      prisma.deliveryOrder.groupBy({
        by: ['status'], where: { tenantId, createdAt: { gte: from } }, _count: true, _sum: { totalAmount: true },
      }),
      prisma.deliveryOrder.aggregate({
        where: { tenantId, createdAt: { gte: from } },
        _sum: { totalAmount: true, deliveryCharge: true, codAmount: true }, _count: true,
      }),
      prisma.deliveryOrder.count({ where: { tenantId, isCOD: true, createdAt: { gte: from } } }),
    ])

    sendSuccess(res, {
      totalOrders:      revenue._count,
      totalRevenue:     revenue._sum.totalAmount ?? 0,
      totalDeliveryFee: revenue._sum.deliveryCharge ?? 0,
      totalCOD:         revenue._sum.codAmount ?? 0,
      codOrders:        codTotal,
      prepaidOrders:    revenue._count - codTotal,
      byStatus: byStatus.map((s: any) => ({
        status: s.status,
        count:  typeof s._count === 'object' ? s._count._all ?? 0 : s._count ?? 0,
        revenue: s._sum?.totalAmount ?? 0,
      })),
    })
  } catch (e) { next(e) }
})

export default router
