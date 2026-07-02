import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database'

export async function branchInvoiceNumbers(
  tenantId: string,
  branchId: string,
  start: Date,
  end: Date,
): Promise<string[]> {
  const sales = await prisma.sale.findMany({
    where: { tenantId, branchId, createdAt: { gte: start, lte: end } },
    select: { invoiceNumber: true },
  })
  return sales.map(s => s.invoiceNumber)
}

export function branchReloadWhere(
  tenantId: string,
  branchId: string,
  start: Date,
  end: Date,
  branchInvoiceNos: string[],
  extra?: { status?: string },
): Prisma.DailyReloadWhereInput {
  const legacyOr: Prisma.DailyReloadWhereInput[] =
    branchInvoiceNos.length > 0
      ? [{ branchId: null, transactionId: { in: branchInvoiceNos } }]
      : []

  return {
    tenantId,
    reloadDate: { gte: start, lte: end },
    ...(extra?.status ? { status: extra.status } : {}),
    OR: [{ branchId }, ...legacyOr],
  }
}

export async function findBranchReloads(
  tenantId: string,
  branchId: string,
  start: Date,
  end: Date,
  extra?: { status?: string },
) {
  const branchInvoiceNos = await branchInvoiceNumbers(tenantId, branchId, start, end)
  return prisma.dailyReload.findMany({
    where: branchReloadWhere(tenantId, branchId, start, end, branchInvoiceNos, extra),
    orderBy: { reloadDate: 'desc' },
  })
}
