import { prisma } from '../../../config/database'
import { businessDateDb, businessDayRange } from '../../../utils/date-range'

export type SyncWindow = { from?: string; to?: string }

export async function enqueueOutboxItem(opts: {
  tenantId: string
  branchId?: string | null
  sourceType: string
  sourceId: string
  eventType: string
  payload?: Record<string, unknown>
}) {
  const where = {
    tenantId_sourceType_sourceId_eventType: {
      tenantId: opts.tenantId,
      sourceType: opts.sourceType,
      sourceId: opts.sourceId,
      eventType: opts.eventType,
    },
  }
  const existing = await prisma.accountingOutbox.findUnique({ where })
  if (existing) {
    if (existing.status === 'FAILED') {
      await prisma.accountingOutbox.update({
        where: { id: existing.id },
        data: { status: 'PENDING', lastError: null },
      })
    }
    return
  }
  await prisma.accountingOutbox.create({
    data: {
      tenantId: opts.tenantId,
      branchId: opts.branchId ?? undefined,
      sourceType: opts.sourceType,
      sourceId: opts.sourceId,
      eventType: opts.eventType,
      payload: (opts.payload ?? undefined) as any,
      status: 'PENDING',
    },
  })
}

async function existingLinksSet(tenantId: string, sourceType: string, eventType: string, ids: string[]) {
  if (!ids.length) return new Set<string>()
  const rows = await prisma.integrationLink.findMany({
    where: { tenantId, sourceType, eventType, sourceId: { in: ids } },
    select: { sourceId: true },
  })
  return new Set(rows.map(r => r.sourceId))
}

export async function syncOutboxForTenant(
  tenantId: string,
  branchId: string | undefined,
  window: SyncWindow,
) {
  const from = window.from
  const to = window.to
  const createdAtFilter = (from || to)
    ? {
        createdAt: {
          ...(from ? { gte: businessDayRange(from).start } : {}),
          ...(to ? { lte: businessDayRange(to).end } : {}),
        },
      }
    : {}

  // SALES (skip REPAIR-generated sales to avoid double counting)
  const sales = await prisma.sale.findMany({
    where: {
      tenantId,
      ...(branchId ? { branchId } : {}),
      source: { not: 'REPAIR' },
      status: { in: ['PAID', 'PARTIAL', 'DUE'] },
      ...createdAtFilter,
    },
    select: { id: true, branchId: true },
    take: 5000,
  })
  const saleIds = sales.map(s => s.id)
  const saleLinked = await existingLinksSet(tenantId, 'Sale', 'SALE_CREATED', saleIds)
  const saleCogsLinked = await existingLinksSet(tenantId, 'Sale', 'SALE_COGS', saleIds)
  await Promise.all(
    sales
      .filter(s => !saleLinked.has(s.id))
      .map(s => enqueueOutboxItem({ tenantId, branchId: s.branchId, sourceType: 'Sale', sourceId: s.id, eventType: 'SALE_CREATED' })),
  )
  await Promise.all(
    sales
      .filter(s => !saleCogsLinked.has(s.id))
      .map(s => enqueueOutboxItem({ tenantId, branchId: s.branchId, sourceType: 'Sale', sourceId: s.id, eventType: 'SALE_COGS' })),
  )

  // EXPENSES (exclude supplier payments — journaled as AP)
  const expenses = await prisma.transaction.findMany({
    where: {
      tenantId,
      ...(branchId ? { branchId } : {}),
      type: 'EXPENSE',
      category: { not: 'Supplier Payment' },
      ...createdAtFilter,
    },
    select: { id: true, branchId: true },
    take: 5000,
  })
  const expIds = expenses.map(e => e.id)
  const expLinked = await existingLinksSet(tenantId, 'Transaction', 'EXPENSE_CREATED', expIds)
  await Promise.all(
    expenses
      .filter(e => !expLinked.has(e.id))
      .map(e => enqueueOutboxItem({ tenantId, branchId: e.branchId, sourceType: 'Transaction', sourceId: e.id, eventType: 'EXPENSE_CREATED' })),
  )

  // AR PAYMENTS (customer credit collections)
  const arPayments = await prisma.transaction.findMany({
    where: {
      tenantId,
      ...(branchId ? { branchId } : {}),
      type: 'INCOME',
      category: 'Customer Credit Payment',
      ...createdAtFilter,
    },
    select: { id: true, branchId: true },
    take: 5000,
  })
  const arPayIds = arPayments.map(t => t.id)
  const arPayLinked = await existingLinksSet(tenantId, 'Transaction', 'AR_PAYMENT_RECEIVED', arPayIds)
  await Promise.all(
    arPayments
      .filter(t => !arPayLinked.has(t.id))
      .map(t => enqueueOutboxItem({ tenantId, branchId: t.branchId, sourceType: 'Transaction', sourceId: t.id, eventType: 'AR_PAYMENT_RECEIVED' })),
  )

  // AP PAYMENTS (supplier payments)
  const apPayments = await prisma.transaction.findMany({
    where: {
      tenantId,
      ...(branchId ? { branchId } : {}),
      type: 'EXPENSE',
      category: 'Supplier Payment',
      ...createdAtFilter,
    },
    select: { id: true, branchId: true },
    take: 5000,
  })
  const apPayIds = apPayments.map(t => t.id)
  const apPayLinked = await existingLinksSet(tenantId, 'Transaction', 'AP_PAYMENT_MADE', apPayIds)
  await Promise.all(
    apPayments
      .filter(t => !apPayLinked.has(t.id))
      .map(t => enqueueOutboxItem({ tenantId, branchId: t.branchId, sourceType: 'Transaction', sourceId: t.id, eventType: 'AP_PAYMENT_MADE' })),
  )

  // REPAIRS DELIVERED
  const repairs = await prisma.repairTicket.findMany({
    where: { tenantId, ...(branchId ? { branchId } : {}), status: 'DELIVERED', ...createdAtFilter },
    select: { id: true, branchId: true },
    take: 5000,
  })
  const repairIds = repairs.map(r => r.id)
  const repairLinked = await existingLinksSet(tenantId, 'RepairTicket', 'REPAIR_DELIVERED', repairIds)
  const repairCogsLinked = await existingLinksSet(tenantId, 'RepairTicket', 'REPAIR_COGS', repairIds)
  await Promise.all(
    repairs
      .filter(r => !repairLinked.has(r.id))
      .map(r => enqueueOutboxItem({ tenantId, branchId: r.branchId, sourceType: 'RepairTicket', sourceId: r.id, eventType: 'REPAIR_DELIVERED' })),
  )
  await Promise.all(
    repairs
      .filter(r => !repairCogsLinked.has(r.id))
      .map(r => enqueueOutboxItem({ tenantId, branchId: r.branchId, sourceType: 'RepairTicket', sourceId: r.id, eventType: 'REPAIR_COGS' })),
  )

  // PURCHASE ORDERS RECEIVED
  const purchases = await prisma.purchaseOrder.findMany({
    where: {
      tenantId,
      ...(branchId ? { branchId } : {}),
      status: { in: ['RECEIVED', 'CLOSED'] },
      receivedAt: {
        not: null,
        ...(from ? { gte: businessDayRange(from).start } : {}),
        ...(to ? { lte: businessDayRange(to).end } : {}),
      },
    },
    select: { id: true, branchId: true },
    take: 5000,
  })
  const poIds = purchases.map(p => p.id)
  const poLinked = await existingLinksSet(tenantId, 'PurchaseOrder', 'PURCHASE_RECEIVED', poIds)
  await Promise.all(
    purchases
      .filter(p => !poLinked.has(p.id))
      .map(p => enqueueOutboxItem({ tenantId, branchId: p.branchId, sourceType: 'PurchaseOrder', sourceId: p.id, eventType: 'PURCHASE_RECEIVED' })),
  )

  // DAILY CLOSING — cash variance (closed days only, non-zero variance)
  const closingDateFilter = (from || to)
    ? {
        date: {
          ...(from ? { gte: businessDateDb(from) } : {}),
          ...(to ? { lte: businessDateDb(to) } : {}),
        },
      }
    : {}

  const closings = await prisma.dailyClosing.findMany({
    where: {
      tenantId,
      ...(branchId ? { branchId } : {}),
      status: 'CLOSED',
      ...closingDateFilter,
    },
    select: { id: true, branchId: true, cashVariance: true },
    take: 5000,
  })
  const closingIds = closings.map(c => c.id)
  const closingLinked = await existingLinksSet(tenantId, 'DailyClosing', 'DAILY_CLOSING_VARIANCE', closingIds)
  const closingsToEnqueue = closings.filter(
    c => !closingLinked.has(c.id) && Math.abs(Number(c.cashVariance ?? 0)) >= 0.01,
  )
  await Promise.all(
    closingsToEnqueue.map(c =>
      enqueueOutboxItem({
        tenantId,
        branchId: c.branchId,
        sourceType: 'DailyClosing',
        sourceId: c.id,
        eventType: 'DAILY_CLOSING_VARIANCE',
        payload: { cashVariance: c.cashVariance },
      }),
    ),
  )

  // SALE RETURNS
  const saleReturns = await prisma.saleReturn.findMany({
    where: {
      tenantId,
      ...(branchId ? { branchId } : {}),
      ...createdAtFilter,
    },
    select: { id: true, branchId: true },
    take: 5000,
  })
  const returnIds = saleReturns.map(r => r.id)
  const returnLinked = await existingLinksSet(tenantId, 'SaleReturn', 'SALE_RETURN_CREATED', returnIds)
  const returnCogsLinked = await existingLinksSet(tenantId, 'SaleReturn', 'SALE_RETURN_COGS', returnIds)
  await Promise.all(
    saleReturns
      .filter(r => !returnLinked.has(r.id))
      .map(r => enqueueOutboxItem({ tenantId, branchId: r.branchId, sourceType: 'SaleReturn', sourceId: r.id, eventType: 'SALE_RETURN_CREATED' })),
  )
  await Promise.all(
    saleReturns
      .filter(r => !returnCogsLinked.has(r.id))
      .map(r => enqueueOutboxItem({ tenantId, branchId: r.branchId, sourceType: 'SaleReturn', sourceId: r.id, eventType: 'SALE_RETURN_COGS' })),
  )

  return {
    enqueued: {
      sales: sales.length - saleLinked.size,
      saleCogs: sales.filter(s => !saleCogsLinked.has(s.id)).length,
      expenses: expenses.length - expLinked.size,
      repairs: repairs.length - repairLinked.size,
      repairCogs: repairs.filter(r => !repairCogsLinked.has(r.id)).length,
      purchases: purchases.length - poLinked.size,
      dailyClosingVariance: closingsToEnqueue.length,
      saleReturns: saleReturns.length - returnLinked.size,
      saleReturnCogs: saleReturns.filter(r => !returnCogsLinked.has(r.id)).length,
      arPayments: arPayments.length - arPayLinked.size,
      apPayments: apPayments.length - apPayLinked.size,
    },
    scanned: {
      sales: sales.length,
      expenses: expenses.length,
      repairs: repairs.length,
      purchases: purchases.length,
      dailyClosings: closings.length,
      saleReturns: saleReturns.length,
      arPayments: arPayments.length,
      apPayments: apPayments.length,
    },
  }
}

