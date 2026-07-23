import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/database'
import { Prisma } from '@prisma/client'
import { sendSuccess } from '../../utils/response'
import { authenticate } from '../../middleware/auth.middleware'
import {
  enforceModuleAccessReadAny,
  requireModuleAccess,
} from '../../middleware/module-access.middleware'
import { businessDayRange, businessDateFromInstant, resolveQueryDateRange } from '../../utils/date-range'
import { getDailyRevenueBreakdown, getPeriodFinancials } from '../finance/business-financials.service'
import { effectiveBranchId } from '../../utils/active-branch'
import { isReloadSaleItem } from '../finance/reload-item.util'
import { saleItemCogsExpr } from '../../utils/sale-item-cost.util'
import {
  businessRangeWhere,
  resolveBusinessReportRange,
  resolveOptionalBusinessReportRange,
} from '../report-engine/report-engine.service'
import { saleWhereExcludeNonRevenue } from '../../constants/business-rules.constants'

const router = Router()
router.use(authenticate)

/** Home dashboard widgets may load with DASHBOARD view; full reports still need REPORTS. */
const dashOrReports = enforceModuleAccessReadAny(['DASHBOARD', 'REPORTS'], 'REPORTS')
const reportsOnly = requireModuleAccess('REPORTS', 'view')

async function tenantHasServices(tenantId: string): Promise<boolean> {
  const row = await prisma.tenantFeature.findFirst({
    where: { tenantId, feature: 'SERVICES', enabled: true },
  })
  return !!row
}

function normalizeServiceCategory(category: string | null | undefined): string {
  const trimmed = category?.trim()
  return trimmed || 'General'
}

const SERVICE_REPORT_CATEGORY = 'Service'

function isReloadSaleItemSql() {
  return Prisma.sql`(UPPER(si.sku) LIKE 'RELOAD-%' OR UPPER(si.sku) LIKE 'RCARD-%' OR LOWER(si."productName") LIKE '%reload%' OR LOWER(si."productName") LIKE '%recharge card%')`
}

function isCatalogServiceSaleItemSql() {
  return Prisma.sql`(si."productId" IS NULL AND sv.id IS NOT NULL AND NOT ${isReloadSaleItemSql()})`
}

function serviceCategoryExpr() {
  return Prisma.sql`${SERVICE_REPORT_CATEGORY}`
}

function saleItemCategoryExpr(includeServices: boolean) {
  return Prisma.sql`COALESCE(
    CASE WHEN si."productId" IS NOT NULL THEN c.name END,
    ${includeServices ? Prisma.sql`CASE WHEN ${isCatalogServiceSaleItemSql()} THEN ${serviceCategoryExpr()} END,` : Prisma.empty}
    'Uncategorised'
  )`
}

function serviceSaleItemClause(includeServices: boolean) {
  return includeServices
    ? Prisma.sql`AND (si."productId" IS NOT NULL OR ${isCatalogServiceSaleItemSql()})`
    : Prisma.sql`AND si."productId" IS NOT NULL`
}

router.get('/dashboard', requireModuleAccess('DASHBOARD', 'view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const branchId = effectiveBranchId(req)
    const branchFilter = branchId ? { branchId } : {}
    const todayKey = businessDateFromInstant()
    const in30End = businessDayRange(resolveQueryDateRange({ days: 30 }).toKey).end

    const todayFin = await getPeriodFinancials(tenantId, todayKey, todayKey, branchId)

    const [activeRepairs, totalCustomers, lowStockProducts, posRevenue, otherRevenue, expiringWarranties, readyForPickup, totalSalesCount] = await Promise.all([
      prisma.repairTicket.count({ where: { tenantId, ...branchFilter, status: { notIn: ['DELIVERED', 'CANCELLED'] } } }),
      prisma.customer.count({
        where: {
          tenantId,
          isActive: true,
          ...branchFilter,
        },
      }),
      // Low stock: compare stock against each product's own minStock (not a hardcoded value)
      prisma.$queryRaw<Array<{ id: string; name: string; stock: number; minStock: number }>>`
        SELECT id, name, stock, "minStock"
        FROM   "Product"
        WHERE  "tenantId" = ${tenantId}
          AND  "isActive" = true
          ${branchId ? Prisma.sql`AND "branchId" = ${branchId}` : Prisma.empty}
          AND  stock < "minStock"
        ORDER  BY stock ASC
        LIMIT  5
      `,
      prisma.sale.aggregate({ where: { tenantId, ...branchFilter, status: { not: 'RETURNED' }, ...saleWhereExcludeNonRevenue() }, _sum: { total: true } }),
      // Other income (repairs, manual entries) — exclude 'Sales' (already in posRevenue)
      // and legacy 'Opening Cash' drawer-float entries (not revenue).
      prisma.transaction.aggregate({ where: { tenantId, ...branchFilter, type: 'INCOME', category: { notIn: ['Sales', 'Opening Cash'] } }, _sum: { amount: true } }),
      prisma.warranty.count({ where: { tenantId, endDate: { lte: in30End }, status: 'ACTIVE' } }),
      prisma.repairTicket.count({ where: { tenantId, ...branchFilter, status: 'READY' } }),
      prisma.sale.count({ where: { tenantId, ...branchFilter, status: { not: 'RETURNED' }, ...saleWhereExcludeNonRevenue() } }),
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

router.get('/revenue', dashOrReports, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fromKey, toKey, branchId, tenantId } = resolveBusinessReportRange(req)
    const result = await getDailyRevenueBreakdown(tenantId, fromKey, toKey, branchId)
    sendSuccess(res, result)
  } catch (e) { next(e) }
})

router.get('/top-products', dashOrReports, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const limit = parseInt(req.query.limit as string) || 10
    const branchId = effectiveBranchId(req)
    const range = resolveOptionalBusinessReportRange(req)
    const dateFilter = range ? businessRangeWhere('createdAt', range) : {}
    const items = await prisma.saleItem.findMany({
      where: {
        productId: { not: null },
        sale: { tenantId, status: { not: 'RETURNED' }, ...(branchId && { branchId }), ...dateFilter, ...saleWhereExcludeNonRevenue() },
      },
      select: { productId: true, productName: true, sku: true, quantity: true, total: true },
    })
    const agg = new Map<string, { productId: string | null; productName: string; quantitySold: number; revenue: number }>()
    for (const item of items) {
      if (isReloadSaleItem(item)) continue
      const key = item.productId ?? item.productName
      const row = agg.get(key) ?? { productId: item.productId, productName: item.productName, quantitySold: 0, revenue: 0 }
      row.quantitySold += item.quantity
      row.revenue += item.total
      agg.set(key, row)
    }
    const sorted = [...agg.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit)
    sendSuccess(res, sorted.map(i => ({ productId: i.productId, productName: i.productName, quantitySold: i.quantitySold, revenue: Math.round(i.revenue * 100) / 100 })))
  } catch (e) { next(e) }
})

router.get('/repairs-by-status', dashOrReports, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = effectiveBranchId(req)
    const counts = await prisma.repairTicket.groupBy({
      by: ['status'],
      where: { tenantId: req.tenantId!, ...(branchId && { branchId }) },
      _count: true,
    })
    sendSuccess(res, counts.map((c: any) => ({ status: c.status, count: typeof c._count === 'object' ? (c._count._all ?? 0) : (c._count ?? 0) })))
  } catch (e) { next(e) }
})

router.get('/inventory-summary', reportsOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const branchId = effectiveBranchId(req)
    const products = await prisma.product.findMany({
      where: { tenantId, isActive: true, ...(branchId && { branchId }) },
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

router.get('/delivery-summary', reportsOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const branchId = effectiveBranchId(req)
    const range = resolveBusinessReportRange(req)
    const dateFilter = businessRangeWhere('createdAt', range)
    const branchFilter = branchId ? { branchId } : {}

    const [byStatus, revenue, codTotal] = await Promise.all([
      prisma.deliveryOrder.groupBy({
        by: ['status'], where: { tenantId, ...branchFilter, ...dateFilter }, _count: true, _sum: { totalAmount: true },
      }),
      prisma.deliveryOrder.aggregate({
        where: { tenantId, ...branchFilter, ...dateFilter },
        _sum: { totalAmount: true, deliveryCharge: true, codAmount: true }, _count: true,
      }),
      prisma.deliveryOrder.count({ where: { tenantId, isCOD: true, ...branchFilter, ...dateFilter } }),
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

router.get('/category-products', reportsOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const category = (req.query.category as string) ?? ''
    const branchId = effectiveBranchId(req)
    const includeServices = await tenantHasServices(tenantId)
    const { start: from, end: to } = resolveBusinessReportRange(req)

    const branchClause = branchId ? Prisma.sql`AND s."branchId" = ${branchId}` : Prisma.empty
    const categoryClause = category
      ? category === SERVICE_REPORT_CATEGORY
        ? Prisma.sql`AND ${isCatalogServiceSaleItemSql()}`
        : Prisma.sql`AND si."productId" IS NOT NULL AND COALESCE(c.name, 'Uncategorised') = ${category}`
      : Prisma.empty
    const itemTypeClause = serviceSaleItemClause(includeServices)

    const rows: Array<{
      product: string; sku: string
      revenue: number; cogs: number; profit: number
      units_sold: number; transactions: number
    }> = await prisma.$queryRaw`
      SELECT
        si."productName"                                           AS product,
        CASE
          WHEN si."productId" IS NOT NULL THEN COALESCE(p.sku, '')
          ELSE COALESCE(sv.category, 'General')
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
          ELSE COALESCE(sv.category, 'General')
        END
      ORDER  BY revenue DESC
    `

    if (includeServices && category === SERVICE_REPORT_CATEGORY) {
      const catalogServices = await prisma.service.findMany({
        where: { tenantId },
        select: { name: true, category: true },
      })
      const existing = new Set(rows.map(r => r.product))
      for (const svc of catalogServices) {
        if (!existing.has(svc.name)) {
          rows.push({
            product: svc.name,
            sku: normalizeServiceCategory(svc.category),
            revenue: 0,
            cogs: 0,
            profit: 0,
            units_sold: 0,
            transactions: 0,
          })
        }
      }
    }

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

router.get('/category-sales', reportsOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const branchId = effectiveBranchId(req)
    const includeServices = await tenantHasServices(tenantId)
    const { start: from, end: to } = resolveBusinessReportRange(req)

    const branchClause = branchId ? Prisma.sql`AND s."branchId" = ${branchId}` : Prisma.empty
    const itemTypeClause = serviceSaleItemClause(includeServices)
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

    if (includeServices) {
      const catalogCount = await prisma.service.count({ where: { tenantId } })
      if (catalogCount > 0) {
        const byCat = new Map(categories.map(c => [c.category, c]))
        if (!byCat.has(SERVICE_REPORT_CATEGORY)) {
          byCat.set(SERVICE_REPORT_CATEGORY, {
            category: SERVICE_REPORT_CATEGORY,
            revenue: 0,
            cogs: 0,
            profit: 0,
            margin: 0,
            unitsSold: 0,
            transactions: 0,
            share: 0,
          })
        }
        categories.length = 0
        categories.push(...Array.from(byCat.values()).sort((a, b) => b.revenue - a.revenue))
      }
    }

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

/** Customer sales report — revenue / paid / due / profit by customer for a period */
router.get('/customer-sales', reportsOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const branchId = effectiveBranchId(req)
    const { start: from, end: to } = resolveBusinessReportRange(req)
    const branchClause = branchId ? Prisma.sql`AND s."branchId" = ${branchId}` : Prisma.empty

    const saleRows: Array<{
      customer_id: string
      customer_name: string
      phone: string | null
      transactions: number
      revenue: number
      paid: number
      due: number
      discount: number
    }> = await prisma.$queryRaw`
      SELECT
        COALESCE(s."customerId", '__walkin__') AS customer_id,
        COALESCE(
          NULLIF(TRIM(MAX(s."customerName")), ''),
          CASE WHEN MAX(s."customerId") IS NULL THEN 'Walk-in Customer' ELSE 'Customer' END
        ) AS customer_name,
        MAX(NULLIF(TRIM(s."customerPhone"), '')) AS phone,
        COUNT(*)::int AS transactions,
        COALESCE(SUM(s.total), 0)::float AS revenue,
        COALESCE(SUM(s."paidAmount"), 0)::float AS paid,
        COALESCE(SUM(s."dueAmount"), 0)::float AS due,
        COALESCE(SUM(s.discount), 0)::float AS discount
      FROM "Sale" s
      WHERE s."tenantId" = ${tenantId}
        AND s.status != 'RETURNED'
        AND s."createdAt" >= ${from}
        AND s."createdAt" <= ${to}
        ${branchClause}
      GROUP BY COALESCE(s."customerId", '__walkin__')
      ORDER BY revenue DESC
    `

    const itemRows: Array<{
      customer_id: string
      cogs: number
      profit: number
      units_sold: number
    }> = await prisma.$queryRaw`
      SELECT
        COALESCE(s."customerId", '__walkin__') AS customer_id,
        COALESCE(SUM(${saleItemCogsExpr()}), 0)::float AS cogs,
        COALESCE(SUM(si.total - ${saleItemCogsExpr()}), 0)::float AS profit,
        COALESCE(SUM(si.quantity), 0)::float AS units_sold
      FROM "SaleItem" si
      JOIN "Sale" s ON s.id = si."saleId"
      LEFT JOIN "Product" p ON p.id = si."productId"
      LEFT JOIN "Service" sv ON sv."tenantId" = s."tenantId"
        AND sv.name = si."productName"
        AND si."productId" IS NULL
      WHERE s."tenantId" = ${tenantId}
        AND s.status != 'RETURNED'
        AND s."createdAt" >= ${from}
        AND s."createdAt" <= ${to}
        ${branchClause}
      GROUP BY COALESCE(s."customerId", '__walkin__')
    `

    const itemById = new Map(itemRows.map(r => [r.customer_id, r]))

    // Prefer customer master name when linked
    const customerIds = saleRows.map(r => r.customer_id).filter(id => id !== '__walkin__')
    const masters = customerIds.length
      ? await prisma.customer.findMany({
          where: { tenantId, id: { in: customerIds } },
          select: { id: true, name: true, phone: true, totalDue: true },
        })
      : []
    const masterById = new Map(masters.map(c => [c.id, c]))

    const customers = saleRows.map(r => {
      const items = itemById.get(r.customer_id)
      const master = r.customer_id !== '__walkin__' ? masterById.get(r.customer_id) : null
      const revenue = Number(r.revenue)
      const cogs = Number(items?.cogs ?? 0)
      const profit = Number(items?.profit ?? revenue - cogs)
      return {
        customerId: r.customer_id === '__walkin__' ? null : r.customer_id,
        customerName: master?.name ?? r.customer_name,
        phone: master?.phone ?? r.phone ?? '',
        revenue,
        paid: Number(r.paid),
        due: Number(r.due),
        discount: Number(r.discount),
        cogs,
        profit,
        margin: revenue > 0 ? Math.round((profit / revenue) * 100) : 0,
        unitsSold: Number(items?.units_sold ?? 0),
        transactions: Number(r.transactions),
        avgTicket: Number(r.transactions) > 0 ? Math.round((revenue / Number(r.transactions)) * 100) / 100 : 0,
        currentBalance: master?.totalDue ?? 0,
      }
    }).sort((a, b) => b.revenue - a.revenue)

    const totalRevenue = customers.reduce((s, c) => s + c.revenue, 0)
    const totalPaid = customers.reduce((s, c) => s + c.paid, 0)
    const totalDue = customers.reduce((s, c) => s + c.due, 0)
    const totalProfit = customers.reduce((s, c) => s + c.profit, 0)
    const totalCogs = customers.reduce((s, c) => s + c.cogs, 0)
    const totalTxns = customers.reduce((s, c) => s + c.transactions, 0)

    sendSuccess(res, {
      customers: customers.map(c => ({
        ...c,
        share: totalRevenue > 0 ? Math.round((c.revenue / totalRevenue) * 100) : 0,
      })),
      totals: {
        revenue: Math.round(totalRevenue * 100) / 100,
        paid: Math.round(totalPaid * 100) / 100,
        due: Math.round(totalDue * 100) / 100,
        cogs: Math.round(totalCogs * 100) / 100,
        profit: Math.round(totalProfit * 100) / 100,
        margin: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0,
        transactions: totalTxns,
        customers: customers.length,
      },
    })
  } catch (e) { next(e) }
})

/** Invoices for one customer (or walk-in) in a date range */
router.get('/customer-sales-detail', reportsOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const branchId = effectiveBranchId(req)
    const customerId = (req.query.customerId as string | undefined)?.trim() || null
    const walkIn = req.query.walkIn === '1' || customerId === '__walkin__'
    const { start: from, end: to } = resolveBusinessReportRange(req)

    const sales = await prisma.sale.findMany({
      where: {
        tenantId,
        status: { not: 'RETURNED' },
        createdAt: { gte: from, lte: to },
        ...(branchId ? { branchId } : {}),
        ...(walkIn || !customerId
          ? { customerId: null }
          : { customerId }),
      },
      select: {
        id: true,
        invoiceNumber: true,
        customerName: true,
        customerPhone: true,
        total: true,
        paidAmount: true,
        dueAmount: true,
        discount: true,
        status: true,
        createdAt: true,
        items: { select: { quantity: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    sendSuccess(res, sales.map(s => ({
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      customerName: s.customerName || 'Walk-in Customer',
      phone: s.customerPhone || '',
      total: s.total,
      paid: s.paidAmount,
      due: s.dueAmount,
      discount: s.discount,
      status: s.status,
      createdAt: s.createdAt,
      units: s.items.reduce((n, i) => n + i.quantity, 0),
    })))
  } catch (e) { next(e) }
})

/** Purchase report — PO value / paid / due by supplier for a period */
router.get('/purchase-report', reportsOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const branchId = effectiveBranchId(req)
    const { start: from, end: to } = resolveBusinessReportRange(req)
    const branchClause = branchId ? Prisma.sql`AND po."branchId" = ${branchId}` : Prisma.empty

    const saleRows: Array<{
      supplier_id: string
      supplier_name: string
      orders: number
      draft_orders: number
      sent_orders: number
      partial_orders: number
      received_orders: number
      closed_orders: number
      total: number
      paid: number
      due: number
      tax: number
    }> = await prisma.$queryRaw`
      SELECT
        po."supplierId" AS supplier_id,
        COALESCE(NULLIF(TRIM(MAX(po."supplierName")), ''), 'Supplier') AS supplier_name,
        COUNT(*)::int AS orders,
        COUNT(*) FILTER (WHERE po.status = 'DRAFT')::int AS draft_orders,
        COUNT(*) FILTER (WHERE po.status = 'SENT')::int AS sent_orders,
        COUNT(*) FILTER (WHERE po.status = 'PARTIAL')::int AS partial_orders,
        COUNT(*) FILTER (WHERE po.status = 'RECEIVED')::int AS received_orders,
        COUNT(*) FILTER (WHERE po.status = 'CLOSED')::int AS closed_orders,
        COALESCE(SUM(po.total), 0)::float AS total,
        COALESCE(SUM(po."paidAmount"), 0)::float AS paid,
        COALESCE(SUM(po."dueAmount"), 0)::float AS due,
        COALESCE(SUM(po.tax), 0)::float AS tax
      FROM "PurchaseOrder" po
      WHERE po."tenantId" = ${tenantId}
        AND po."createdAt" >= ${from}
        AND po."createdAt" <= ${to}
        ${branchClause}
      GROUP BY po."supplierId"
      ORDER BY total DESC
    `

    const itemRows: Array<{
      supplier_id: string
      units_ordered: number
      units_received: number
    }> = await prisma.$queryRaw`
      SELECT
        po."supplierId" AS supplier_id,
        COALESCE(SUM(i.quantity), 0)::float AS units_ordered,
        COALESCE(SUM(i."receivedQuantity"), 0)::float AS units_received
      FROM "POItem" i
      JOIN "PurchaseOrder" po ON po.id = i."purchaseOrderId"
      WHERE po."tenantId" = ${tenantId}
        AND po."createdAt" >= ${from}
        AND po."createdAt" <= ${to}
        ${branchClause}
      GROUP BY po."supplierId"
    `

    const itemById = new Map(itemRows.map(r => [r.supplier_id, r]))

    const supplierIds = saleRows.map(r => r.supplier_id)
    const masters = supplierIds.length
      ? await prisma.supplier.findMany({
          where: { tenantId, id: { in: supplierIds } },
          select: { id: true, name: true, phone: true, outstandingDues: true },
        })
      : []
    const masterById = new Map(masters.map(s => [s.id, s]))

    const suppliers = saleRows.map(r => {
      const items = itemById.get(r.supplier_id)
      const master = masterById.get(r.supplier_id)
      const total = Number(r.total)
      const orders = Number(r.orders)
      return {
        supplierId: r.supplier_id,
        supplierName: master?.name ?? r.supplier_name,
        phone: master?.phone ?? '',
        total,
        paid: Number(r.paid),
        due: Number(r.due),
        tax: Number(r.tax),
        orders,
        draftOrders: Number(r.draft_orders),
        sentOrders: Number(r.sent_orders),
        partialOrders: Number(r.partial_orders),
        receivedOrders: Number(r.received_orders),
        closedOrders: Number(r.closed_orders),
        unitsOrdered: Number(items?.units_ordered ?? 0),
        unitsReceived: Number(items?.units_received ?? 0),
        avgOrder: orders > 0 ? Math.round((total / orders) * 100) / 100 : 0,
        outstandingBalance: master?.outstandingDues ?? 0,
      }
    }).sort((a, b) => b.total - a.total)

    const totalValue = suppliers.reduce((s, x) => s + x.total, 0)
    const totalPaid = suppliers.reduce((s, x) => s + x.paid, 0)
    const totalDue = suppliers.reduce((s, x) => s + x.due, 0)
    const totalOrders = suppliers.reduce((s, x) => s + x.orders, 0)
    const unitsOrdered = suppliers.reduce((s, x) => s + x.unitsOrdered, 0)
    const unitsReceived = suppliers.reduce((s, x) => s + x.unitsReceived, 0)

    sendSuccess(res, {
      suppliers: suppliers.map(s => ({
        ...s,
        share: totalValue > 0 ? Math.round((s.total / totalValue) * 100) : 0,
      })),
      totals: {
        total: Math.round(totalValue * 100) / 100,
        paid: Math.round(totalPaid * 100) / 100,
        due: Math.round(totalDue * 100) / 100,
        orders: totalOrders,
        suppliers: suppliers.length,
        unitsOrdered: Math.round(unitsOrdered),
        unitsReceived: Math.round(unitsReceived),
      },
    })
  } catch (e) { next(e) }
})

/** PO list for one supplier in a date range */
router.get('/purchase-report-detail', reportsOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const branchId = effectiveBranchId(req)
    const supplierId = (req.query.supplierId as string | undefined)?.trim()
    if (!supplierId) {
      sendSuccess(res, [])
      return
    }
    const { start: from, end: to } = resolveBusinessReportRange(req)

    const orders = await prisma.purchaseOrder.findMany({
      where: {
        tenantId,
        supplierId,
        createdAt: { gte: from, lte: to },
        ...(branchId ? { branchId } : {}),
      },
      select: {
        id: true,
        poNumber: true,
        supplierName: true,
        status: true,
        total: true,
        paidAmount: true,
        dueAmount: true,
        tax: true,
        createdAt: true,
        receivedAt: true,
        items: { select: { quantity: true, receivedQuantity: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    sendSuccess(res, orders.map(o => ({
      id: o.id,
      poNumber: o.poNumber,
      supplierName: o.supplierName,
      status: o.status,
      total: o.total,
      paid: o.paidAmount,
      due: o.dueAmount,
      tax: o.tax,
      createdAt: o.createdAt,
      receivedAt: o.receivedAt,
      unitsOrdered: o.items.reduce((n, i) => n + i.quantity, 0),
      unitsReceived: o.items.reduce((n, i) => n + i.receivedQuantity, 0),
    })))
  } catch (e) { next(e) }
})

export default router
