import { prisma } from '../../../config/database'
import { round2 } from '../wholesale-uom.util'

export async function salesByChannel(
  tenantId: string,
  opts: { from?: string; to?: string; branchId?: string },
) {
  const where = dateBranchWhere(tenantId, opts)
  const rows = await prisma.wholesaleInvoice.groupBy({
    by: ['channel'],
    where: { ...where, status: { notIn: ['VOID', 'CANCELLED', 'DRAFT'] } },
    _sum: { total: true, paidAmount: true, dueAmount: true },
    _count: { _all: true },
  })
  return rows.map((r) => ({
    channel: r.channel,
    invoiceCount: r._count._all,
    total: round2(r._sum.total || 0),
    paidAmount: round2(r._sum.paidAmount || 0),
    dueAmount: round2(r._sum.dueAmount || 0),
  }))
}

export async function salesByDealer(
  tenantId: string,
  opts: { from?: string; to?: string; branchId?: string; limit?: number },
) {
  const where = dateBranchWhere(tenantId, opts)
  const rows = await prisma.wholesaleInvoice.groupBy({
    by: ['dealerId'],
    where: { ...where, status: { notIn: ['VOID', 'CANCELLED', 'DRAFT'] } },
    _sum: { total: true, dueAmount: true },
    _count: { _all: true },
    orderBy: { _sum: { total: 'desc' } },
    take: opts.limit ?? 50,
  })
  const dealers = await prisma.dealer.findMany({
    where: { id: { in: rows.map((r) => r.dealerId) } },
    select: { id: true, legalName: true, tradingName: true, dealerCode: true },
  })
  const map = new Map(dealers.map((d) => [d.id, d]))
  return rows.map((r) => ({
    dealer: map.get(r.dealerId) || { id: r.dealerId },
    invoiceCount: r._count._all,
    total: round2(r._sum.total || 0),
    dueAmount: round2(r._sum.dueAmount || 0),
  }))
}

export async function salesByProduct(
  tenantId: string,
  opts: { from?: string; to?: string; branchId?: string; limit?: number },
) {
  const invoices = await prisma.wholesaleInvoice.findMany({
    where: {
      ...dateBranchWhere(tenantId, opts),
      status: { notIn: ['VOID', 'CANCELLED', 'DRAFT'] },
    },
    select: { id: true },
  })
  const ids = invoices.map((i) => i.id)
  if (!ids.length) return []

  const lines = await prisma.wholesaleInvoiceLine.groupBy({
    by: ['productId', 'productName', 'sku'],
    where: { invoiceId: { in: ids } },
    _sum: { quantity: true, stockQty: true, total: true },
    orderBy: { _sum: { total: 'desc' } },
    take: opts.limit ?? 50,
  })
  return lines.map((l) => ({
    productId: l.productId,
    productName: l.productName,
    sku: l.sku,
    quantity: round2(l._sum.quantity || 0),
    stockQty: round2(l._sum.stockQty || 0),
    total: round2(l._sum.total || 0),
  }))
}

/** Fast / slow movers based on invoice line stockQty over window. */
export async function movers(
  tenantId: string,
  opts: { from?: string; to?: string; branchId?: string; limit?: number },
) {
  const byProduct = await salesByProduct(tenantId, { ...opts, limit: 500 })
  const sorted = [...byProduct].sort((a, b) => b.stockQty - a.stockQty)
  const limit = opts.limit ?? 20
  return {
    fast: sorted.slice(0, limit),
    slow: [...sorted].reverse().slice(0, limit),
  }
}

export async function outstanding(tenantId: string, opts: { dealerId?: string; limit?: number }) {
  const invoices = await prisma.wholesaleInvoice.findMany({
    where: {
      tenantId,
      dueAmount: { gt: 0 },
      status: { in: ['POSTED', 'PARTIAL'] },
      ...(opts.dealerId ? { dealerId: opts.dealerId } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: opts.limit ?? 100,
    include: {
      dealer: { select: { id: true, legalName: true, tradingName: true, dealerCode: true } },
    },
  })
  const totalDue = round2(invoices.reduce((s, i) => s + i.dueAmount, 0))
  return { totalDue, invoices }
}

function dateBranchWhere(
  tenantId: string,
  opts: { from?: string; to?: string; branchId?: string },
) {
  return {
    tenantId,
    ...(opts.branchId ? { fulfillmentBranchId: opts.branchId } : {}),
    ...(opts.from || opts.to
      ? {
          createdAt: {
            ...(opts.from ? { gte: new Date(opts.from) } : {}),
            ...(opts.to ? { lte: new Date(opts.to) } : {}),
          },
        }
      : {}),
  }
}
