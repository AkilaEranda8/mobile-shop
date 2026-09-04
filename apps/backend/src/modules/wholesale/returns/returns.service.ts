import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database'
import { AppError } from '../../../middleware/error.middleware'
import {
  generateWholesaleCreditNoteNumber,
  generateWholesaleReturnNumber,
} from '../../../utils/counters'
import { emitWholesaleCreditNoteAccounting } from '../sale/wholesale-accounting'
import { round2 } from '../wholesale-uom.util'
import type { CreateReturnInput, DispositionInput } from './returns.schema'

const returnInclude = {
  dealer: { select: { id: true, legalName: true, tradingName: true } },
  invoice: { select: { id: true, invoiceNumber: true, total: true } },
  lines: { orderBy: { sortOrder: 'asc' as const } },
  creditNotes: true,
} satisfies Prisma.WholesaleReturnInclude

export async function listReturns(
  tenantId: string,
  opts: { skip: number; limit: number; status?: string; dealerId?: string },
) {
  const where: Prisma.WholesaleReturnWhereInput = {
    tenantId,
    ...(opts.status ? { status: opts.status as never } : {}),
    ...(opts.dealerId ? { dealerId: opts.dealerId } : {}),
  }
  const [data, total] = await Promise.all([
    prisma.wholesaleReturn.findMany({
      where,
      skip: opts.skip,
      take: opts.limit,
      orderBy: { createdAt: 'desc' },
      include: returnInclude,
    }),
    prisma.wholesaleReturn.count({ where }),
  ])
  return { data, total }
}

export async function getReturn(tenantId: string, id: string) {
  const row = await prisma.wholesaleReturn.findFirst({
    where: { id, tenantId },
    include: returnInclude,
  })
  if (!row) throw new AppError('Return not found', 404)
  return row
}

export async function createReturn(tenantId: string, input: CreateReturnInput) {
  const dealer = await prisma.dealer.findFirst({ where: { id: input.dealerId, tenantId } })
  if (!dealer) throw new AppError('Dealer not found', 404)
  if (!input.branchId) throw new AppError('branchId is required', 400)

  if (input.invoiceId) {
    const inv = await prisma.wholesaleInvoice.findFirst({
      where: { id: input.invoiceId, tenantId, dealerId: input.dealerId },
    })
    if (!inv) throw new AppError('Invoice not found for dealer', 404)
  }

  const lines = []
  for (let i = 0; i < input.lines.length; i++) {
    const line = input.lines[i]
    let productName = line.productName
    let sku = line.sku ?? null
    let unitPrice = line.unitPrice ?? 0
    if (line.productId) {
      const product = await prisma.product.findFirst({
        where: { id: line.productId, tenantId },
        select: { id: true, name: true, sku: true, wholesalePrice: true },
      })
      if (!product) throw new AppError(`Line ${i + 1}: product not found`, 404)
      productName = productName || product.name
      sku = sku ?? product.sku
      if (line.unitPrice == null) unitPrice = Number(product.wholesalePrice) || 0
    }
    if (!productName) throw new AppError(`Line ${i + 1}: productName required`, 400)
    const total = round2(unitPrice * line.quantity)
    lines.push({
      productId: line.productId || null,
      productName,
      sku,
      quantity: line.quantity,
      unitPrice,
      total,
      imei: line.imei || null,
      disposition: line.disposition ?? 'RESTOCK',
      sortOrder: i,
    })
  }

  const returnNumber = await generateWholesaleReturnNumber(tenantId)
  return prisma.wholesaleReturn.create({
    data: {
      tenantId,
      branchId: input.branchId,
      returnNumber,
      dealerId: input.dealerId,
      invoiceId: input.invoiceId || null,
      status: 'DRAFT',
      reason: input.reason || null,
      notes: input.notes || null,
      lines: { create: lines },
    },
    include: returnInclude,
  })
}

/** Approve / submit return request → RECEIVED waiting QC. */
export async function approveReturn(tenantId: string, id: string) {
  const row = await getReturn(tenantId, id)
  if (row.status !== 'DRAFT') throw new AppError(`Only DRAFT returns can be approved (got ${row.status})`, 400)
  return prisma.wholesaleReturn.update({
    where: { id },
    data: { status: 'RECEIVED', receivedAt: new Date() },
    include: returnInclude,
  })
}

export async function receiveQc(tenantId: string, id: string) {
  const row = await getReturn(tenantId, id)
  if (row.status !== 'RECEIVED') throw new AppError(`Return must be RECEIVED for QC (got ${row.status})`, 400)
  return prisma.wholesaleReturn.update({
    where: { id },
    data: { status: 'QC' },
    include: returnInclude,
  })
}

export async function setDisposition(tenantId: string, id: string, input: DispositionInput) {
  const row = await getReturn(tenantId, id)
  if (row.status !== 'QC' && row.status !== 'RECEIVED') {
    throw new AppError(`Disposition requires RECEIVED/QC status (got ${row.status})`, 400)
  }
  await prisma.$transaction(async (tx) => {
    for (const item of input.lines) {
      const line = row.lines.find((l) => l.id === item.returnLineId)
      if (!line) throw new AppError(`Return line ${item.returnLineId} not found`, 404)
      await tx.wholesaleReturnLine.update({
        where: { id: item.returnLineId },
        data: { disposition: item.disposition },
      })
    }
    await tx.wholesaleReturn.update({ where: { id }, data: { status: 'QC' } })
  })
  return getReturn(tenantId, id)
}

/**
 * Create credit note + restock RESTOCK lines via stock increment + WHOLESALE_RETURN movement.
 */
export async function createCreditNote(
  tenantId: string,
  returnId: string,
  actor: { email?: string; performedBy: string },
) {
  const row = await getReturn(tenantId, returnId)
  if (row.status !== 'QC') throw new AppError(`Credit note requires QC status (got ${row.status})`, 400)
  if (row.creditNotes.length) throw new AppError('Credit note already exists for this return', 400)

  const subtotal = round2(row.lines.reduce((s, l) => s + l.total, 0))
  const creditNoteNumber = await generateWholesaleCreditNoteNumber(tenantId)

  const result = await prisma.$transaction(async (tx) => {
    const cn = await tx.wholesaleCreditNote.create({
      data: {
        tenantId,
        branchId: row.branchId,
        creditNoteNumber,
        dealerId: row.dealerId,
        invoiceId: row.invoiceId,
        returnId: row.id,
        status: 'POSTED',
        subtotal,
        tax: 0,
        total: subtotal,
        reason: row.reason,
        notes: row.notes,
        postedAt: new Date(),
        lines: {
          create: row.lines.map((l, idx) => ({
            productId: l.productId,
            productName: l.productName,
            sku: l.sku,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            total: l.total,
            sortOrder: idx,
          })),
        },
      },
      include: { lines: true },
    })

    for (const line of row.lines) {
      if (line.disposition !== 'RESTOCK' || !line.productId) continue
      const qty = Number(line.quantity)
      const updated = await tx.product.updateMany({
        where: { id: line.productId, branchId: row.branchId },
        data: { stock: { increment: qty } },
      })
      if (updated.count === 0) {
        throw new AppError(`Product ${line.productName} not found at return branch for restock`, 400)
      }
      await tx.stockMovement.create({
        data: {
          productId: line.productId,
          branchId: row.branchId,
          type: 'WHOLESALE_RETURN' as never,
          quantity: Math.round(qty),
          reference: creditNoteNumber,
          performedBy: actor.performedBy,
        },
      })

      if (line.imei) {
        await tx.imeiRecord.updateMany({
          where: { imei: line.imei },
          data: {
            status: 'IN_STOCK',
            saleId: null,
            customerId: null,
            branchId: row.branchId,
            softReservedUntil: null,
            softReservedBy: null,
          },
        })
      }
    }

    // Reduce dealer AR
    if (subtotal > 0) {
      await tx.dealer.update({
        where: { id: row.dealerId },
        data: { totalDue: { decrement: subtotal } },
      })
      if (row.invoiceId) {
        const inv = await tx.wholesaleInvoice.findUnique({ where: { id: row.invoiceId } })
        if (inv) {
          const newDue = Math.max(0, inv.dueAmount - subtotal)
          const newPaid = inv.paidAmount
          await tx.wholesaleInvoice.update({
            where: { id: inv.id },
            data: {
              dueAmount: newDue,
              status: newDue <= 0.001 ? 'PAID' : newPaid > 0 ? 'PARTIAL' : inv.status,
            },
          })
        }
      }
    }

    await tx.wholesaleReturn.update({
      where: { id: returnId },
      data: { status: 'CREDITED' },
    })

    return cn
  })

  await emitWholesaleCreditNoteAccounting({
    tenantId,
    branchId: row.branchId,
    creditNoteId: result.id,
    creditNoteNumber: result.creditNoteNumber,
    total: result.total,
    actorEmail: actor.email,
  })

  return { creditNote: result, return: await getReturn(tenantId, returnId) }
}

export async function closeReturn(tenantId: string, id: string) {
  const row = await getReturn(tenantId, id)
  if (row.status !== 'CREDITED') throw new AppError('Return must be CREDITED before close', 400)
  return prisma.wholesaleReturn.update({
    where: { id },
    data: { status: 'CLOSED' },
    include: returnInclude,
  })
}
