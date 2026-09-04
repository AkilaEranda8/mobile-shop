import {
  Prisma,
  type PaymentMethod,
  type WholesaleInvoiceChannel,
  type WholesaleInvoiceStatus,
  type WholesaleSellUnit,
} from '@prisma/client'
import { prisma } from '../../../config/database'
import { AppError } from '../../../middleware/error.middleware'
import { generateWholesaleInvoiceNumber } from '../../../utils/counters'
import { consumeImei, consumeStock } from '../../inventory-engine/inventory-engine.stock'
import { getAtp } from '../../inventory-engine/atp.service'
import { resolveWholesaleUnitPrice } from '../pricing/pricing.service'
import { round2, sellUnitToStockQty } from '../wholesale-uom.util'
import { emitWholesaleInvoiceAccounting } from './wholesale-accounting'

export type WholesaleSaleLineInput = {
  productId: string
  quantity: number
  sellUnit?: WholesaleSellUnit | string
  sku?: string | null
  imei?: string | null
  /** Manual override — caller must enforce WHOLESALE_PRICING_ADMIN before setting. */
  unitPrice?: number | null
  discount?: number | null
}

export type WholesaleSalePaymentInput = {
  method: PaymentMethod | string
  amount: number
  reference?: string | null
}

export type CreateWholesaleInvoiceInput = {
  tenantId: string
  channel: WholesaleInvoiceChannel | 'COUNTER' | 'VAN' | 'DELIVERY'
  dealerId: string
  fulfillmentBranchId: string
  salesRepId?: string | null
  vehicleId?: string | null
  visitId?: string | null
  salesOrderId?: string | null
  deliveryStopId?: string | null
  notes?: string | null
  lines: WholesaleSaleLineInput[]
  payments: WholesaleSalePaymentInput[]
  performedBy: string
  actorUserId?: string | null
  actorEmail?: string | null
}

function invoiceStatus(paid: number, total: number): WholesaleInvoiceStatus {
  if (paid >= total - 0.001) return 'PAID'
  if (paid > 0.001) return 'PARTIAL'
  return 'POSTED'
}

export async function createWholesaleInvoice(input: CreateWholesaleInvoiceInput) {
  if (!input.lines?.length) throw new AppError('At least one line is required', 400)
  if (!input.payments?.length) throw new AppError('At least one payment is required', 400)

  const dealer = await prisma.dealer.findFirst({
    where: { id: input.dealerId, tenantId: input.tenantId },
  })
  if (!dealer) throw new AppError('Dealer not found', 404)
  if (dealer.status !== 'ACTIVE') {
    throw new AppError(`Dealer is ${dealer.status}; only ACTIVE dealers can be invoiced`, 400)
  }
  if (!dealer.isActive) throw new AppError('Dealer is inactive', 400)

  const branch = await prisma.branch.findFirst({
    where: { id: input.fulfillmentBranchId, tenantId: input.tenantId },
    select: { id: true },
  })
  if (!branch) throw new AppError('Fulfillment branch not found', 404)

  type ResolvedLine = {
    productId: string
    productName: string
    sku: string | null
    quantity: number
    sellUnit: WholesaleSellUnit
    stockQty: number
    unitPrice: number
    unitCost: number
    discount: number
    total: number
    imei: string | null
    trackImei: boolean
  }

  const resolvedLines: ResolvedLine[] = []
  for (let i = 0; i < input.lines.length; i++) {
    const line = input.lines[i]
    const sellUnit = (line.sellUnit ?? 'PIECE') as WholesaleSellUnit
    const qty = Number(line.quantity)
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new AppError(`Line ${i + 1}: quantity must be positive`, 400)
    }

    const product = await prisma.product.findFirst({
      where: { id: line.productId, tenantId: input.tenantId },
      select: {
        id: true,
        name: true,
        sku: true,
        buyingPrice: true,
        wholesalePrice: true,
        unitsPerBox: true,
        unitsPerCarton: true,
        trackImei: true,
        branchId: true,
      },
    })
    if (!product) throw new AppError(`Line ${i + 1}: product not found`, 404)

    let unitPrice: number
    if (line.unitPrice != null && Number(line.unitPrice) >= 0) {
      // Caller is responsible for WHOLESALE_PRICING_ADMIN check
      unitPrice = Number(line.unitPrice)
    } else {
      const resolved = await resolveWholesaleUnitPrice({
        tenantId: input.tenantId,
        dealerId: input.dealerId,
        productId: product.id,
        quantity: qty,
        sellUnit,
      })
      unitPrice = resolved.unitPrice
    }

    const stockQty = sellUnitToStockQty(qty, sellUnit, product)
    const discount = Math.max(0, Number(line.discount ?? 0))
    const lineTotal = round2(unitPrice * qty - discount)

    if (product.trackImei || line.imei) {
      if (!line.imei) {
        throw new AppError(`Line ${i + 1}: IMEI required for "${product.name}"`, 400)
      }
      if (stockQty !== 1 && qty !== 1) {
        throw new AppError(`Line ${i + 1}: IMEI lines must be quantity 1 piece`, 400)
      }
    }

    const atp = await getAtp(prisma, {
      productId: product.id,
      branchId: input.fulfillmentBranchId,
      sku: line.sku,
    })
    if (atp < stockQty) {
      throw new AppError(
        `Insufficient ATP for "${product.name}". Available: ${atp}, requested stock qty: ${stockQty}`,
        400,
      )
    }

    resolvedLines.push({
      productId: product.id,
      productName: product.name,
      sku: line.sku ?? product.sku,
      quantity: qty,
      sellUnit,
      stockQty,
      unitPrice,
      unitCost: Number(product.buyingPrice) || 0,
      discount,
      total: lineTotal,
      imei: line.imei ?? null,
      trackImei: product.trackImei,
    })
  }

  const subtotal = round2(resolvedLines.reduce((s, l) => s + l.unitPrice * l.quantity, 0))
  const discount = round2(resolvedLines.reduce((s, l) => s + l.discount, 0))
  const tax = 0
  const total = round2(subtotal - discount + tax)

  // CREDIT = on-account (increases AR / due); only non-credit methods count as paid.
  const cashPaid = round2(
    input.payments
      .filter((p) => String(p.method).toUpperCase() !== 'CREDIT')
      .reduce((s, p) => s + Number(p.amount), 0),
  )
  if (cashPaid < 0) throw new AppError('Payment amounts cannot be negative', 400)
  if (cashPaid > total + 0.01) {
    throw new AppError('Non-credit payments exceed invoice total', 400)
  }
  // Align CREDIT payment row(s) to remaining due so stored payments match invoice.
  const dueAmount = round2(Math.max(0, total - cashPaid))
  const paidAmount = cashPaid
  const status = invoiceStatus(paidAmount, total)

  const normalizedPayments = input.payments.map((p) => ({
    method: String(p.method).toUpperCase() as PaymentMethod,
    amount: Number(p.amount),
    reference: p.reference || null,
  }))
  if (dueAmount > 0.001) {
    const creditIdx = normalizedPayments.findIndex((p) => p.method === 'CREDIT')
    if (creditIdx >= 0) {
      normalizedPayments[creditIdx] = { ...normalizedPayments[creditIdx], amount: dueAmount }
    } else {
      normalizedPayments.push({ method: 'CREDIT' as PaymentMethod, amount: dueAmount, reference: 'ON_ACCOUNT' })
    }
  } else {
    // Drop zero-value CREDIT stubs
    for (let i = normalizedPayments.length - 1; i >= 0; i--) {
      if (normalizedPayments[i].method === 'CREDIT') normalizedPayments.splice(i, 1)
    }
  }

  // Re-check credit limit against actual due
  if (dueAmount > 0) {
    if (dealer.cashOnly) throw new AppError('Dealer is cash-only; CREDIT not allowed', 400)
    const projectedDue = round2(dealer.totalDue + dueAmount)
    if (dealer.creditLimit > 0 && projectedDue > dealer.creditLimit + 0.001) {
      throw new AppError(
        `Credit limit exceeded. Limit: ${dealer.creditLimit}, current due: ${dealer.totalDue}, new credit: ${dueAmount}`,
        400,
      )
    }
  }

  const invoiceNumber = await generateWholesaleInvoiceNumber(input.tenantId)

  const invoice = await prisma.$transaction(async (tx) => {
    const created = await tx.wholesaleInvoice.create({
      data: {
        tenantId: input.tenantId,
        channel: input.channel as WholesaleInvoiceChannel,
        invoiceNumber,
        dealerId: input.dealerId,
        fulfillmentBranchId: input.fulfillmentBranchId,
        salesOrderId: input.salesOrderId || null,
        deliveryStopId: input.deliveryStopId || null,
        vehicleId: input.vehicleId || null,
        visitId: input.visitId || null,
        salesRepId: input.salesRepId || null,
        subtotal,
        discount,
        tax,
        total,
        paidAmount,
        dueAmount,
        status,
        notes: input.notes || null,
        postedAt: new Date(),
        lines: {
          create: resolvedLines.map((l, idx) => ({
            productId: l.productId,
            productName: l.productName,
            sku: l.sku,
            quantity: l.quantity,
            sellUnit: l.sellUnit,
            stockQty: l.stockQty,
            unitPrice: l.unitPrice,
            unitCost: l.unitCost,
            discount: l.discount,
            total: l.total,
            imei: l.imei,
            sortOrder: idx,
          })),
        },
        payments: {
          create: normalizedPayments.map((p) => ({
            method: p.method,
            amount: p.amount,
            reference: p.reference,
            paidAt: new Date(),
          })),
        },
      },
      include: { lines: true, payments: true },
    })

    for (const line of resolvedLines) {
      if (line.imei) {
        await consumeImei(tx, {
          imei: line.imei,
          wholesaleInvoiceId: created.id,
          dealerId: input.dealerId,
          branchId: input.fulfillmentBranchId,
          reservedBy: input.actorUserId || input.performedBy,
        })
      }

      await consumeStock(tx, {
        productId: line.productId,
        branchId: input.fulfillmentBranchId,
        quantity: line.stockQty,
        sku: line.sku,
        performedBy: input.performedBy,
        reference: created.invoiceNumber,
        movementType: 'WHOLESALE_DISPATCH',
        productName: line.productName,
      })
    }

    if (dueAmount > 0) {
      await tx.dealer.update({
        where: { id: input.dealerId },
        data: { totalDue: { increment: dueAmount } },
      })
    }

    try {
      await tx.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          branchId: input.fulfillmentBranchId,
          actorUserId: input.actorUserId || null,
          actorEmail: input.actorEmail || input.performedBy,
          eventType: 'WHOLESALE_INVOICE_CREATED',
          entityType: 'WholesaleInvoice',
          entityId: created.id,
          afterJson: {
            invoiceNumber: created.invoiceNumber,
            channel: created.channel,
            total: created.total,
            paidAmount: created.paidAmount,
            dueAmount: created.dueAmount,
            dealerId: created.dealerId,
          } as Prisma.InputJsonValue,
        },
      })
    } catch {
      // Audit is best-effort
    }

    return created
  })

  await emitWholesaleInvoiceAccounting({
    tenantId: input.tenantId,
    branchId: input.fulfillmentBranchId,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    total: invoice.total,
    paidAmount: invoice.paidAmount,
    dueAmount: invoice.dueAmount,
    channel: invoice.channel,
    actorEmail: input.actorEmail || undefined,
  })

  return invoice
}
