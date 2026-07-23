import { Prisma, type PaymentMethod } from '@prisma/client'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { assertBusinessDayOpenIfEnabled } from '../daily-closing/day-lock.util'
import { emitApPaymentAccounting } from '../accounting/integration/accounting-events.service'

const round2 = (value: number) => Math.round(value * 100) / 100

export type SupplierPaymentAllocationInput = {
  purchaseOrderId: string
  amount?: number
}

export type RecordSupplierPaymentInput = {
  tenantId: string
  supplierId: string
  branchId: string
  amount: number
  method: string
  reference?: string
  notes?: string
  bankAccountId?: string
  occurredAt?: Date
  performedBy: string
  actorEmail?: string
  allocations: SupplierPaymentAllocationInput[]
}

function normalizeMethod(raw: string): PaymentMethod {
  const method = raw.toUpperCase()
  if (!['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'WALLET', 'CHEQUE'].includes(method)) {
    throw new AppError('Invalid payment method', 400)
  }
  return method as PaymentMethod
}

export async function recordSupplierPayment(input: RecordSupplierPaymentInput) {
  const payAmount = round2(Number(input.amount))
  if (!Number.isFinite(payAmount) || payAmount <= 0) {
    throw new AppError('Invalid payment amount', 400)
  }

  const supplier = await prisma.supplier.findFirst({
    where: { id: input.supplierId, tenantId: input.tenantId, isActive: true },
  })
  if (!supplier) throw new AppError('Supplier not found', 404)

  const normalized = input.allocations
    .map(a => ({
      purchaseOrderId: String(a.purchaseOrderId ?? '').trim(),
      amount: a.amount == null ? undefined : round2(Number(a.amount)),
    }))
    .filter(a => a.purchaseOrderId)
  if (!normalized.length) throw new AppError('Select at least one unpaid purchase order', 400)
  if (new Set(normalized.map(a => a.purchaseOrderId)).size !== normalized.length) {
    throw new AppError('A purchase order can only be selected once', 400)
  }
  if (normalized.some(a => a.amount != null && (!Number.isFinite(a.amount) || a.amount <= 0))) {
    throw new AppError('Invalid purchase order allocation amount', 400)
  }
  const hasExplicitAmounts = normalized.some(a => a.amount != null)
  if (hasExplicitAmounts && normalized.some(a => a.amount == null)) {
    throw new AppError('Provide an amount for every selected purchase order', 400)
  }
  if (hasExplicitAmounts) {
    const allocationTotal = round2(normalized.reduce((sum, a) => sum + Number(a.amount), 0))
    if (allocationTotal !== payAmount) {
      throw new AppError('Purchase order allocations must equal the payment amount', 400)
    }
  }

  const paymentMethod = normalizeMethod(input.method || 'CASH')
  // Bank account selection was removed from the UI: non-cash payments settle
  // against the default accounting bank mapping (Main Bank). An explicit
  // bankAccountId is still honoured when a caller provides one.
  let resolvedBankAccountId: string | undefined

  const selectedIds = normalized.map(a => a.purchaseOrderId)
  const previewPos = await prisma.purchaseOrder.findMany({
    where: {
      id: { in: selectedIds },
      tenantId: input.tenantId,
      supplierId: input.supplierId,
      dueAmount: { gt: 0 },
      ...(supplier.branchId ? { branchId: supplier.branchId } : {}),
    },
    select: { branchId: true },
  })
  if (previewPos.length !== selectedIds.length) {
    throw new AppError('One or more selected purchase orders are invalid or already paid', 400)
  }
  const previewBranches = [...new Set(previewPos.map(p => p.branchId))]
  const lockBranchId = previewBranches.length === 1 ? previewBranches[0] : input.branchId

  if (input.bankAccountId && paymentMethod !== 'CASH') {
    const bank = await prisma.bankAccount.findFirst({
      where: {
        id: input.bankAccountId,
        tenantId: input.tenantId,
        isActive: true,
        OR: [{ branchId: null }, { branchId: lockBranchId }],
      },
      select: { id: true },
    })
    if (!bank) throw new AppError('Bank account not found for this branch', 404)
    resolvedBankAccountId = bank.id
  }

  await assertBusinessDayOpenIfEnabled(input.tenantId, lockBranchId, input.occurredAt ?? new Date())

  const runTransaction = () => prisma.$transaction(async tx => {
    const purchaseOrders = await tx.purchaseOrder.findMany({
      where: {
        id: { in: selectedIds },
        tenantId: input.tenantId,
        supplierId: input.supplierId,
        dueAmount: { gt: 0 },
        status: { in: ['RECEIVED', 'PARTIAL', 'CLOSED'] },
      },
      orderBy: { createdAt: 'asc' },
    })
    if (purchaseOrders.length !== selectedIds.length) {
      throw new AppError('One or more selected purchase orders are invalid or already paid', 400)
    }

    const poBranchIds = [...new Set(purchaseOrders.map(p => p.branchId))]
    if (poBranchIds.length !== 1) {
      throw new AppError('Select purchase orders from one branch at a time', 400)
    }
    const branchId = poBranchIds[0]

    const selectedDue = round2(purchaseOrders.reduce((sum, po) => sum + Number(po.dueAmount), 0))
    if (payAmount > selectedDue) {
      throw new AppError(`Payment cannot exceed selected outstanding amount (${selectedDue.toFixed(2)})`, 400)
    }

    const requestedByPo = new Map(normalized.map(a => [a.purchaseOrderId, a.amount]))
    let remaining = payAmount
    const updates: Array<{
      id: string
      poNumber: string
      amount: number
      paidAmount: number
      dueAmount: number
      status: 'CLOSED' | 'RECEIVED'
    }> = []

    for (const po of purchaseOrders) {
      if (remaining <= 0) break
      const requested = requestedByPo.get(po.id)
      const allocate = round2(Math.min(requested ?? remaining, remaining, Number(po.dueAmount)))
      if (requested != null && allocate !== requested) {
        throw new AppError(`Allocation exceeds the outstanding amount for ${po.poNumber}`, 400)
      }
      if (allocate <= 0) continue
      const newPaid = round2(Number(po.paidAmount) + allocate)
      const newDue = round2(Math.max(0, Number(po.dueAmount) - allocate))
      await tx.purchaseOrder.update({
        where: { id: po.id },
        // PurchaseOrder.status is primarily a fulfilment state. Keep a partially
        // paid received order RECEIVED so it can never be received/restocked twice.
        data: { paidAmount: newPaid, dueAmount: newDue, status: newDue === 0 ? 'CLOSED' : 'RECEIVED' },
      })
      updates.push({
        id: po.id,
        poNumber: po.poNumber,
        amount: allocate,
        paidAmount: newPaid,
        dueAmount: newDue,
        status: newDue === 0 ? 'CLOSED' : 'RECEIVED',
      })
      remaining = round2(remaining - allocate)
    }
    if (remaining !== 0) throw new AppError('Payment could not be fully allocated', 409)

    const allocationText = updates.map(u => `${u.poNumber}: ${u.amount.toFixed(2)}`).join(', ')
    const transaction = await tx.transaction.create({
      data: {
        tenantId: input.tenantId,
        branchId,
        type: 'EXPENSE',
        category: 'Supplier Payment',
        amount: payAmount,
        description: `Payment to ${supplier.name} · ${allocationText}${input.reference ? ` · Ref: ${input.reference.trim()}` : ''}${input.notes ? ` · ${input.notes.trim()}` : ''}`,
        paymentMethod,
        reference: input.reference?.trim() || undefined,
        bankAccountId: resolvedBankAccountId,
        supplierId: supplier.id,
        purchaseOrderId: updates[0].id,
        occurredAt: input.occurredAt,
        performedBy: input.performedBy,
      },
    })
    await tx.supplierPaymentAllocation.createMany({
      data: updates.map(u => ({
        tenantId: input.tenantId,
        transactionId: transaction.id,
        purchaseOrderId: u.id,
        amount: u.amount,
      })),
    })

    const agg = await tx.purchaseOrder.aggregate({
      where: {
        supplierId: supplier.id,
        tenantId: input.tenantId,
        ...(supplier.branchId ? { branchId: supplier.branchId } : {}),
      },
      _count: { id: true },
      _sum: { total: true, dueAmount: true },
    })
    await tx.supplier.update({
      where: { id: supplier.id },
      data: {
        totalOrders: agg._count.id ?? 0,
        totalPurchaseValue: agg._sum.total ?? 0,
        outstandingDues: agg._sum.dueAmount ?? 0,
      },
    })

    return { transaction, updates, branchId }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

  let result: Awaited<ReturnType<typeof runTransaction>> | undefined
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      result = await runTransaction()
      break
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2034' || attempt === 3) throw error
    }
  }
  if (!result) throw new AppError('Payment could not be recorded', 409)

  const accounting = await emitApPaymentAccounting(
    input.tenantId,
    result.transaction.id,
    result.branchId,
    input.actorEmail,
    { allocations: result.updates.map(u => ({ purchaseOrderId: u.id, amount: u.amount })) },
  )

  return { ...result, accounting }
}
