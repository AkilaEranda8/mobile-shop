import { Request } from 'express'
import { Prisma, StockMovementType } from '@prisma/client'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { assertBranchRecordAccess } from '../../utils/active-branch'
import { catalogBaseSku } from '../../utils/branch-catalog'
import { hasVariants, sumVariantStock } from '../../utils/product-variants'
import { evaluateNotesContainOpeningBalance } from '../business-rules-engine/business-rules-engine.service'
import {
  buildReportFilterContext,
  dateWhereClause,
} from '../report-engine/report-engine.service'

function reportFilters(req: Request) {
  return buildReportFilterContext(req, {
    dateMode: 'instant',
    allowQueryBranchOverride: true,
  })
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

/** All catalog clones of this SKU across branches (HQ + `-BRxxxxxx` rows). */
async function relatedCatalogProductIds(tenantId: string, product: { id: string; sku: string }) {
  const base = catalogBaseSku(product.sku)
  const rows = await prisma.product.findMany({
    where: {
      tenantId,
      OR: [
        { id: product.id },
        { sku: base },
        { sku: { startsWith: `${base}-BR` } },
      ],
    },
    select: { id: true, sku: true },
  })
  return [...new Set(rows.filter(r => catalogBaseSku(r.sku) === base).map(r => r.id))]
}

/** Parse stock-transfer movementNote: `[notes, variantLabel, IMEI: …].join(' · ')`. */
function transferNoteFields(note?: string | null) {
  const raw = (note ?? '').trim()
  if (!raw) return { notes: '—', variant: '—', imeis: '—' }
  const parts = raw.split(' · ').map(p => p.trim()).filter(Boolean)
  const imeiPart = parts.find(p => /^IMEI:/i.test(p))
  const rest = parts.filter(p => !/^IMEI:/i.test(p))
  const imeis = imeiPart ? imeiPart.replace(/^IMEI:\s*/i, '').trim() : ''
  let userNotes = ''
  let variant = ''
  if (rest.length === 1) {
    userNotes = rest[0]
  } else if (rest.length >= 2) {
    userNotes = rest[0]
    variant = rest.slice(1).join(' · ')
  }
  return {
    notes: userNotes || '—',
    variant: variant || '—',
    imeis: imeis || '—',
  }
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
    const { branchId, from, to } = reportFilters(req)

    const poWhere: Prisma.POItemWhereInput = {
      productId,
      purchaseOrder: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        ...poItemSearch(req.query.search as string | undefined),
        ...dateWhereClause('createdAt', from, to),
      },
    }

    const saleWhere: Prisma.SaleItemWhereInput = {
      productId,
      sale: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        ...saleItemSearch(req.query.search as string | undefined),
        ...dateWhereClause('createdAt', from, to),
      },
    }

    const movementWhere: Prisma.StockMovementWhereInput = {
      productId,
      ...(branchId ? { branchId } : {}),
      ...movementSearch(req.query.search as string | undefined),
      ...dateWhereClause('createdAt', from, to),
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
            ...dateWhereClause('createdAt', from, to),
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
    const { skip, limit, page, search, branchId, from, to } = reportFilters(req)

    const where: Prisma.POItemWhereInput = {
      productId,
      purchaseOrder: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        ...poItemSearch(search),
        ...dateWhereClause('createdAt', from, to),
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
      const isOpening = evaluateNotesContainOpeningBalance(tenantId, po.notes)
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
    const { skip, limit, page, search, branchId, from, to } = reportFilters(req)

    const where: Prisma.SaleItemWhereInput = {
      productId,
      sale: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        ...saleItemSearch(search),
        ...dateWhereClause('createdAt', from, to),
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
    const { skip, limit, page, search, branchId, from, to } = reportFilters(req)

    const where: Prisma.StockMovementWhereInput = {
      productId,
      ...(branchId ? { branchId } : {}),
      ...movementSearch(search),
      ...dateWhereClause('createdAt', from, to),
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

    const transferRefs = rows
      .filter(m => (m.type === 'TRANSFER_IN' || m.type === 'TRANSFER_OUT') && m.reference)
      .map(m => m.reference as string)
    const pairRows = transferRefs.length
      ? await prisma.stockMovement.findMany({
          where: {
            reference: { in: [...new Set(transferRefs)] },
            type: { in: ['TRANSFER_IN', 'TRANSFER_OUT'] },
          },
          include: { branch: { select: { id: true, name: true } } },
        })
      : []
    const pairByRef = new Map<string, typeof pairRows>()
    for (const p of pairRows) {
      const key = p.reference ?? ''
      const list = pairByRef.get(key) ?? []
      list.push(p)
      pairByRef.set(key, list)
    }

    const data = rows.map(m => {
      running += m.quantity
      const stockIn = m.quantity > 0 ? m.quantity : 0
      const stockOut = m.quantity < 0 ? Math.abs(m.quantity) : 0
      let remarks = m.note ?? '—'
      let warehouseName = m.branch.name
      if ((m.type === 'TRANSFER_IN' || m.type === 'TRANSFER_OUT') && m.reference) {
        const pair = pairByRef.get(m.reference) ?? []
        const out = pair.find(p => p.type === 'TRANSFER_OUT')
        const inn = pair.find(p => p.type === 'TRANSFER_IN')
        const fromName = out?.branch.name ?? (m.type === 'TRANSFER_OUT' ? m.branch.name : '—')
        const toName = inn?.branch.name ?? (m.type === 'TRANSFER_IN' ? m.branch.name : '—')
        warehouseName = `${fromName} → ${toName}`
        const fields = transferNoteFields(m.note)
        remarks = [fields.notes !== '—' ? fields.notes : '', fields.variant !== '—' ? fields.variant : '', fields.imeis !== '—' ? `IMEI: ${fields.imeis}` : '']
          .filter(Boolean)
          .join(' · ') || '—'
      }
      return {
        id: m.id,
        dateTime: m.createdAt,
        transactionType: mapMovementLabel(m.type, m.note),
        referenceNumber: m.reference ?? '—',
        warehouseId: m.branchId,
        warehouseName,
        stockIn,
        stockOut,
        runningBalance: running,
        performedBy: m.performedBy,
        remarks,
        rawType: m.type,
      }
    })

    return { data, total, page, limit }
  },

  async getTransfers(tenantId: string, productId: string, req: Request) {
    const product = await loadProduct(tenantId, productId, req)
    const { skip, limit, page, search, branchId, from, to } = reportFilters(req)
    const relatedIds = await relatedCatalogProductIds(tenantId, product)

    const where: Prisma.StockMovementWhereInput = {
      productId: { in: relatedIds },
      type: { in: ['TRANSFER_IN', 'TRANSFER_OUT'] },
      ...movementSearch(search),
      ...dateWhereClause('createdAt', from, to),
    }

    const rows = await prisma.stockMovement.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        branch: { select: { id: true, name: true } },
        product: { select: { id: true, sku: true, name: true } },
      },
    })

    type Pair = {
      reference: string
      dateTime: Date
      out?: (typeof rows)[0]
      inn?: (typeof rows)[0]
    }
    const byRef = new Map<string, Pair>()
    for (const m of rows) {
      const key = m.reference || m.id
      const pair = byRef.get(key) ?? { reference: key, dateTime: m.createdAt }
      if (m.type === 'TRANSFER_OUT') pair.out = m
      if (m.type === 'TRANSFER_IN') pair.inn = m
      if (m.createdAt > pair.dateTime) pair.dateTime = m.createdAt
      byRef.set(key, pair)
    }

    let transfers = [...byRef.values()]
      .map(pair => {
        const out = pair.out
        const inn = pair.inn
        const sample = out ?? inn
        if (!sample) return null
        const fromBranchId = out?.branchId ?? ''
        const toBranchId = inn?.branchId ?? ''
        const fromBranchName = out?.branch.name ?? '—'
        const toBranchName = inn?.branch.name ?? '—'
        const quantity = Math.abs(out?.quantity ?? inn?.quantity ?? 0)
        const onThisProduct = sample.productId === productId
          || out?.productId === productId
          || inn?.productId === productId
        let direction: 'OUT' | 'IN' | 'MOVE' = 'MOVE'
        if (out?.productId === productId && inn?.productId === productId) direction = 'MOVE'
        else if (out?.productId === productId) direction = 'OUT'
        else if (inn?.productId === productId) direction = 'IN'
        else if (onThisProduct) direction = out ? 'OUT' : 'IN'

        const fields = transferNoteFields(sample.note)
        return {
          id: sample.id,
          reference: pair.reference,
          dateTime: pair.dateTime,
          fromBranchId,
          fromBranchName,
          toBranchId,
          toBranchName,
          quantity,
          direction,
          directionLabel:
            direction === 'OUT' ? 'Sent out'
              : direction === 'IN' ? 'Received'
                : 'Transferred',
          route: `${fromBranchName} → ${toBranchName}`,
          notes: fields.notes,
          variant: fields.variant,
          imeis: fields.imeis,
          performedBy: sample.performedBy,
          remarks: sample.note ?? '—',
        }
      })
      .filter((t): t is NonNullable<typeof t> => !!t)

    if (branchId) {
      transfers = transfers.filter(t => t.fromBranchId === branchId || t.toBranchId === branchId)
    }

    transfers.sort((a, b) => +new Date(b.dateTime) - +new Date(a.dateTime))
    const total = transfers.length
    const data = transfers.slice(skip, skip + limit)
    return { data, total, page, limit }
  },

  async getSerials(tenantId: string, productId: string, req: Request) {
    const product = await loadProduct(tenantId, productId, req)
    if (!product.trackImei) return { data: [], total: 0, page: 1, limit: 20 }

    const { skip, limit, page, search, branchId, from, to } = reportFilters(req)

    const where: Prisma.ImeiRecordWhereInput = {
      productId,
      ...(branchId ? { branchId } : {}),
      ...serialSearch(search),
      ...dateWhereClause('updatedAt', from, to),
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
    const { skip, limit, page, branchId, from, to } = reportFilters(req)

    const where: Prisma.StockMovementWhereInput = {
      productId,
      ...(branchId ? { branchId } : {}),
      ...dateWhereClause('createdAt', from, to),
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
    const transferRefs = new Set<string>()
    for (const m of rows) {
      if (m.type === 'PURCHASE' && m.reference?.includes(':')) {
        poIds.add(m.reference.split(':')[0])
      }
      if (m.type === 'SALE' && m.reference) invoiceNumbers.add(m.reference)
      if ((m.type === 'TRANSFER_IN' || m.type === 'TRANSFER_OUT') && m.reference) {
        transferRefs.add(m.reference)
      }
    }

    const [pos, sales, transferPairs] = await Promise.all([
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
      transferRefs.size
        ? prisma.stockMovement.findMany({
            where: {
              reference: { in: [...transferRefs] },
              type: { in: ['TRANSFER_IN', 'TRANSFER_OUT'] },
            },
            include: { branch: { select: { name: true } } },
          })
        : Promise.resolve([]),
    ])
    const poMap = new Map(pos.map(p => [p.id, p]))
    const saleMap = new Map(sales.map(s => [s.invoiceNumber, s]))
    const transferPairByRef = new Map<string, typeof transferPairs>()
    for (const p of transferPairs) {
      const key = p.reference ?? ''
      const list = transferPairByRef.get(key) ?? []
      list.push(p)
      transferPairByRef.set(key, list)
    }

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
        const pair = m.reference ? (transferPairByRef.get(m.reference) ?? []) : []
        const out = pair.find(p => p.type === 'TRANSFER_OUT')
        const inn = pair.find(p => p.type === 'TRANSFER_IN')
        const fromName = out?.branch.name ?? (m.type === 'TRANSFER_OUT' ? m.branch.name : '—')
        const toName = inn?.branch.name ?? (m.type === 'TRANSFER_IN' ? m.branch.name : '—')
        title = m.type === 'TRANSFER_IN'
          ? `Stock transfer received at ${m.branch.name}`
          : `Stock transfer sent from ${m.branch.name}`
        subtitle = `${fromName} → ${toName}${m.note ? ` · ${m.note}` : ''}`
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
