import type { Prisma, WholesaleSellUnit } from '@prisma/client'
import { prisma } from '../../../config/database'
import { AppError } from '../../../middleware/error.middleware'
import { generateWholesaleQuoteNumber } from '../../../utils/counters'
import { resolveWholesaleUnitPrice } from '../pricing/pricing.service'
import { round2, sellUnitToStockQty } from '../wholesale-uom.util'
import * as ordersService from '../orders/orders.service'
import type { CreateQuotationInput, UpdateQuotationInput } from './quotations.schema'

const quoteInclude = {
  dealer: { select: { id: true, legalName: true, tradingName: true, dealerCode: true } },
  lines: { orderBy: { sortOrder: 'asc' as const } },
} satisfies Prisma.WholesaleQuotationInclude

async function resolveLines(
  tenantId: string,
  dealerId: string,
  lines: CreateQuotationInput['lines'],
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
  lines: Array<{ unitPrice: number; quantity: number; discount: number; tax: number; total: number }>,
  headerDiscount = 0,
  headerTax = 0,
) {
  const subtotal = round2(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0))
  const discount = round2(lines.reduce((s, l) => s + l.discount, 0) + headerDiscount)
  const tax = round2(lines.reduce((s, l) => s + l.tax, 0) + headerTax)
  const total = round2(subtotal - discount + tax)
  return { subtotal, discount, tax, total }
}

export async function listQuotations(
  tenantId: string,
  opts: { skip: number; limit: number; search?: string; status?: string; dealerId?: string },
) {
  const where: Prisma.WholesaleQuotationWhereInput = {
    tenantId,
    ...(opts.status ? { status: opts.status as never } : {}),
    ...(opts.dealerId ? { dealerId: opts.dealerId } : {}),
    ...(opts.search
      ? {
          OR: [
            { quoteNumber: { contains: opts.search, mode: 'insensitive' } },
            { dealer: { legalName: { contains: opts.search, mode: 'insensitive' } } },
            { dealer: { tradingName: { contains: opts.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  }
  const [data, total] = await Promise.all([
    prisma.wholesaleQuotation.findMany({
      where,
      skip: opts.skip,
      take: opts.limit,
      orderBy: { createdAt: 'desc' },
      include: quoteInclude,
    }),
    prisma.wholesaleQuotation.count({ where }),
  ])
  return { data, total }
}

export async function getQuotation(tenantId: string, id: string) {
  const row = await prisma.wholesaleQuotation.findFirst({
    where: { id, tenantId },
    include: quoteInclude,
  })
  if (!row) throw new AppError('Quotation not found', 404)
  return row
}

export async function createQuotation(
  tenantId: string,
  input: CreateQuotationInput,
  createdById?: string | null,
) {
  const dealer = await prisma.dealer.findFirst({ where: { id: input.dealerId, tenantId } })
  if (!dealer) throw new AppError('Dealer not found', 404)

  const lines = await resolveLines(tenantId, input.dealerId, input.lines)
  const totals = totalsFromLines(lines, input.discount ?? 0, input.tax ?? 0)
  const quoteNumber = await generateWholesaleQuoteNumber(tenantId)

  return prisma.wholesaleQuotation.create({
    data: {
      tenantId,
      branchId: input.branchId || null,
      quoteNumber,
      version: 1,
      status: 'DRAFT',
      dealerId: input.dealerId,
      validityEnd: input.validityEnd ? new Date(input.validityEnd) : null,
      notes: input.notes || null,
      createdById: createdById || null,
      ...totals,
      lines: { create: lines },
    },
    include: quoteInclude,
  })
}

export async function updateQuotation(tenantId: string, id: string, input: UpdateQuotationInput) {
  const existing = await getQuotation(tenantId, id)
  if (existing.status !== 'DRAFT' && existing.status !== 'ISSUED') {
    throw new AppError(`Cannot edit quotation in status ${existing.status}`, 400)
  }
  if (existing.status === 'ISSUED') {
    throw new AppError('Issued quotations cannot be edited; use revise', 400)
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
      await tx.wholesaleQuotationLine.deleteMany({ where: { quotationId: id } })
      await tx.wholesaleQuotationLine.createMany({
        data: lines.map((l) => ({ ...l, quotationId: id })),
      })
    }
    return tx.wholesaleQuotation.update({
      where: { id },
      data: {
        ...(input.dealerId !== undefined ? { dealerId: input.dealerId } : {}),
        ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
        ...(input.validityEnd !== undefined
          ? { validityEnd: input.validityEnd ? new Date(input.validityEnd) : null }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...totals,
      },
      include: quoteInclude,
    })
  })
}

export async function issueQuotation(tenantId: string, id: string) {
  const q = await getQuotation(tenantId, id)
  if (q.status !== 'DRAFT') throw new AppError(`Only DRAFT quotations can be issued (got ${q.status})`, 400)
  if (!q.lines.length) throw new AppError('Quotation has no lines', 400)
  return prisma.wholesaleQuotation.update({
    where: { id },
    data: { status: 'ISSUED', issuedAt: new Date() },
    include: quoteInclude,
  })
}

export async function acceptQuotation(tenantId: string, id: string, createdById?: string | null) {
  const q = await getQuotation(tenantId, id)
  if (q.status !== 'ISSUED') throw new AppError(`Only ISSUED quotations can be accepted (got ${q.status})`, 400)
  if (q.validityEnd && q.validityEnd < new Date()) {
    await prisma.wholesaleQuotation.update({ where: { id }, data: { status: 'EXPIRED' } })
    throw new AppError('Quotation has expired', 400)
  }

  const order = await ordersService.createOrder(
    tenantId,
    {
      dealerId: q.dealerId,
      branchId: q.branchId,
      quotationId: q.id,
      notes: q.notes,
      lines: q.lines.map((l) => ({
        productId: l.productId,
        productName: l.productName,
        sku: l.sku,
        quantity: l.quantity,
        sellUnit: l.sellUnit,
        unitPrice: l.unitPrice,
        discount: l.discount,
        tax: l.tax,
        notes: l.notes,
      })),
    },
    createdById,
  )

  const updated = await prisma.wholesaleQuotation.update({
    where: { id },
    data: {
      status: 'CONVERTED',
      acceptedAt: new Date(),
      convertedOrderId: order.id,
    },
    include: quoteInclude,
  })
  return { quotation: updated, salesOrder: order }
}

export async function rejectQuotation(tenantId: string, id: string, reason?: string) {
  const q = await getQuotation(tenantId, id)
  if (q.status !== 'ISSUED' && q.status !== 'DRAFT') {
    throw new AppError(`Cannot reject quotation in status ${q.status}`, 400)
  }
  return prisma.wholesaleQuotation.update({
    where: { id },
    data: {
      status: 'REJECTED',
      rejectedAt: new Date(),
      notes: reason ? `${q.notes ? q.notes + '\n' : ''}Rejected: ${reason}` : q.notes,
    },
    include: quoteInclude,
  })
}

/** Clone as new DRAFT version (supersedes issued quote). */
export async function reviseQuotation(tenantId: string, id: string, createdById?: string | null) {
  const q = await getQuotation(tenantId, id)
  if (q.status !== 'ISSUED' && q.status !== 'REJECTED' && q.status !== 'EXPIRED') {
    throw new AppError(`Only ISSUED/REJECTED/EXPIRED quotations can be revised (got ${q.status})`, 400)
  }

  const nextVersion = q.version + 1
  const created = await prisma.wholesaleQuotation.create({
    data: {
      tenantId,
      branchId: q.branchId,
      quoteNumber: q.quoteNumber,
      version: nextVersion,
      status: 'DRAFT',
      dealerId: q.dealerId,
      validityEnd: q.validityEnd,
      subtotal: q.subtotal,
      discount: q.discount,
      tax: q.tax,
      total: q.total,
      notes: q.notes,
      createdById: createdById || null,
      lines: {
        create: q.lines.map((l) => ({
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
        })),
      },
    },
    include: quoteInclude,
  })

  // Mark prior version cancelled so only one active revision path remains
  if (q.status === 'ISSUED') {
    await prisma.wholesaleQuotation.update({
      where: { id: q.id },
      data: { status: 'CANCELLED' },
    })
  }

  return created
}
