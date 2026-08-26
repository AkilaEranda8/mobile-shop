import { PaymentMethod, type Prisma } from '@prisma/client'
import type { Request } from 'express'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { generatePurchaseReturnNumber } from '../../utils/counters'
import { assertBusinessDayOpenIfEnabled } from '../daily-closing/day-lock.util'
import { assertBranchRecordAccess } from '../../utils/active-branch'
import { applyPurchaseOrderReturnStock } from '../../utils/po-return.util'
import { emitPurchaseReturnAccounting } from '../accounting/integration/accounting-events.service'
import { OPENING_BALANCE_SUPPLIER_PO_NOTES } from '../../constants/business-rules.constants'

const round2 = (n: number) => Math.round(n * 100) / 100

export type PurchaseReturnRequestItem = {
  poItemId: string
  quantity: number
  imei?: string | null
}

export type ProcessPurchaseReturnInput = {
  tenantId: string
  purchaseOrderId: string
  performedBy: string
  actorEmail?: string
  items: PurchaseReturnRequestItem[]
  reason: string
  settlementMethod: string
  notes?: string | null
  req?: Request
}

async function refreshSupplierOutstanding(
  tx: Prisma.TransactionClient,
  tenantId: string,
  supplierId: string,
) {
  const agg = await tx.purchaseOrder.aggregate({
    where: {
      tenantId,
      supplierId,
      status: { in: ['RECEIVED', 'PARTIAL', 'CLOSED', 'SENT'] },
    },
    _sum: { dueAmount: true },
  })
  await tx.supplier.update({
    where: { id: supplierId },
    data: { outstandingDues: round2(Math.max(0, agg._sum.dueAmount ?? 0)) },
  })
}

export async function processPurchaseReturn(input: ProcessPurchaseReturnInput) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: input.purchaseOrderId, tenantId: input.tenantId },
    include: {
      items: true,
      imeiRecords: { select: { id: true, imei: true, productId: true, status: true, poItemId: true } },
    },
  })
  if (!po) throw new AppError('Purchase order not found', 404)
  if (input.req) assertBranchRecordAccess(input.req, po.branchId)
  await assertBusinessDayOpenIfEnabled(input.tenantId, po.branchId)

  if (!['RECEIVED', 'PARTIAL', 'CLOSED'].includes(po.status) && !(po.receivedAt || po.items.some(i => i.receivedQuantity > 0))) {
    throw new AppError('Only received purchase orders can be returned', 400)
  }
  if (po.notes === OPENING_BALANCE_SUPPLIER_PO_NOTES) {
    throw new AppError('Opening-balance supplier invoices cannot be returned', 400)
  }
  if (!input.items?.length) throw new AppError('No items provided for return', 400)
  if (!input.reason?.trim()) throw new AppError('Reason is required', 400)

  const method = String(input.settlementMethod || 'CREDIT').toUpperCase()
  const allowed: PaymentMethod[] = [
    PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.UPI,
    PaymentMethod.BANK_TRANSFER, PaymentMethod.WALLET, PaymentMethod.CHEQUE, PaymentMethod.CREDIT,
  ]
  if (!allowed.includes(method as PaymentMethod)) throw new AppError('Invalid settlement method', 400)
  const settlementMethod = method as PaymentMethod
  const isCredit = settlementMethod === PaymentMethod.CREDIT

  const prior = await prisma.purchaseReturn.findMany({
    where: { purchaseOrderId: po.id },
    include: { items: true },
  })
  const alreadyByPoItem: Record<string, number> = {}
  for (const ret of prior) {
    for (const ri of ret.items) {
      if (ri.poItemId) alreadyByPoItem[ri.poItemId] = (alreadyByPoItem[ri.poItemId] ?? 0) + ri.quantity
    }
  }

  const poItemsById = new Map(po.items.map(i => [i.id, i]))
  const resolved = input.items.map(raw => {
    const poItem = poItemsById.get(String(raw.poItemId))
    if (!poItem) throw new AppError('PO line not found on this purchase order', 400)
    const qty = Number(raw.quantity)
    if (!Number.isFinite(qty) || qty <= 0) throw new AppError(`Invalid quantity for "${poItem.productName}"`, 400)
    if (!poItem.productId) throw new AppError(`"${poItem.productName}" is not linked to a product`, 400)

    const priorQty = alreadyByPoItem[poItem.id] ?? 0
    const available = Math.max(0, Number(poItem.receivedQuantity) - priorQty)
    if (available <= 0) throw new AppError(`"${poItem.productName}" has nothing left to return`, 400)
    if (qty > available) {
      throw new AppError(`Return qty for "${poItem.productName}" exceeds available (${available} remaining)`, 400)
    }

    const imei = raw.imei ? String(raw.imei).trim() : null
    return {
      poItemId: poItem.id,
      productId: poItem.productId,
      productName: poItem.productName,
      sku: poItem.sku ?? null,
      storage: poItem.storage ?? null,
      colorName: poItem.colorName ?? null,
      imei,
      quantity: qty,
      unitCost: Number(poItem.unitCost),
      total: round2(Number(poItem.unitCost) * qty),
    }
  })

  // IMEI validation — if PO has IMEI records for the product, require imei and qty=1
  for (const line of resolved) {
    const productImeis = po.imeiRecords.filter(
      r => r.productId === line.productId && (r.poItemId === line.poItemId || !r.poItemId),
    )
    if (productImeis.length > 0 || line.imei) {
      if (!line.imei) throw new AppError(`IMEI required for "${line.productName}"`, 400)
      if (line.quantity !== 1) throw new AppError(`IMEI products must be returned one unit per line: "${line.productName}"`, 400)
      const rec = po.imeiRecords.find(r => r.imei === line.imei)
      if (!rec) throw new AppError(`IMEI ${line.imei} is not registered on this PO`, 400)
      if (rec.status !== 'IN_STOCK') throw new AppError(`IMEI ${line.imei} is not in stock (status: ${rec.status})`, 400)
    }
  }

  const creditAmount = round2(resolved.reduce((s, i) => s + i.total, 0))
  if (creditAmount <= 0) throw new AppError('Return has no value', 400)

  const returnNumber = await generatePurchaseReturnNumber(input.tenantId)

  const purchaseReturn = await prisma.$transaction(async (tx) => {
    const due = round2(Math.max(0, Number(po.dueAmount ?? 0)))
    const apReduced = round2(Math.min(creditAmount, due))
    let remaining = round2(creditAmount - apReduced)
    let supplierCreditCreated = 0
    let cashRefund = 0

    if (isCredit) {
      supplierCreditCreated = remaining
      remaining = 0
    } else {
      cashRefund = remaining
      remaining = 0
    }

    const nextDue = round2(due - apReduced)

    await applyPurchaseOrderReturnStock({
      tx,
      tenantId: input.tenantId,
      branchId: po.branchId,
      returnNumber,
      performedBy: input.performedBy,
      lines: resolved.map(l => ({
        poItemId: l.poItemId,
        productId: l.productId,
        productName: l.productName,
        quantity: l.quantity,
        unitCost: l.unitCost,
        sku: l.sku,
        storage: l.storage,
        colorName: l.colorName,
      })),
    })

    // Scrap returned IMEIs
    for (const line of resolved) {
      if (!line.imei) continue
      await tx.imeiRecord.update({
        where: { imei: line.imei },
        data: { status: 'SCRAPPED', saleId: null, customerId: null },
      })
    }

    const created = await tx.purchaseReturn.create({
      data: {
        tenantId: input.tenantId,
        branchId: po.branchId,
        purchaseOrderId: po.id,
        supplierId: po.supplierId,
        supplierName: po.supplierName,
        returnNumber,
        reason: input.reason.trim(),
        creditAmount,
        settlementMethod,
        apReduced,
        supplierCreditCreated,
        processedBy: input.performedBy,
        notes: input.notes?.trim() || null,
        items: {
          create: resolved.map(l => ({
            poItemId: l.poItemId,
            productId: l.productId,
            productName: l.productName,
            sku: l.sku,
            storage: l.storage,
            colorName: l.colorName,
            imei: l.imei,
            quantity: l.quantity,
            unitCost: l.unitCost,
            total: l.total,
          })),
        },
      },
      include: { items: true },
    })

    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: {
        dueAmount: nextDue,
        // Keep RECEIVED/CLOSED; CLOSED stays if already closed
        status: po.status === 'CLOSED' && nextDue <= 0.001 ? 'CLOSED' : po.status,
      },
    })

    if (cashRefund > 0.001) {
      await tx.transaction.create({
        data: {
          tenantId: input.tenantId,
          branchId: po.branchId,
          type: 'INCOME',
          category: 'Purchase Return Refund',
          amount: cashRefund,
          description: `Refund for purchase return ${returnNumber} (PO ${po.poNumber})`,
          paymentMethod: settlementMethod,
          reference: returnNumber,
          supplierId: po.supplierId,
          purchaseOrderId: po.id,
          performedBy: input.performedBy,
          occurredAt: new Date(),
        },
      })
    }

    // Supplier credit (over-AP) still reduces what we conceptually owe — recompute from POs
    if (supplierCreditCreated > 0.001) {
      // Soft-store via outstanding refresh; creditAmount already removed from this PO's due
      // Extra credit lowers other dues conceptually by reducing outstandingDues floor — keep >= 0 via refresh
    }

    await refreshSupplierOutstanding(tx, input.tenantId, po.supplierId)

    return created
  })

  void emitPurchaseReturnAccounting(
    input.tenantId,
    purchaseReturn.id,
    po.branchId,
    input.actorEmail,
  )

  return purchaseReturn
}

export async function listPurchaseReturns(tenantId: string, opts: {
  branchId?: string
  purchaseOrderId?: string
  supplierId?: string
  take?: number
  skip?: number
}) {
  const where: Prisma.PurchaseReturnWhereInput = {
    tenantId,
    ...(opts.branchId ? { branchId: opts.branchId } : {}),
    ...(opts.purchaseOrderId ? { purchaseOrderId: opts.purchaseOrderId } : {}),
    ...(opts.supplierId ? { supplierId: opts.supplierId } : {}),
  }
  const [data, total] = await Promise.all([
    prisma.purchaseReturn.findMany({
      where,
      include: {
        items: true,
        purchaseOrder: { select: { id: true, poNumber: true, status: true } },
        supplier: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: opts.take ?? 50,
      skip: opts.skip ?? 0,
    }),
    prisma.purchaseReturn.count({ where }),
  ])
  return { data, total }
}
