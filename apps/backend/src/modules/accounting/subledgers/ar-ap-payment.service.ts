import type { PaymentMethod } from '@prisma/client'
import { prisma } from '../../../config/database'
import { AppError } from '../../../middleware/error.middleware'
import { createPostedJournalEntry } from '../journals/journal-create.service'
import type { JournalDraftLine } from '../journals/journal-validator.util'
import { round2 } from '../reports/gl-balances.util'

async function getSettingsOrThrow(tenantId: string) {
  const s = await prisma.accountingSettings.findUnique({ where: { tenantId } })
  if (!s?.initializedAt) throw new AppError('Accounting is not initialized', 400)
  return s
}

async function resolveAccountIdByKey(tenantId: string, key: string) {
  const settings = await getSettingsOrThrow(tenantId)
  const map = (settings.defaultAccounts ?? {}) as Record<string, unknown>
  const val = map[key]
  if (typeof val === 'string' && val) return val
  throw new AppError(`Missing accounting account mapping: ${key}`, 400)
}

async function resolveBranchCashGlAccountId(tenantId: string, branchId: string) {
  const cash = await prisma.cashAccount.findFirst({
    where: { tenantId, branchId, name: 'Main Cash', isActive: true },
    select: { glAccountId: true },
  })
  if (!cash) throw new AppError('Branch cash account not configured. Initialize Accounting first.', 400)
  return cash.glAccountId
}

export async function resolvePaymentGlAccountId(
  tenantId: string,
  branchId: string,
  method: PaymentMethod,
) {
  if (method === 'CASH') return resolveBranchCashGlAccountId(tenantId, branchId)
  if (method === 'CARD') return resolveAccountIdByKey(tenantId, 'cardClearing')
  if (method === 'UPI' || method === 'WALLET') return resolveAccountIdByKey(tenantId, 'upiClearing')
  if (method === 'BANK_TRANSFER') return resolveAccountIdByKey(tenantId, 'bank')
  return resolveBranchCashGlAccountId(tenantId, branchId)
}

type PaymentJournalOpts = {
  tenantId: string
  branchId: string
  amount: number
  paymentMethod: PaymentMethod
  reference?: string | null
  memo?: string
  sourceRefType: string
  sourceRefId: string
  sourceEvent: string
  actorEmail?: string
  entryDate?: Date
  allocations?: Array<{ saleId?: string; purchaseOrderId?: string; amount: number }>
}

export async function postArPaymentJournal(
  tenantId: string,
  customerId: string,
  opts: PaymentJournalOpts,
) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId },
    select: { id: true, name: true, phone: true },
  })
  if (!customer) throw new AppError('Customer not found', 404)

  const amount = round2(Math.max(0, Number(opts.amount)))
  if (amount <= 0) throw new AppError('Payment amount must be greater than zero', 400)

  const cashAccountId = await resolvePaymentGlAccountId(tenantId, opts.branchId, opts.paymentMethod)
  const arAccountId = await resolveAccountIdByKey(tenantId, 'ar')

  const metadata = {
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    paymentMethod: opts.paymentMethod,
    reference: opts.reference ?? null,
    allocations: opts.allocations ?? null,
  }

  const lines: JournalDraftLine[] = [
    {
      accountId: cashAccountId,
      debit: amount,
      credit: 0,
      description: `Receipt — ${opts.paymentMethod}`,
      metadata,
    },
    {
      accountId: arAccountId,
      debit: 0,
      credit: amount,
      description: 'AR payment received',
      customerId: customer.id,
      metadata,
    },
  ]

  const je = await createPostedJournalEntry({
    tenantId,
    branchId: opts.branchId,
    entryDate: opts.entryDate,
    sourceModule: 'AR',
    sourceRefType: opts.sourceRefType,
    sourceRefId: opts.sourceRefId,
    sourceEvent: opts.sourceEvent,
    memo: opts.memo ?? `AR payment — ${customer.name}`,
    createdByEmail: opts.actorEmail,
    lines,
  })

  await prisma.integrationLink.create({
    data: {
      tenantId,
      sourceType: opts.sourceRefType,
      sourceId: opts.sourceRefId,
      eventType: opts.sourceEvent,
      journalEntryId: je.id,
    },
  })

  return je
}

export async function postApPaymentJournal(
  tenantId: string,
  supplierId: string,
  opts: PaymentJournalOpts,
) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, tenantId },
    select: { id: true, name: true, phone: true },
  })
  if (!supplier) throw new AppError('Supplier not found', 404)

  const amount = round2(Math.max(0, Number(opts.amount)))
  if (amount <= 0) throw new AppError('Payment amount must be greater than zero', 400)

  const cashAccountId = await resolvePaymentGlAccountId(tenantId, opts.branchId, opts.paymentMethod)
  const apAccountId = await resolveAccountIdByKey(tenantId, 'ap')

  const metadata = {
    supplierId: supplier.id,
    supplierName: supplier.name,
    paymentMethod: opts.paymentMethod,
    reference: opts.reference ?? null,
    allocations: opts.allocations ?? null,
  }

  const lines: JournalDraftLine[] = [
    {
      accountId: apAccountId,
      debit: amount,
      credit: 0,
      description: 'AP payment',
      supplierId: supplier.id,
      metadata,
    },
    {
      accountId: cashAccountId,
      debit: 0,
      credit: amount,
      description: `Payment — ${opts.paymentMethod}`,
      metadata,
    },
  ]

  const je = await createPostedJournalEntry({
    tenantId,
    branchId: opts.branchId,
    entryDate: opts.entryDate,
    sourceModule: 'AP',
    sourceRefType: opts.sourceRefType,
    sourceRefId: opts.sourceRefId,
    sourceEvent: opts.sourceEvent,
    memo: opts.memo ?? `AP payment — ${supplier.name}`,
    createdByEmail: opts.actorEmail,
    lines,
  })

  await prisma.integrationLink.create({
    data: {
      tenantId,
      sourceType: opts.sourceRefType,
      sourceId: opts.sourceRefId,
      eventType: opts.sourceEvent,
      journalEntryId: je.id,
    },
  })

  return je
}

export async function postArPaymentFromTransaction(tenantId: string, txId: string, actorEmail?: string) {
  const tx = await prisma.transaction.findFirst({
    where: { id: txId, tenantId, type: 'INCOME', category: 'Customer Credit Payment' },
  })
  if (!tx) throw new AppError('AR payment transaction not found', 404)

  const phoneMatch = tx.description.match(/\(([^)]+)\)/)
  const phone = phoneMatch?.[1]?.trim()
  if (!phone) throw new AppError('Cannot resolve customer from transaction description', 400)

  const customer = await prisma.customer.findFirst({ where: { tenantId, phone } })
  if (!customer) throw new AppError(`Customer not found for phone ${phone}`, 404)

  return postArPaymentJournal(tenantId, customer.id, {
    tenantId,
    branchId: tx.branchId,
    amount: tx.amount,
    paymentMethod: tx.paymentMethod,
    reference: tx.reference,
    memo: tx.description,
    sourceRefType: 'Transaction',
    sourceRefId: tx.id,
    sourceEvent: 'AR_PAYMENT_RECEIVED',
    actorEmail: actorEmail ?? tx.performedBy,
    entryDate: tx.createdAt,
  })
}

export async function postApPaymentFromTransaction(tenantId: string, txId: string, actorEmail?: string) {
  const tx = await prisma.transaction.findFirst({
    where: { id: txId, tenantId, type: 'EXPENSE', category: 'Supplier Payment' },
  })
  if (!tx) throw new AppError('AP payment transaction not found', 404)

  const nameMatch = tx.description.match(/^Payment to (.+?)(?:\s·\sRef:|$)/)
  const supplierName = nameMatch?.[1]?.trim()
  if (!supplierName) throw new AppError('Cannot resolve supplier from transaction description', 400)

  const supplier = await prisma.supplier.findFirst({
    where: { tenantId, name: { equals: supplierName, mode: 'insensitive' } },
  })
  if (!supplier) throw new AppError(`Supplier not found: ${supplierName}`, 404)

  return postApPaymentJournal(tenantId, supplier.id, {
    tenantId,
    branchId: tx.branchId,
    amount: tx.amount,
    paymentMethod: tx.paymentMethod,
    reference: tx.reference,
    memo: tx.description,
    sourceRefType: 'Transaction',
    sourceRefId: tx.id,
    sourceEvent: 'AP_PAYMENT_MADE',
    actorEmail: actorEmail ?? tx.performedBy,
    entryDate: tx.createdAt,
  })
}

export async function recordArPayment(
  tenantId: string,
  body: {
    customerId: string
    branchId: string
    amount: number
    paymentMethod: PaymentMethod
    reference?: string
    notes?: string
    allocations?: Array<{ saleId: string; amount: number }>
  },
  actorEmail?: string,
) {
  const paymentId = `arp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const je = await postArPaymentJournal(tenantId, body.customerId, {
    tenantId,
    branchId: body.branchId,
    amount: body.amount,
    paymentMethod: body.paymentMethod,
    reference: body.reference,
    memo: body.notes ?? `Manual AR payment`,
    sourceRefType: 'ArPayment',
    sourceRefId: paymentId,
    sourceEvent: 'AR_PAYMENT_RECEIVED',
    actorEmail,
    allocations: body.allocations,
  })

  await syncArOperationalPayment(
    tenantId,
    body.customerId,
    body.branchId,
    body.amount,
    body.paymentMethod,
    actorEmail ?? 'system',
    body.reference,
    body.allocations,
    je.id,
  )

  return { journalEntry: je, paymentId }
}

export async function recordApPayment(
  tenantId: string,
  body: {
    supplierId: string
    branchId: string
    amount: number
    paymentMethod: PaymentMethod
    reference?: string
    notes?: string
    allocations?: Array<{ purchaseOrderId: string; amount: number }>
  },
  actorEmail?: string,
) {
  const paymentId = `app-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const je = await postApPaymentJournal(tenantId, body.supplierId, {
    tenantId,
    branchId: body.branchId,
    amount: body.amount,
    paymentMethod: body.paymentMethod,
    reference: body.reference,
    memo: body.notes ?? `Manual AP payment`,
    sourceRefType: 'ApPayment',
    sourceRefId: paymentId,
    sourceEvent: 'AP_PAYMENT_MADE',
    actorEmail,
    allocations: body.allocations,
  })

  await syncApOperationalPayment(
    tenantId,
    body.supplierId,
    body.branchId,
    body.amount,
    body.paymentMethod,
    actorEmail ?? 'system',
    body.reference,
    body.allocations,
    je.id,
  )

  return { journalEntry: je, paymentId }
}

async function syncArOperationalPayment(
  tenantId: string,
  customerId: string,
  branchId: string,
  amount: number,
  paymentMethod: PaymentMethod,
  performedBy: string,
  reference?: string,
  allocations?: Array<{ saleId: string; amount: number }>,
  journalEntryId?: string,
) {
  const c = await prisma.customer.findFirst({ where: { id: customerId, tenantId } })
  if (!c) return

  const payAmount = round2(amount)

  await prisma.$transaction(async tx => {
    if (allocations?.length) {
      let remaining = payAmount
      for (const a of allocations) {
        if (remaining <= 0) break
        const apply = round2(Math.min(Number(a.amount), remaining))
        if (apply <= 0) continue
        const sale = await tx.sale.findFirst({ where: { id: a.saleId, tenantId, customerId } })
        if (!sale || sale.dueAmount <= 0) continue
        const applied = round2(Math.min(apply, sale.dueAmount))
        const newDue = round2(sale.dueAmount - applied)
        const newPaid = round2(sale.paidAmount + applied)
        await tx.sale.update({
          where: { id: sale.id },
          data: {
            paidAmount: newPaid,
            dueAmount: newDue,
            status: newDue <= 0 ? 'PAID' : 'PARTIAL',
            payments: { create: { method: paymentMethod, amount: applied, reference: reference ?? 'Allocated AR payment' } },
          },
        })
        remaining = round2(remaining - applied)
      }
    } else {
      const openSales = await tx.sale.findMany({
        where: { tenantId, customerId, dueAmount: { gt: 0 } },
        orderBy: { createdAt: 'asc' },
      })

      let remaining = payAmount
      for (const sale of openSales) {
        if (remaining <= 0) break
        const apply = round2(Math.min(remaining, sale.dueAmount))
        const newDue = round2(sale.dueAmount - apply)
        const newPaid = round2(sale.paidAmount + apply)
        await tx.sale.update({
          where: { id: sale.id },
          data: {
            paidAmount: newPaid,
            dueAmount: newDue,
            status: newDue <= 0 ? 'PAID' : 'PARTIAL',
            payments: {
              create: {
                method: paymentMethod,
                amount: apply,
                reference: reference ?? 'GL AR payment',
              },
            },
          },
        })
        remaining = round2(remaining - apply)
      }
    }

    const newTotalDue = round2(Math.max(0, c.totalDue - payAmount))
    await tx.customer.update({ where: { id: customerId }, data: { totalDue: newTotalDue } })

    const transaction = await tx.transaction.create({
      data: {
        tenantId,
        branchId,
        type: 'INCOME',
        category: 'Customer Credit Payment',
        amount: payAmount,
        description: `Credit payment from ${c.name} (${c.phone}) — via Accounting`,
        paymentMethod,
        reference,
        performedBy,
      },
    })

    if (journalEntryId) {
      await tx.integrationLink.create({
        data: {
          tenantId,
          sourceType: 'Transaction',
          sourceId: transaction.id,
          eventType: 'AR_PAYMENT_RECEIVED',
          journalEntryId,
        },
      })
    }
  })
}

async function syncApOperationalPayment(
  tenantId: string,
  supplierId: string,
  branchId: string,
  amount: number,
  paymentMethod: PaymentMethod,
  performedBy: string,
  reference?: string,
  allocations?: Array<{ purchaseOrderId: string; amount: number }>,
  journalEntryId?: string,
) {
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, tenantId } })
  if (!supplier) return

  const payAmount = round2(amount)

  await prisma.$transaction(async tx => {
    if (allocations?.length) {
      let remaining = payAmount
      for (const a of allocations) {
        if (remaining <= 0) break
        const po = await tx.purchaseOrder.findFirst({ where: { id: a.purchaseOrderId, tenantId, supplierId } })
        if (!po || po.dueAmount <= 0) continue
        const allocate = round2(Math.min(Number(a.amount), remaining, po.dueAmount))
        if (allocate <= 0) continue
        const newPaid = round2(po.paidAmount + allocate)
        const newDue = round2(Math.max(0, po.dueAmount - allocate))
        await tx.purchaseOrder.update({
          where: { id: po.id },
          data: { paidAmount: newPaid, dueAmount: newDue, status: newDue === 0 ? 'CLOSED' : 'PARTIAL' },
        })
        remaining = round2(remaining - allocate)
      }
    } else {
      const unpaidPOs = await tx.purchaseOrder.findMany({
        where: { tenantId, supplierId, dueAmount: { gt: 0 } },
        orderBy: { createdAt: 'asc' },
      })

      let remaining = payAmount
      for (const po of unpaidPOs) {
        if (remaining <= 0) break
        const allocate = round2(Math.min(remaining, po.dueAmount))
        const newPaid = round2(po.paidAmount + allocate)
        const newDue = round2(Math.max(0, po.dueAmount - allocate))
        await tx.purchaseOrder.update({
          where: { id: po.id },
          data: {
            paidAmount: newPaid,
            dueAmount: newDue,
            status: newDue === 0 ? 'CLOSED' : 'PARTIAL',
          },
        })
        remaining = round2(remaining - allocate)
      }
    }

    const transaction = await tx.transaction.create({
      data: {
        tenantId,
        branchId,
        type: 'EXPENSE',
        category: 'Supplier Payment',
        amount: payAmount,
        description: `Payment to ${supplier.name}${reference ? ` · Ref: ${reference}` : ''} — via Accounting`,
        paymentMethod,
        reference,
        performedBy,
      },
    })

    if (journalEntryId) {
      await tx.integrationLink.create({
        data: {
          tenantId,
          sourceType: 'Transaction',
          sourceId: transaction.id,
          eventType: 'AP_PAYMENT_MADE',
          journalEntryId,
        },
      })
    }
  })

  const agg = await prisma.purchaseOrder.aggregate({
    where: { supplierId, tenantId },
    _count: { id: true },
    _sum: { total: true, dueAmount: true },
  })
  await prisma.supplier.update({
    where: { id: supplierId },
    data: {
      totalOrders: agg._count.id ?? 0,
      totalPurchaseValue: agg._sum.total ?? 0,
      outstandingDues: agg._sum.dueAmount ?? 0,
    },
  })
}
