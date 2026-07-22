import { prisma } from '../../config/database'
import { businessDayRange, normalizeBusinessDate } from '../../utils/date-range'
import { isReloadSaleItem } from './reload-item.util'
import { resolveSaleItemUnitCost } from '../../utils/sale-item-cost.util'

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function isMobileProduct(product: { trackImei?: boolean; category?: { name?: string; slug?: string } | null } | null) {
  if (!product) return false
  if (product.trackImei) return true
  const cat = `${product.category?.name ?? ''} ${product.category?.slug ?? ''}`.toLowerCase()
  return /mobile|phone|smartphone|handset/.test(cat)
}

function isPrintRelated(category: string, productName: string) {
  const c = category.toLowerCase()
  const n = productName.toLowerCase()
  return /print|laminate|photocopy|xerox/.test(c) || /print|laminate/.test(n)
}

export async function buildCategoryCostMap(tenantId: string, branchId: string, dateStr: string) {
  const { start, end } = businessDayRange(normalizeBusinessDate(dateStr))
  const [sales, services] = await Promise.all([
    prisma.sale.findMany({
      where: {
        tenantId,
        branchId,
        status: { not: 'RETURNED' },
        createdAt: { gte: start, lte: end },
        source: { notIn: ['REPAIR', 'OPENING_BALANCE', 'CREDIT_COLLECTION'] },
      },
      include: {
        items: { include: { product: { select: { buyingPrice: true, storageVariations: true, trackImei: true, category: true } } } },
      },
    }),
    prisma.service.findMany({
      where: { tenantId },
      select: { name: true, category: true, cost: true },
    }),
  ])

  const serviceMap = new Map(services.map(s => [s.name, s]))
  const map: Record<string, { revenue: number; cogs: number }> = {}

  const add = (key: string, revenue: number, cogs: number) => {
    const k = key.trim() || 'Other'
    if (!map[k]) map[k] = { revenue: 0, cogs: 0 }
    map[k].revenue += revenue
    map[k].cogs += cogs
  }

  for (const sale of sales) {
    for (const item of sale.items) {
      if (isReloadSaleItem(item)) continue
      const revenue = Number(item.total)
      if (item.productId && item.product) {
        const unitCost = item.unitCost > 0
          ? item.unitCost
          : resolveSaleItemUnitCost(item.product, { sku: item.sku })
        const cogs = item.quantity * unitCost
        const catName = item.product.category?.name ?? 'Uncategorised'
        add(catName, revenue, cogs)
        if (isMobileProduct(item.product)) add('Mobile', revenue, cogs)
        else add('Accessories', revenue, cogs)
        if (isPrintRelated(catName, item.productName)) add('Print', revenue, cogs)
        if (/printer/i.test(catName) || /printer/i.test(item.productName)) add('Printer', revenue, cogs)
      } else {
        const svc = serviceMap.get(item.productName)
        const cogs = item.quantity * Number(svc?.cost ?? 0)
        const catName = svc?.category?.trim() || 'Service'
        add(catName, revenue, cogs)
        add('Service', revenue, cogs)
        if (/print/i.test(item.productName) || /print/i.test(catName)) add('Print', revenue, cogs)
      }
    }
  }

  return Object.fromEntries(
    Object.entries(map).map(([k, v]) => [
      k,
      { revenue: round2(v.revenue), cogs: round2(v.cogs), profit: round2(v.revenue - v.cogs) },
    ]),
  )
}

const TABLE_ROW_ORDER = [
  'Mobile',
  'Accessories',
  'Print',
  'Printer',
  'Service',
  'Repair',
]

export type CategoryProfitRow = {
  category: string
  cost: number
  sales: number
  profit: number
  balance: number
}

export async function buildCategoryProfitTable(
  tenantId: string,
  branchId: string,
  dateStr: string,
): Promise<CategoryProfitRow[]> {
  const map = await buildCategoryCostMap(tenantId, branchId, dateStr)
  const skip = new Set(['Uncategorised', 'Other'])
  const used = new Set<string>()
  const rows: CategoryProfitRow[] = []

  const push = (name: string) => {
    const v = map[name]
    if (!v || (v.revenue === 0 && v.cogs === 0)) return
    used.add(name)
    rows.push({
      category: name,
      cost: v.cogs,
      sales: v.revenue,
      profit: v.profit,
      balance: v.profit,
    })
  }

  for (const name of TABLE_ROW_ORDER) push(name)

  for (const [name, v] of Object.entries(map)) {
    if (used.has(name) || skip.has(name)) continue
    if (v.revenue === 0 && v.cogs === 0) continue
    if (name === 'Accessories' && map.Mobile) continue
    rows.push({
      category: name,
      cost: v.cogs,
      sales: v.revenue,
      profit: v.profit,
      balance: v.profit,
    })
  }

  return rows
}
