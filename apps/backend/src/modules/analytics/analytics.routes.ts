import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/database'
import { Prisma } from '@prisma/client'
import { sendSuccess } from '../../utils/response'
import { authenticate } from '../../middleware/auth.middleware'
import { businessDayRange, businessDateFromInstant, resolveQueryDateRange } from '../../utils/date-range'
import { getDailyRevenueBreakdown, getPeriodFinancials } from '../finance/business-financials.service'

const router = Router()
router.use(authenticate)

async function tenantHasServices(tenantId: string): Promise<boolean> {
  const row = await prisma.tenantFeature.findFirst({
    where: { tenantId, feature: 'SERVICES', enabled: true },
  })
  return !!row
}

function serviceCategoryExpr() {
  return Prisma.sql`COALESCE(sv.category, 'Services')`
}

function saleItemCategoryExpr(includeServices: boolean) {
  return Prisma.sql`COALESCE(
    CASE WHEN si."productId" IS NOT NULL THEN c.name END,
    ${includeServices ? Prisma.sql`CASE WHEN si."productId" IS NULL THEN ${serviceCategoryExpr()} END,` : Prisma.empty}
    'Uncategorised'
  )`
}

function saleItemCogsExpr() {
  return Prisma.sql`CASE
    WHEN si."productId" IS NOT NULL THEN si.quantity * COALESCE(p."buyingPrice", 0)
    ELSE si.quantity * COALESCE(sv.cost, 0)
  END`
}

router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const branchId = req.query.branchId as string | undefined
    const branchFilter = branchId ? { branchId } : {}
    const todayKey = businessDateFromInstant()
    const in30End = businessDayRange(resolveQueryDateRange({ days: 30 }).toKey).end

    const todayFin = await getPeriodFinancials(tenantId, todayKey, todayKey, branchId)

    const [activeRepairs, totalCustomers, lowStockProducts, posRevenue, otherRevenue, expiringWarranties, readyForPickup, totalSalesCount] = await Promise.all([
      prisma.repairTicket.count({ where: { tenantId, ...branchFilter, status: { notIn: ['DELIVERED', 'CANCELLED'] } } }),
      prisma.customer.count({ where: { tenantId } }),
      // Low stock: compare stock against each product's own minStock (not a hardcoded value)
      prisma.$queryRaw<Array<{ id: string; name: string; stock: number; minStock: number }>>`
        SELECT id, name, stock, "minStock"
        FROM   "Product"
        WHERE  "tenantId" = ${tenantId}
          AND  "isActive" = true
          AND  stock < "minStock"
        ORDER  BY stock ASC
        LIMIT  5
      `,
      prisma.sale.aggregate({ where: { tenantId, ...branchFilter, status: { not: 'RETURNED' } }, _sum: { total: true } }),
      // Other income (repairs, manual entries) — exclude 'Sales' category (already in posRevenue)
      prisma.transaction.aggregate({ where: { tenantId, ...branchFilter, type: 'INCOME', category: { not: 'Sales' } }, _sum: { amount: true } }),
      prisma.warranty.count({ where: { tenantId, endDate: { lte: in30End }, status: 'ACTIVE' } }),
      prisma.repairTicket.count({ where: { tenantId, ...branchFilter, status: 'READY' } }),
      prisma.sale.count({ where: { tenantId, ...branchFilter, status: { not: 'RETURNED' } } }),
    ])

    const totalRevenue = (posRevenue._sum.total ?? 0) + (otherRevenue._sum.amount ?? 0)
    sendSuccess(res, {
      todayRevenue:    todayFin.grossSales + todayFin.reloadCommission,
      todaySalesCount: todayFin.salesCount,
      totalSalesCount,
      activeRepairs,
      totalCustomers,
      lowStockCount:    (lowStockProducts as any[]).length,
      lowStockProducts,
      totalRevenue,
      expiringWarranties,
      readyForPickup,
    })
  } catch (e) { next(e) }
})

router.get('/revenue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const branchId = req.query.branchId as string | undefined
    const days = parseInt(req.query.days as string) || 30
    const { fromKey, toKey } = resolveQueryDateRange({
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      days: req.query.from || req.query.to ? undefined : days,
    })

    const result = await getDailyRevenueBreakdown(tenantId, fromKey, toKey, branchId)
    sendSuccess(res, result)
  } catch (e) { next(e) }
})

router.get('/top-products', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const limit = parseInt(req.query.limit as string) || 10
    const branchId = req.query.branchId as string | undefined
    let dateFilter = {}
    if (req.query.from || req.query.to) {
      const { start, end } = resolveQueryDateRange({
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        days: 30,
      })
      dateFilter = { createdAt: { gte: start, lte: end } }
    }
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
    const { start: from } = resolveQueryDateRange({ days })

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

router.get('/category-products', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const category = (req.query.category as string) ?? ''
    const branchId = req.query.branchId as string | undefined
    const includeServices = await tenantHasServices(tenantId)
    const { start: from, end: to } = resolveQueryDateRange({
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      days: parseInt(req.query.days as string) || 30,
    })

    const branchClause = branchId ? Prisma.sql`AND s."branchId" = ${branchId}` : Prisma.empty
    const categoryClause = category
      ? Prisma.sql`AND (
          (si."productId" IS NOT NULL AND COALESCE(c.name, 'Uncategorised') = ${category})
          OR (si."productId" IS NULL AND ${serviceCategoryExpr()} = ${category})
        )`
      : Prisma.empty
    const itemTypeClause = includeServices
      ? Prisma.empty
      : Prisma.sql`AND si."productId" IS NOT NULL`

    const rows: Array<{
      product: string; sku: string
      revenue: number; cogs: number; profit: number
      units_sold: number; transactions: number
    }> = await prisma.$queryRaw`
      SELECT
        si."productName"                                           AS product,
        CASE
          WHEN si."productId" IS NOT NULL THEN COALESCE(p.sku, '')
          ELSE COALESCE(sv.category, si.sku, 'Service')
        END                                                        AS sku,
        COALESCE(SUM(si.total), 0)::float                          AS revenue,
        COALESCE(SUM(${saleItemCogsExpr()}), 0)::float              AS cogs,
        COALESCE(SUM(si.total - ${saleItemCogsExpr()}), 0)::float   AS profit,
        COALESCE(SUM(si.quantity), 0)::float                       AS units_sold,
        COUNT(DISTINCT si."saleId")::int                           AS transactions
      FROM   "SaleItem"  si
      JOIN   "Sale"      s ON s.id = si."saleId"
      LEFT   JOIN "Product"   p ON p.id = si."productId"
      LEFT   JOIN "Category"  c ON c.id = p."categoryId"
      LEFT   JOIN "Service"   sv ON sv."tenantId" = s."tenantId"
        AND sv.name = si."productName"
        AND si."productId" IS NULL
      WHERE  s."tenantId" = ${tenantId}
        AND  s.status != 'RETURNED'
        AND  s."createdAt" >= ${from}
        AND  s."createdAt" <= ${to}
        ${itemTypeClause}
        ${branchClause}
        ${categoryClause}
      GROUP  BY si."productName",
        CASE
          WHEN si."productId" IS NOT NULL THEN COALESCE(p.sku, '')
          ELSE COALESCE(sv.category, si.sku, 'Service')
        END
      ORDER  BY revenue DESC
    `

    const totalRevenue = rows.reduce((s, r) => s + Number(r.revenue), 0)

    sendSuccess(res, rows.map(r => ({
      product:      r.product,
      sku:          r.sku,
      revenue:      Number(r.revenue),
      cogs:         Number(r.cogs),
      profit:       Number(r.profit),
      margin:       Number(r.revenue) > 0 ? Math.round((Number(r.profit) / Number(r.revenue)) * 100) : 0,
      unitsSold:    Number(r.units_sold),
      transactions: Number(r.transactions),
      share:        totalRevenue > 0 ? Math.round((Number(r.revenue) / totalRevenue) * 100) : 0,
    })))
  } catch (e) { next(e) }
})

router.get('/category-sales', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const branchId = req.query.branchId as string | undefined
    const includeServices = await tenantHasServices(tenantId)
    const { start: from, end: to } = resolveQueryDateRange({
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      days: parseInt(req.query.days as string) || 30,
    })

    const branchClause = branchId ? Prisma.sql`AND s."branchId" = ${branchId}` : Prisma.empty
    const itemTypeClause = includeServices
      ? Prisma.empty
      : Prisma.sql`AND si."productId" IS NOT NULL`
    const categoryExpr = saleItemCategoryExpr(includeServices)

    const rows: Array<{
      category: string
      revenue: number
      cogs: number
      profit: number
      units_sold: number
      transactions: number
    }> = await prisma.$queryRaw`
      SELECT
        ${categoryExpr}                                            AS category,
        COALESCE(SUM(si.total), 0)::float                          AS revenue,
        COALESCE(SUM(${saleItemCogsExpr()}), 0)::float              AS cogs,
        COALESCE(SUM(si.total - ${saleItemCogsExpr()}), 0)::float   AS profit,
        COALESCE(SUM(si.quantity), 0)::float                         AS units_sold,
        COUNT(DISTINCT si."saleId")::int                           AS transactions
      FROM   "SaleItem"  si
      JOIN   "Sale"      s ON s.id = si."saleId"
      LEFT   JOIN "Product"   p ON p.id = si."productId"
      LEFT   JOIN "Category"  c ON c.id = p."categoryId"
      LEFT   JOIN "Service"   sv ON sv."tenantId" = s."tenantId"
        AND sv.name = si."productName"
        AND si."productId" IS NULL
      WHERE  s."tenantId" = ${tenantId}
        AND  s.status != 'RETURNED'
        AND  s."createdAt" >= ${from}
        AND  s."createdAt" <= ${to}
        ${itemTypeClause}
        ${branchClause}
      GROUP  BY 1
      ORDER  BY revenue DESC
    `

    const totalRevenue = rows.reduce((s, r) => s + Number(r.revenue), 0)
    const totalCogs    = rows.reduce((s, r) => s + Number(r.cogs),    0)
    const totalProfit  = rows.reduce((s, r) => s + Number(r.profit),  0)
    const totalUnits   = rows.reduce((s, r) => s + Number(r.units_sold), 0)

    const categories = rows.map(r => ({
      category:     r.category,
      revenue:      Number(r.revenue),
      cogs:         Number(r.cogs),
      profit:       Number(r.profit),
      margin:       Number(r.revenue) > 0 ? Math.round((Number(r.profit) / Number(r.revenue)) * 100) : 0,
      unitsSold:    Number(r.units_sold),
      transactions: Number(r.transactions),
      share:        totalRevenue > 0 ? Math.round((Number(r.revenue) / totalRevenue) * 100) : 0,
    }))

    sendSuccess(res, {
      categories,
      totals: {
        revenue: Math.round(totalRevenue * 100) / 100,
        cogs:    Math.round(totalCogs    * 100) / 100,
        profit:  Math.round(totalProfit  * 100) / 100,
        margin:  totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0,
        units:   Math.round(totalUnits),
      },
    })
  } catch (e) { next(e) }
})

export default router
