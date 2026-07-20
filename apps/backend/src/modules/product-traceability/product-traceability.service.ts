import { Request } from 'express'
import { Prisma, StockMovementType } from '@prisma/client'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { getPagination } from '../../utils/pagination'
import { effectiveBranchId, assertBranchRecordAccess } from '../../utils/active-branch'
import { hasVariants, sumVariantStock } from '../../utils/product-variants'

function parseDateRange(req: Request) {
  const fromRaw = req.query.from as string | undefined
  const toRaw = req.query.to as string | undefined
  const from = fromRaw ? new Date(fromRaw) : undefined
  const to = toRaw ? new Date(toRaw) : undefined
  if (to && !Number.isNaN(to.getTime())) to.setHours(23, 59, 59, 999)
  return {
    from: from && !Number.isNaN(from.getTime()) ? from : undefined,
    to: to && !Number.isNaN(to.getTime()) ? to : undefined,
  }
}

function branchFilter(req: Request) {
  const branchId = (req.query.branchId as string | undefined) || effectiveBranchId(req)
  return branchId || undefined
}

function dateWhere(field: string, from?: Date, to?: Date): Record<string, unknown> {
  if (!from && !to) return {}
  return {
    [field]: {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    },
  }
}

function effectiveStock(product: { stock: number; storageVariations?: unknown }) {
  if (!hasVariants(product.storageVariations)) return product.stock
  return sumVariantStock(product.storageVariations)
}

export function mapMovementLabel(type: StockMovementType, note?: string | null): string {
  const n = (note ?? '').toLowerCase()
  if (n.includes('opening')) return 'Opening Stock'
  if (n.includes('damage') || n.includes('damaged')) return 'Damage'
  if (n.includes('manual')) return 'Manual Entry'
  if (n.includes('purchase return')) return 'Purchase Return'
  switch (type) {
    case 'PURCHASE': return 'Purchase'
    case 'SALE': return 'Sale'
    case 'RETURN': return 'Sales Return'
    case 'TRANSFER_IN':
    case 'TRANSFER_OUT': return 'Stock Transfer'
    case 'ADJUSTMENT': return 'Stock Adjustment'
    case 'REPAIR_USE': return 'Damage'
    case 'EXCHANGE_IN': return 'Sales Return'
    default: return type
  }
}

function mapImeiStatus(status: string): string {
  switch (status) {
    case 'IN_STOCK': return 'Available'
    case 'SOLD': return 'Sold'
    case 'IN_REPAIR':
    case 'UNDER_WARRANTY_CLAIM': return 'Reserved'
    case 'SCRAPPED': return 'Damaged'
    default: return status
  }
}

async function loadProduct(tenantId: string, productId: string, req: Request) {
  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId },
    include: {
      category: { select: { name: true } },
      brand: { select: { name: true } },
      branch: { select: { id: true, name: true } },
    },
  })
  if (!product) throw new AppError('Product not found', 404)
  assertBranchRecordAccess(req, product.branchId)
  return product
}

function poItemSearch(search: string | undefined): Prisma.PurchaseOrderWhereInput | undefined {
  if (!search?.trim()) return undefined
  const q = search.trim()
  return {
    OR: [
      { poNumber: { contains: q, mode: 'insensitive' } },
      { supplierName: { contains: q, mode: 'insensitive' } },
      { notes: { contains: q, mode: 'insensitive' } },
    ],
  }
}

function saleItemSearch(search: string | undefined): Prisma.SaleWhereInput | undefined {
  if (!search?.trim()) return undefined
  const q = search.trim()
  return {
    OR: [
      { invoiceNumber: { contains: q, mode: 'insensitive' } },
      { customerName: { contains: q, mode: 'insensitive' } },
      { customerPhone: { contains: q, mode: 'insensitive' } },
    ],
  }
}

function movementSearch(search: string | undefined): Prisma.StockMovementWhereInput | undefined {
  if (!search?.trim()) return undefined
  const q = search.trim()
  return {
    OR: [
      { reference: { contains: q, mode: 'insensitive' } },
      { note: { contains: q, mode: 'insensitive' } },
      { performedBy: { contains: q, mode: 'insensitive' } },
    ],
  }
}

function serialSearch(search: string | undefined): Prisma.ImeiRecordWhereInput | undefined {
  if (!search?.trim()) return undefined
  const q = search.trim()
  return {
    OR: [
      { imei: { contains: q, mode: 'insensitive' } },
      { sale: { is: { invoiceNumber: { contains: q, mode: 'insensitive' } } } },
      { customer: { is: { name: { contains: q, mode: 'insensitive' } } } },
      { purchaseOrder: { is: { poNumber: { contains: q, mode: 'insensitive' } } } },
    ],
  }
}

export const productTraceabilityService = {
  async getSummary(tenantId: string, productId: string, req: Request) {
    const product = await loadProduct(tenantId, productId, req)
    const branchId = branchFilter(req)
    const { from, to } = parseDateRange(req)

    const poWhere: Prisma.POItemWhereInput = {
      productId,
      purchaseOrder: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        ...poItemSearch(req.query.search as string | undefined),
        ...dateWhere('createdAt', from, to),
      },
    }

    const saleWhere: Prisma.SaleItemWhereInput = {
      productId,
      sale: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        ...saleItemSearch(req.query.search as string | undefined),
        ...dateWhere('createdAt', from, to),
      },
    }

    const movementWhere: Prisma.StockMovementWhereInput = {
      productId,
      ...(branchId ? { branchId } : {}),
      ...movementSearch(req.query.search as string | undefined),
      ...dateWhere('createdAt', from, to),
    }

    const [
      poItems,
      saleItems,
      returnItems,
      poOrderCount,
      saleInvoiceCount,
      customerGroups,
      reservedCount,
    ] = await Promise.all([
      prisma.pOItem.findMany({
        where: poWhere,
        select: { quantity: true, receivedQuantity: true, total: true },
      }),
      prisma.saleItem.findMany({
        where: saleWhere,
        select: { quantity: true, total: true },
      }),
      prisma.saleReturnItem.findMany({
        where: {
          productId,
          return: {
            tenantId,
            ...(branchId ? { branchId } : {}),
            ...dateWhere('createdAt', from, to),
          },
        },
        select: { quantity: true, total: true },
      }),
      prisma.pOItem.findMany({
        where: poWhere,
        distinct: ['purchaseOrderId'],
        select: { purchaseOrderId: true },
      }),
      prisma.saleItem.findMany({
        where: saleWhere,
        distinct: ['saleId'],
        select: { saleId: true },
      }),
      prisma.saleItem.findMany({
        where: {
          ...saleWhere,
          sale: { ...(saleWhere.sale as object), customerId: { not: null } },
        },
        distinct: ['saleId'],
        select: { sale: { select: { customerId: true } } },
      }),
      product.trackImei
        ? prisma.imeiRecord.count({
            where: {
              productId,
              ...(branchId ? { branchId } : {}),
              status: { in: ['IN_REPAIR', 'UNDER_WARRANTY_CLAIM'] },
            },
          })
        : Promise.resolve(0),
    ])

    const totalPurchasedQty = poItems.reduce((s, i) => s + (i.receivedQuantity || i.quantity), 0)
    const totalPurchaseValue = poItems.reduce((s, i) => s + i.total, 0)
    const totalSoldQty = saleItems.reduce((s, i) => s + i.quantity, 0)
    const totalSalesValue = saleItems.reduce((s, i) => s + i.total, 0)
    const totalReturnedQty = returnItems.reduce((s, i) => s + i.quantity, 0)
    const currentStock = effectiveStock(product)
    const reservedStock = reservedCount
    const availableStock = Math.max(0, currentStock - reservedStock)

    return {
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        category: product.category.name,
        brand: product.brand.name,
        branchId: product.branchId,
        branchName: product.branch.name,
        trackImei: product.trackImei,
        currentStock,
        reservedStock,
        availableStock,
      },
      analytics: {
        totalPurchasedQty,
        totalSoldQty,
        totalReturnedQty,
        currentStock,
        totalPurchaseValue,
        totalSalesValue,
        grossProfit: totalSalesValue - totalPurchaseValue,
        totalCustomersPurchased: customerGroups.filter(g => g.sale?.customerId).length,
        totalPurchaseOrders: poOrderCount.length,
        totalSalesInvoices: saleInvoiceCount.length,
      },
    }
  },

  async getPurchases(tenantId: string, productId: string, req: Request) {
    await loadProduct(tenantId, productId, req)
    const { skip, limit, page, search } = getPagination(req)
    const branchId = branchFilter(req)
    const { from, to } = parseDateRange(req)

    const where: Prisma.POItemWhereInput = {
      productId,
      purchaseOrder: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        ...poItemSearch(search),
        ...dateWhere('createdAt', from, to),
      },
    }

    const [rows, total] = await Promise.all([
      prisma.pOItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { purchaseOrder: { createdAt: 'desc' } },
        include: {
          purchaseOrder: {
            include: { branch: { select: { id: true, name: true } } },
          },
        },
      }),
      prisma.pOItem.count({ where }),
    ])

    const refs = rows.map(r => `${r.purchaseOrderId}:${r.id}`)
    const movements = refs.length
      ? await prisma.stockMovement.findMany({
          where: { productId, reference: { in: refs } },
          select: { reference: true, performedBy: true },
        })
      : []
    const receivedByMap = new Map(movements.map(m => [m.reference ?? '', m.performedBy]))

    const data = rows.map(item => {
      const po = item.purchaseOrder
      const refKey = `${po.id}:${item.id}`
      const isOpening = (po.notes ?? '').includes('OPENING_BALANCE')
      return {
        id: item.id,
        purchaseOrderId: po.id,
        purchaseOrderNo: po.poNumber,
        purchaseInvoiceNo: po.poNumber,
        supplierId: po.supplierId,
        supplierName: po.supplierName,
        purchaseDate: po.receivedAt ?? po.createdAt,
        warehouseId: po.branchId,
        warehouseName: po.branch.name,
        quantityPurchased: item.receivedQuantity || item.quantity,
        unitCost: item.unitCost,
        totalCost: item.total,
        receivedBy: receivedByMap.get(refKey) ?? (isOpening ? 'System' : '—'),
        status: po.status,
      }
    })

    return { data, total, page, limit }
  },

  async getSales(tenantId: string, productId: string, req: Request) {
    await loadProduct(tenantId, productId, req)
    const { skip, limit, page, search } = getPagination(req)
    const branchId = branchFilter(req)
    const { from, to } = parseDateRange(req)

    const where: Prisma.SaleItemWhereInput = {
      productId,
      sale: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        ...saleItemSearch(search),
        ...dateWhere('createdAt', from, to),
      },
    }

    const [rows, total] = await Promise.all([
      prisma.saleItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sale: { createdAt: 'desc' } },
        include: {
          sale: {
            include: { branch: { select: { id: true, name: true } } },
          },
        },
      }),
      prisma.saleItem.count({ where }),
    ])

    const data = rows.map(item => ({
      id: item.id,
      saleId: item.saleId,
      invoiceNumber: item.sale.invoiceNumber,
      customerId: item.sale.customerId,
      customerName: item.sale.customerName ?? 'Walk-in',
      contactNumber: item.sale.customerPhone ?? '—',
      invoiceDate: item.sale.createdAt,
      quantityPurchased: item.quantity,
      sellingPrice: item.unitPrice,
      discount: item.discount,
      invoiceTotal: item.total,
      salesperson: item.sale.cashierName,
      paymentStatus: item.sale.status,
      warehouseName: item.sale.branch?.name ?? '—',
    }))

    return { data, total, page, limit }
  },

  async getMovements(tenantId: string, productId: string, req: Request) {
    await loadProduct(tenantId, productId, req)
    const { skip, limit, page, search } = getPagination(req)
    const branchId = branchFilter(req)
    const { from, to } = parseDateRange(req)

    const where: Prisma.StockMovementWhereInput = {
      productId,
      ...(branchId ? { branchId } : {}),
      ...movementSearch(search),
      ...dateWhere('createdAt', from, to),
    }

    const [total, priorAgg, rows] = await Promise.all([
      prisma.stockMovement.count({ where }),
      skip > 0
        ? prisma.stockMovement.findMany({
            where,
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            take: skip,
            select: { quantity: true },
          })
        : Promise.resolve([]),
      prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: { branch: { select: { id: true, name: true } } },
      }),
    ])

    let running = priorAgg.reduce((s, m) => s + m.quantity, 0)
    const data = rows.map(m => {
      running += m.quantity
      const stockIn = m.quantity > 0 ? m.quantity : 0
      const stockOut = m.quantity < 0 ? Math.abs(m.quantity) : 0
      return {
        id: m.id,
        dateTime: m.createdAt,
        transactionType: mapMovementLabel(m.type, m.note),
        referenceNumber: m.reference ?? '—',
        warehouseId: m.branchId,
        warehouseName: m.branch.name,
        stockIn,
        stockOut,
        runningBalance: running,
        performedBy: m.performedBy,
        remarks: m.note ?? '—',
        rawType: m.type,
      }
    })

    return { data, total, page, limit }
  },

  async getSerials(tenantId: string, productId: string, req: Request) {
    const product = await loadProduct(tenantId, productId, req)
    if (!product.trackImei) return { data: [], total: 0, page: 1, limit: 20 }

    const { skip, limit, page, search } = getPagination(req)
    const branchId = branchFilter(req)
    const { from, to } = parseDateRange(req)

    const where: Prisma.ImeiRecordWhereInput = {
      productId,
      ...(branchId ? { branchId } : {}),
      ...serialSearch(search),
      ...dateWhere('updatedAt', from, to),
    }

    const [rows, total] = await Promise.all([
      prisma.imeiRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          sale: { select: { id: true, invoiceNumber: true, createdAt: true } },
          purchaseOrder: { select: { id: true, poNumber: true } },
          customer: { select: { id: true, name: true, phone: true } },
        },
      }),
      prisma.imeiRecord.count({ where }),
    ])

    const imeis = rows.map(r => r.imei)
    const warranties = imeis.length
      ? await prisma.warranty.findMany({
          where: { tenantId, imei: { in: imeis } },
          select: { imei: true, status: true, endDate: true },
          orderBy: { createdAt: 'desc' },
        })
      : []
    const warrantyMap = new Map<string, { status: string; endDate: Date }>()
    for (const w of warranties) {
      if (w.imei && !warrantyMap.has(w.imei)) {
        warrantyMap.set(w.imei, { status: w.status, endDate: w.endDate })
      }
    }

    const data = rows.map(r => {
      const w = warrantyMap.get(r.imei)
      return {
        id: r.id,
        serialImei: r.imei,
        currentStatus: mapImeiStatus(r.status),
        purchaseInvoiceId: r.purchaseOrderId,
        purchaseInvoiceNo: r.purchaseOrder?.poNumber ?? '—',
        salesInvoiceId: r.saleId,
        salesInvoiceNo: r.sale?.invoiceNumber ?? '—',
        customerId: r.customerId,
        customerName: r.customer?.name ?? '—',
        warrantyStatus: w?.status ?? (r.status === 'SOLD' ? 'ACTIVE' : '—'),
        soldDate: r.sale?.createdAt ?? null,
      }
    })

    return { data, total, page, limit }
  },

  async getTimeline(tenantId: string, productId: string, req: Request) {
    await loadProduct(tenantId, productId, req)
    const { skip, limit, page } = getPagination(req)
    const branchId = branchFilter(req)
    const { from, to } = parseDateRange(req)

    const where: Prisma.StockMovementWhereInput = {
      productId,
      ...(branchId ? { branchId } : {}),
      ...dateWhere('createdAt', from, to),
    }

    const [rows, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { branch: { select: { name: true } } },
      }),
      prisma.stockMovement.count({ where }),
    ])

    const poIds = new Set<string>()
    const invoiceNumbers = new Set<string>()
    for (const m of rows) {
      if (m.type === 'PURCHASE' && m.reference?.includes(':')) {
        poIds.add(m.reference.split(':')[0])
      }
      if (m.type === 'SALE' && m.reference) invoiceNumbers.add(m.reference)
    }

    const [pos, sales] = await Promise.all([
      poIds.size
        ? prisma.purchaseOrder.findMany({
            where: { id: { in: [...poIds] }, tenantId },
            select: { id: true, poNumber: true, supplierName: true },
          })
        : Promise.resolve([]),
      invoiceNumbers.size
        ? prisma.sale.findMany({
            where: { tenantId, invoiceNumber: { in: [...invoiceNumbers] } },
            select: { invoiceNumber: true, customerName: true },
          })
        : Promise.resolve([]),
    ])
    const poMap = new Map(pos.map(p => [p.id, p]))
    const saleMap = new Map(sales.map(s => [s.invoiceNumber, s]))

    const data = rows.map(m => {
      let title = mapMovementLabel(m.type, m.note)
      let subtitle = m.note ?? ''
      if (m.type === 'PURCHASE' && m.reference?.includes(':')) {
        const po = poMap.get(m.reference.split(':')[0])
        if (po) {
          title = `Purchased from ${po.supplierName}`
          subtitle = `PO ${po.poNumber} · ${m.branch.name}`
        }
      } else if (m.type === 'SALE' && m.reference) {
        const sale = saleMap.get(m.reference)
        if (sale) {
          title = `Sold to ${sale.customerName ?? 'Walk-in'}`
          subtitle = `Invoice ${m.reference} · ${m.branch.name}`
        }
      } else if (m.type === 'TRANSFER_IN' || m.type === 'TRANSFER_OUT') {
        title = m.type === 'TRANSFER_IN' ? `Transferred into ${m.branch.name}` : `Transferred out of ${m.branch.name}`
      } else if (m.type === 'RETURN') {
        title = 'Returned by customer'
      } else if (m.type === 'ADJUSTMENT') {
        title = 'Adjusted by admin'
      }

      return {
        id: m.id,
        dateTime: m.createdAt,
        title,
        subtitle,
        transactionType: mapMovementLabel(m.type, m.note),
        quantity: m.quantity,
        performedBy: m.performedBy,
      }
    })

    return { data, total, page, limit }
  },
}
