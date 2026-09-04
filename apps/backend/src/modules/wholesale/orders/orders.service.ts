import type { Prisma, WholesaleSellUnit } from '@prisma/client'
import { prisma } from '../../../config/database'
import { AppError } from '../../../middleware/error.middleware'
import { generateWholesaleOrderNumber } from '../../../utils/counters'
import { getAtp } from '../../inventory-engine/atp.service'
import { resolveWholesaleUnitPrice } from '../pricing/pricing.service'
import { round2, sellUnitToStockQty } from '../wholesale-uom.util'
import type { CreateOrderInput, UpdateOrderInput } from './orders.schema'

const orderInclude = {
  dealer: { select: { id: true, legalName: true, tradingName: true, dealerCode: true, totalDue: true, creditLimit: true } },
  lines: {
    orderBy: { sortOrder: 'asc' as const },
    include: { reservations: { where: { status: 'ACTIVE' as const } } },
  },
  holds: { where: { releasedAt: null }, orderBy: { createdAt: 'desc' as const } },
} satisfies Prisma.WholesaleSalesOrderInclude

async function resolveLines(
  tenantId: string,
  dealerId: string,
  lines: CreateOrderInput['lines'],
) {
  const resolved = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const sellUnit = (line.sellUnit ?? 'PIECE') as WholesaleSellUnit
    let productName = line.productName
    let sku = line.sku ?? null
    let unitPrice = line.unitPrice
    let stockQty = line.quantity
    let productId = line.productId || null

    if (productId) {
      const product = await prisma.product.findFirst({
        where: { id: productId, tenantId },
        select: {
          id: true,
          name: true,
          sku: true,
          unitsPerBox: true,
          unitsPerCarton: true,
        },
      })
      if (!product) throw new AppError(`Line ${i + 1}: product not found`, 404)
      productName = productName || product.name
      sku = sku ?? product.sku
      stockQty = sellUnitToStockQty(line.quantity, sellUnit, product)
      if (unitPrice == null) {
        const resolvedPrice = await resolveWholesaleUnitPrice({
          tenantId,
          dealerId,
          productId: product.id,
          quantity: line.quantity,
          sellUnit,
        })
        unitPrice = resolvedPrice.unitPrice
      }
    } else if (!productName) {
      throw new AppError(`Line ${i + 1}: productName required when productId is omitted`, 400)
    }
    if (unitPrice == null) throw new AppError(`Line ${i + 1}: unitPrice required`, 400)

    const discount = line.discount ?? 0
    const tax = line.tax ?? 0
    const total = round2(unitPrice * line.quantity - discount + tax)
    resolved.push({
      productId,
      productName: productName!,
      sku,
      quantity: line.quantity,
      sellUnit,
      stockQty,
      unitPrice,
      discount,
      tax,
      total,
      sortOrder: i,
      notes: line.notes ?? null,
    })
  }
  return resolved
}

function totalsFromLines(
  lines: Array<{ unitPrice: number; quantity: number; discount: number; tax: number }>,
  headerDiscount = 0,
  headerTax = 0,
) {
  const subtotal = round2(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0))
  const discount = round2(lines.reduce((s, l) => s + l.discount, 0) + headerDiscount)
  const tax = round2(lines.reduce((s, l) => s + l.tax, 0) + headerTax)
  const total = round2(subtotal - discount + tax)
  return { subtotal, discount, tax, total }
}

export async function listOrders(
  tenantId: string,
  opts: { skip: number; limit: number; search?: string; status?: string; dealerId?: string },
) {
  const where: Prisma.WholesaleSalesOrderWhereInput = {
    tenantId,
    ...(opts.status ? { status: opts.status as never } : {}),
    ...(opts.dealerId ? { dealerId: opts.dealerId } : {}),
    ...(opts.search
      ? {
          OR: [
            { orderNumber: { contains: opts.search, mode: 'insensitive' } },
            { dealer: { legalName: { contains: opts.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  }
  const [data, total] = await Promise.all([
    prisma.wholesaleSalesOrder.findMany({
      where,
      skip: opts.skip,
      take: opts.limit,
      orderBy: { createdAt: 'desc' },
      include: orderInclude,
    }),
    prisma.wholesaleSalesOrder.count({ where }),
  ])
  return { data, total }
}

export async function getOrder(tenantId: string, id: string) {
  const row = await prisma.wholesaleSalesOrder.findFirst({
    where: { id, tenantId },
    include: orderInclude,
  })
  if (!row) throw new AppError('Sales order not found', 404)
  return row
}

export async function createOrder(
  tenantId: string,
  input: CreateOrderInput,
  createdById?: string | null,
) {
  const dealer = await prisma.dealer.findFirst({ where: { id: input.dealerId, tenantId } })
  if (!dealer) throw new AppError('Dealer not found', 404)
  if (dealer.status !== 'ACTIVE') {
    throw new AppError(`Dealer is ${dealer.status}; only ACTIVE dealers can order`, 400)
  }

  const lines = await resolveLines(tenantId, input.dealerId, input.lines)
  const totals = totalsFromLines(lines, input.discount ?? 0, input.tax ?? 0)
  const orderNumber = await generateWholesaleOrderNumber(tenantId)

  return prisma.wholesaleSalesOrder.create({
    data: {
      tenantId,
      branchId: input.branchId || null,
      orderNumber,
      status: 'DRAFT',
      dealerId: input.dealerId,
      quotationId: input.quotationId || null,
      requestedDate: input.requestedDate ? new Date(input.requestedDate) : null,
      notes: input.notes || null,
      createdById: createdById || null,
      ...totals,
      lines: { create: lines },
    },
    include: orderInclude,
  })
}

export async function updateOrder(tenantId: string, id: string, input: UpdateOrderInput) {
  const existing = await getOrder(tenantId, id)
  if (existing.status !== 'DRAFT') {
    throw new AppError(`Only DRAFT orders can be edited (got ${existing.status})`, 400)
  }

  const dealerId = input.dealerId || existing.dealerId
  const lines = input.lines
    ? await resolveLines(tenantId, dealerId, input.lines)
    : existing.lines.map((l) => ({
        productId: l.productId,
        productName: l.productName,
        sku: l.sku,
        quantity: l.quantity,
        sellUnit: l.sellUnit,
        stockQty: l.stockQty,
        unitPrice: l.unitPrice,
        discount: l.discount,
        tax: l.tax,
        total: l.total,
        sortOrder: l.sortOrder,
        notes: l.notes,
      }))
  const totals = totalsFromLines(lines, input.discount ?? 0, input.tax ?? 0)

  return prisma.$transaction(async (tx) => {
    if (input.lines) {
      await tx.wholesaleSalesOrderLine.deleteMany({ where: { salesOrderId: id } })
      await tx.wholesaleSalesOrderLine.createMany({
        data: lines.map((l) => ({ ...l, salesOrderId: id })),
      })
    }
    return tx.wholesaleSalesOrder.update({
      where: { id },
      data: {
        ...(input.dealerId !== undefined ? { dealerId: input.dealerId } : {}),
        ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
        ...(input.requestedDate !== undefined
          ? { requestedDate: input.requestedDate ? new Date(input.requestedDate) : null }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...totals,
      },
      include: orderInclude,
    })
  })
}

export async function submitOrder(tenantId: string, id: string) {
  const order = await getOrder(tenantId, id)
  if (order.status !== 'DRAFT') {
    throw new AppError(`Only DRAFT orders can be submitted (got ${order.status})`, 400)
  }
  if (!order.lines.length) throw new AppError('Order has no lines', 400)
  return prisma.wholesaleSalesOrder.update({
    where: { id },
    data: { status: 'SUBMITTED' },
    include: orderInclude,
  })
}

/**
 * Confirm order: ATP check + create StockReservation rows per line.
 */
export async function confirmOrder(tenantId: string, id: string) {
  const order = await getOrder(tenantId, id)
  if (order.status !== 'SUBMITTED' && order.status !== 'ON_HOLD') {
    throw new AppError(`Only SUBMITTED/ON_HOLD orders can be confirmed (got ${order.status})`, 400)
  }
  const openHolds = order.holds.filter((h) => !h.releasedAt)
  if (openHolds.length) {
    throw new AppError('Release open holds before confirming', 400)
  }
  if (!order.branchId) throw new AppError('Order branchId is required to reserve stock', 400)

  const dealer = await prisma.dealer.findFirst({ where: { id: order.dealerId, tenantId } })
  if (!dealer || dealer.status !== 'ACTIVE') {
    throw new AppError('Dealer must be ACTIVE to confirm', 400)
  }
  if (!dealer.cashOnly && dealer.creditLimit > 0 && dealer.totalDue + order.total > dealer.creditLimit + 0.001) {
    await prisma.wholesaleOrderHold.create({
      data: {
        salesOrderId: id,
        type: 'CREDIT',
        reason: `Credit limit ${dealer.creditLimit}; due ${dealer.totalDue}; order ${order.total}`,
      },
    })
    return prisma.wholesaleSalesOrder.update({
      where: { id },
      data: { status: 'ON_HOLD' },
      include: orderInclude,
    })
  }

  await prisma.$transaction(async (tx) => {
    for (const line of order.lines) {
      if (!line.productId || line.stockQty <= 0) continue
      const atp = await getAtp(tx, {
        productId: line.productId,
        branchId: order.branchId!,
        sku: line.sku,
      })
      if (atp < line.stockQty) {
        throw new AppError(
          `Insufficient ATP for "${line.productName}". Available: ${atp}, required: ${line.stockQty}`,
          400,
        )
      }
      await tx.stockReservation.create({
        data: {
          tenantId,
          productId: line.productId,
          branchId: order.branchId!,
          orderLineId: line.id,
          quantity: line.stockQty,
          sku: line.sku,
          status: 'ACTIVE',
        },
      })
    }

    await tx.wholesaleSalesOrder.update({
      where: { id },
      data: { status: 'CONFIRMED', confirmedAt: new Date() },
    })
  })

  return getOrder(tenantId, id)
}

export async function placeHold(
  tenantId: string,
  id: string,
  type: 'CREDIT' | 'MOQ' | 'STOCK' | 'MANUAL' | 'PRICE',
  reason?: string | null,
) {
  await getOrder(tenantId, id)
  await prisma.wholesaleOrderHold.create({
    data: { salesOrderId: id, type, reason: reason || null },
  })
  return prisma.wholesaleSalesOrder.update({
    where: { id },
    data: { status: 'ON_HOLD' },
    include: orderInclude,
  })
}

export async function releaseHold(tenantId: string, id: string, holdId?: string, releasedBy?: string) {
  const order = await getOrder(tenantId, id)
  const open = order.holds.filter((h) => !h.releasedAt)
  if (!open.length) throw new AppError('No open holds', 400)

  const targets = holdId ? open.filter((h) => h.id === holdId) : open
  if (!targets.length) throw new AppError('Hold not found', 404)

  await prisma.wholesaleOrderHold.updateMany({
    where: { id: { in: targets.map((h) => h.id) } },
    data: { releasedAt: new Date(), releasedBy: releasedBy || null },
  })

  const remaining = await prisma.wholesaleOrderHold.count({
    where: { salesOrderId: id, releasedAt: null },
  })
  if (remaining === 0 && order.status === 'ON_HOLD') {
    return prisma.wholesaleSalesOrder.update({
      where: { id },
      data: { status: 'SUBMITTED' },
      include: orderInclude,
    })
  }
  return getOrder(tenantId, id)
}

export async function releaseReservationsForOrder(
  tx: Prisma.TransactionClient,
  salesOrderId: string,
  toStatus: 'RELEASED' | 'CONSUMED' = 'RELEASED',
) {
  const lines = await tx.wholesaleSalesOrderLine.findMany({
    where: { salesOrderId },
    select: { id: true },
  })
  if (!lines.length) return 0
  const result = await tx.stockReservation.updateMany({
    where: {
      orderLineId: { in: lines.map((l) => l.id) },
      status: 'ACTIVE',
    },
    data: { status: toStatus },
  })
  return result.count
}

export async function cancelOrder(tenantId: string, id: string) {
  const order = await getOrder(tenantId, id)
  if (order.status === 'FULFILLED' || order.status === 'CANCELLED' || order.status === 'CLOSED') {
    throw new AppError(`Cannot cancel order in status ${order.status}`, 400)
  }

  await prisma.$transaction(async (tx) => {
    await releaseReservationsForOrder(tx, id, 'RELEASED')
    await tx.wholesaleSalesOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    })
  })
  return getOrder(tenantId, id)
}

/** Manual reserve for a confirmed order line (top-up / re-reserve). */
export async function reserveOrderLine(
  tenantId: string,
  orderId: string,
  lineId: string,
  quantity?: number,
) {
  const order = await getOrder(tenantId, orderId)
  if (!order.branchId) throw new AppError('Order branchId required', 400)
  if (order.status !== 'CONFIRMED' && order.status !== 'PARTIAL') {
    throw new AppError('Order must be CONFIRMED or PARTIAL to reserve', 400)
  }
  const line = order.lines.find((l) => l.id === lineId)
  if (!line) throw new AppError('Order line not found', 404)
  if (!line.productId) throw new AppError('Line has no product', 400)

  const qty = quantity ?? line.stockQty
  const atp = await getAtp(prisma, {
    productId: line.productId,
    branchId: order.branchId,
    sku: line.sku,
  })
  if (atp < qty) {
    throw new AppError(`Insufficient ATP. Available: ${atp}, requested: ${qty}`, 400)
  }

  return prisma.stockReservation.create({
    data: {
      tenantId,
      productId: line.productId,
      branchId: order.branchId,
      orderLineId: line.id,
      quantity: qty,
      sku: line.sku,
      status: 'ACTIVE',
    },
  })
}

export async function releaseOrderReservations(tenantId: string, orderId: string) {
  await getOrder(tenantId, orderId)
  const count = await prisma.$transaction(async (tx) => releaseReservationsForOrder(tx, orderId, 'RELEASED'))
  return { released: count }
}
