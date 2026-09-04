import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database'
import { AppError } from '../../../middleware/error.middleware'
import { generateDealerPaymentReceiptNumber } from '../../../utils/counters'
import { getWholesaleSettings } from '../settings/wholesale-settings.service'
import { emitWholesaleReceiptAccounting } from '../sale/wholesale-accounting'
import { round2 } from '../wholesale-uom.util'
import type { CreateTaskInput, RecordPaymentInput, UpdateTaskInput } from './collections.schema'

function bucketLabel(buckets: number[], ageDays: number): string {
  for (let i = 0; i < buckets.length - 1; i++) {
    if (ageDays >= buckets[i] && ageDays < buckets[i + 1]) {
      return `${buckets[i]}-${buckets[i + 1] - 1}`
    }
  }
  const last = buckets[buckets.length - 1] ?? 90
  return `${last}+`
}

export async function ageingReport(tenantId: string, dealerId?: string) {
  const settings = await getWholesaleSettings(tenantId)
  const buckets = settings.ageingBuckets.length ? settings.ageingBuckets : [0, 30, 60, 90]
  const now = Date.now()

  const invoices = await prisma.wholesaleInvoice.findMany({
    where: {
      tenantId,
      dueAmount: { gt: 0 },
      status: { in: ['POSTED', 'PARTIAL'] },
      ...(dealerId ? { dealerId } : {}),
    },
    include: {
      dealer: { select: { id: true, legalName: true, tradingName: true, dealerCode: true, totalDue: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const byDealer = new Map<
    string,
    {
      dealer: (typeof invoices)[0]['dealer']
      totalDue: number
      buckets: Record<string, number>
      invoices: Array<{ id: string; invoiceNumber: string; dueAmount: number; ageDays: number; bucket: string }>
    }
  >()

  for (const inv of invoices) {
    const ageDays = Math.floor((now - new Date(inv.createdAt).getTime()) / (24 * 60 * 60 * 1000))
    const bucket = bucketLabel(buckets, ageDays)
    let row = byDealer.get(inv.dealerId)
    if (!row) {
      row = {
        dealer: inv.dealer,
        totalDue: 0,
        buckets: {},
        invoices: [],
      }
      byDealer.set(inv.dealerId, row)
    }
    row.totalDue = round2(row.totalDue + inv.dueAmount)
    row.buckets[bucket] = round2((row.buckets[bucket] || 0) + inv.dueAmount)
    row.invoices.push({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      dueAmount: inv.dueAmount,
      ageDays,
      bucket,
    })
  }

  return {
    buckets,
    dealers: [...byDealer.values()].sort((a, b) => b.totalDue - a.totalDue),
  }
}

export async function dealerStatement(tenantId: string, dealerId: string, from?: string, to?: string) {
  const dealer = await prisma.dealer.findFirst({ where: { id: dealerId, tenantId } })
  if (!dealer) throw new AppError('Dealer not found', 404)

  const createdAt: Prisma.DateTimeFilter = {}
  if (from) createdAt.gte = new Date(from)
  if (to) createdAt.lte = new Date(to)
  const dateFilter = Object.keys(createdAt).length ? { createdAt } : {}

  const [invoices, payments, creditNotes] = await Promise.all([
    prisma.wholesaleInvoice.findMany({
      where: { tenantId, dealerId, ...dateFilter },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        invoiceNumber: true,
        channel: true,
        total: true,
        paidAmount: true,
        dueAmount: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.dealerPayment.findMany({
      where: { tenantId, dealerId, ...(from || to ? { paidAt: createdAt } : {}) },
      orderBy: { paidAt: 'asc' },
      include: { allocations: true },
    }),
    prisma.wholesaleCreditNote.findMany({
      where: { tenantId, dealerId, status: 'POSTED', ...dateFilter },
      orderBy: { createdAt: 'asc' },
      select: { id: true, creditNoteNumber: true, total: true, createdAt: true },
    }),
  ])

  return {
    dealer: {
      id: dealer.id,
      legalName: dealer.legalName,
      tradingName: dealer.tradingName,
      dealerCode: dealer.dealerCode,
      totalDue: dealer.totalDue,
      creditLimit: dealer.creditLimit,
    },
    invoices,
    payments,
    creditNotes,
  }
}

export async function recordPayment(
  tenantId: string,
  input: RecordPaymentInput,
  collectedById?: string | null,
  actorEmail?: string,
) {
  if (input.method === 'CREDIT') throw new AppError('Cannot record CREDIT as a collection payment', 400)
  const dealer = await prisma.dealer.findFirst({ where: { id: input.dealerId, tenantId } })
  if (!dealer) throw new AppError('Dealer not found', 404)

  const allocations = input.allocations || []
  const allocSum = round2(allocations.reduce((s, a) => s + a.amount, 0))
  if (allocations.length && Math.abs(allocSum - input.amount) > 0.01) {
    throw new AppError('Allocation sum must equal payment amount', 400)
  }

  // Auto-allocate FIFO if none provided
  let finalAllocs = allocations
  if (!finalAllocs.length) {
    const open = await prisma.wholesaleInvoice.findMany({
      where: {
        tenantId,
        dealerId: input.dealerId,
        dueAmount: { gt: 0 },
        status: { in: ['POSTED', 'PARTIAL'] },
      },
      orderBy: { createdAt: 'asc' },
    })
    let remaining = input.amount
    finalAllocs = []
    for (const inv of open) {
      if (remaining <= 0.001) break
      const take = Math.min(inv.dueAmount, remaining)
      finalAllocs.push({ invoiceId: inv.id, amount: round2(take) })
      remaining = round2(remaining - take)
    }
  }

  for (const a of finalAllocs) {
    const inv = await prisma.wholesaleInvoice.findFirst({
      where: { id: a.invoiceId, tenantId, dealerId: input.dealerId },
    })
    if (!inv) throw new AppError(`Invoice ${a.invoiceId} not found`, 404)
    if (a.amount > inv.dueAmount + 0.01) {
      throw new AppError(`Allocation exceeds due on ${inv.invoiceNumber}`, 400)
    }
  }

  const receiptNumber = await generateDealerPaymentReceiptNumber(tenantId)

  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.dealerPayment.create({
      data: {
        tenantId,
        branchId: input.branchId || null,
        dealerId: input.dealerId,
        receiptNumber,
        amount: input.amount,
        method: input.method,
        reference: input.reference || null,
        notes: input.notes || null,
        status: 'COMPLETED',
        collectedById: collectedById || null,
        paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
        allocations: {
          create: finalAllocs.map((a) => ({
            invoiceId: a.invoiceId,
            amount: a.amount,
          })),
        },
      },
      include: { allocations: true },
    })

    for (const a of finalAllocs) {
      const inv = await tx.wholesaleInvoice.findUnique({ where: { id: a.invoiceId } })
      if (!inv) continue
      const paidAmount = round2(inv.paidAmount + a.amount)
      const dueAmount = round2(Math.max(0, inv.dueAmount - a.amount))
      await tx.wholesaleInvoice.update({
        where: { id: inv.id },
        data: {
          paidAmount,
          dueAmount,
          status: dueAmount <= 0.001 ? 'PAID' : 'PARTIAL',
        },
      })
    }

    await tx.dealer.update({
      where: { id: input.dealerId },
      data: { totalDue: { decrement: input.amount } },
    })

    return created
  })

  await emitWholesaleReceiptAccounting({
    tenantId,
    branchId: payment.branchId,
    paymentId: payment.id,
    receiptNumber: payment.receiptNumber,
    amount: payment.amount,
    method: payment.method,
    dealerId: payment.dealerId,
    actorEmail,
  })

  return payment
}

export async function listPayments(
  tenantId: string,
  opts: { skip: number; limit: number; dealerId?: string },
) {
  const where: Prisma.DealerPaymentWhereInput = {
    tenantId,
    ...(opts.dealerId ? { dealerId: opts.dealerId } : {}),
  }
  const [data, total] = await Promise.all([
    prisma.dealerPayment.findMany({
      where,
      skip: opts.skip,
      take: opts.limit,
      orderBy: { paidAt: 'desc' },
      include: {
        dealer: { select: { id: true, legalName: true, tradingName: true } },
        allocations: true,
      },
    }),
    prisma.dealerPayment.count({ where }),
  ])
  return { data, total }
}

export async function listTasks(
  tenantId: string,
  opts: { skip: number; limit: number; status?: string; assigneeId?: string },
) {
  const where: Prisma.DealerCollectionTaskWhereInput = {
    tenantId,
    ...(opts.status ? { status: opts.status as never } : {}),
    ...(opts.assigneeId ? { assigneeId: opts.assigneeId } : {}),
  }
  const [data, total] = await Promise.all([
    prisma.dealerCollectionTask.findMany({
      where,
      skip: opts.skip,
      take: opts.limit,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      include: {
        dealer: { select: { id: true, legalName: true, tradingName: true, totalDue: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.dealerCollectionTask.count({ where }),
  ])
  return { data, total }
}

export async function createTask(tenantId: string, input: CreateTaskInput) {
  const dealer = await prisma.dealer.findFirst({ where: { id: input.dealerId, tenantId } })
  if (!dealer) throw new AppError('Dealer not found', 404)
  return prisma.dealerCollectionTask.create({
    data: {
      tenantId,
      branchId: input.branchId || null,
      dealerId: input.dealerId,
      assigneeId: input.assigneeId || null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      targetAmount: input.targetAmount ?? null,
      notes: input.notes || null,
      status: 'OPEN',
    },
    include: {
      dealer: { select: { id: true, legalName: true, tradingName: true, totalDue: true } },
      assignee: { select: { id: true, name: true, email: true } },
    },
  })
}

export async function updateTask(tenantId: string, id: string, input: UpdateTaskInput) {
  const task = await prisma.dealerCollectionTask.findFirst({ where: { id, tenantId } })
  if (!task) throw new AppError('Collection task not found', 404)
  return prisma.dealerCollectionTask.update({
    where: { id },
    data: {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
      ...(input.dueDate !== undefined
        ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
        : {}),
      ...(input.targetAmount !== undefined ? { targetAmount: input.targetAmount } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.status === 'DONE' ? { completedAt: new Date() } : {}),
    },
    include: {
      dealer: { select: { id: true, legalName: true, tradingName: true, totalDue: true } },
      assignee: { select: { id: true, name: true, email: true } },
    },
  })
}
