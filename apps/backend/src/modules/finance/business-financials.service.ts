import { prisma } from '../../config/database'
import { listBusinessDays, normalizeBusinessDate, businessDateDb } from '../../utils/date-range'
import { buildDailyClosingPreview } from '../daily-closing/daily-closing.service'

/** Canonical day financials — same formulas as Daily Closing preview */
export interface BusinessFinancialSummary {
  salesRevenue: number
  grossSales: number
  otherIncome: number
  reloadCommission: number
  salesCount: number
  cogs: number
  repairPartsCogs: number
  opExpenses: number
  refundsTotal: number
  grossProfit: number
  netProfit: number
}

export interface DailyRevenueRow {
  date: string
  totalRevenue: number
  salesRevenue: number
  otherIncome: number
  cogs: number
  totalExpenses: number
  refundsTotal: number
  grossProfit: number
  profit: number
  reloadCommission: number
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function emptySummary(): BusinessFinancialSummary {
  return {
    salesRevenue: 0,
    grossSales: 0,
    otherIncome: 0,
    reloadCommission: 0,
    salesCount: 0,
    cogs: 0,
    repairPartsCogs: 0,
    opExpenses: 0,
    refundsTotal: 0,
    grossProfit: 0,
    netProfit: 0,
  }
}

function addSummaries(a: BusinessFinancialSummary, b: BusinessFinancialSummary): BusinessFinancialSummary {
  return {
    salesRevenue: round2(a.salesRevenue + b.salesRevenue),
    grossSales: round2(a.grossSales + b.grossSales),
    otherIncome: round2(a.otherIncome + b.otherIncome),
    reloadCommission: round2(a.reloadCommission + b.reloadCommission),
    salesCount: a.salesCount + b.salesCount,
    cogs: round2(a.cogs + b.cogs),
    repairPartsCogs: round2(a.repairPartsCogs + b.repairPartsCogs),
    opExpenses: round2(a.opExpenses + b.opExpenses),
    refundsTotal: round2(a.refundsTotal + b.refundsTotal),
    grossProfit: round2(a.grossProfit + b.grossProfit),
    netProfit: round2(a.netProfit + b.netProfit),
  }
}

function mapPreviewToSummary(
  preview: Awaited<ReturnType<typeof buildDailyClosingPreview>>,
): BusinessFinancialSummary {
  const s = preview.sales
  const p = preview.profit
  const otherIncome = round2(
    s.repairIncome + s.billPaymentIncome + s.otherIncome + s.creditPayments,
  )
  const repairPartsCogs = round2(p.repairPartsCogs ?? 0)
  return {
    salesRevenue: s.totalSales,
    grossSales: p.grossSales,
    otherIncome,
    reloadCommission: p.reloadCommission,
    salesCount: s.salesCount,
    cogs: p.cogs,
    repairPartsCogs,
    opExpenses: preview.expenses.totalExpenses,
    refundsTotal: s.refundsTotal,
    grossProfit: p.grossProfit,
    netProfit: p.netProfit,
  }
}

export function toDailyRevenueRow(date: string, fin: BusinessFinancialSummary): DailyRevenueRow {
  const totalCogs = round2(fin.cogs + fin.repairPartsCogs)
  const ancillaryIncome = round2(fin.otherIncome + fin.reloadCommission)
  return {
    date,
    totalRevenue: round2(fin.grossSales + fin.reloadCommission),
    salesRevenue: fin.salesRevenue,
    otherIncome: ancillaryIncome,
    cogs: totalCogs,
    totalExpenses: fin.opExpenses,
    refundsTotal: fin.refundsTotal,
    grossProfit: fin.grossProfit,
    profit: fin.netProfit,
    reloadCommission: fin.reloadCommission,
  }
}

export function financialsFromPreview(
  preview: Awaited<ReturnType<typeof buildDailyClosingPreview>>,
): BusinessFinancialSummary {
  return mapPreviewToSummary(preview)
}

export async function getBranchDayFinancials(
  tenantId: string,
  branchId: string,
  dateStr: string,
): Promise<BusinessFinancialSummary> {
  const dateKey = normalizeBusinessDate(dateStr)
  const closed = await prisma.dailyClosing.findUnique({
    where: {
      tenantId_branchId_date: {
        tenantId,
        branchId,
        date: businessDateDb(dateKey),
      },
    },
  })
  if (closed?.status === 'CLOSED') {
    return mapClosingRecordToSummary(closed)
  }
  const preview = await buildDailyClosingPreview(tenantId, branchId, dateKey)
  return mapPreviewToSummary(preview)
}

function mapClosingRecordToSummary(closed: {
  totalSales: number
  grossSales: number
  repairIncome: number
  billPaymentIncome: number
  otherIncome: number
  serviceIncome: number
  reloadCommission: number
  salesCount: number
  cogs: number
  totalExpenses: number
  grossProfit: number
  netProfit: number
}): BusinessFinancialSummary {
  const otherIncome = round2(
    closed.repairIncome + closed.billPaymentIncome + closed.otherIncome + closed.serviceIncome,
  )
  return {
    salesRevenue: closed.totalSales,
    grossSales: closed.grossSales,
    otherIncome,
    reloadCommission: closed.reloadCommission,
    salesCount: closed.salesCount,
    cogs: closed.cogs,
    repairPartsCogs: 0,
    opExpenses: closed.totalExpenses,
    refundsTotal: 0,
    grossProfit: closed.grossProfit,
    netProfit: closed.netProfit,
  }
}

async function tenantBranchIds(tenantId: string): Promise<string[]> {
  const rows = await prisma.branch.findMany({
    where: { tenantId, isActive: true },
    select: { id: true },
  })
  return rows.map(r => r.id)
}

export async function getPeriodFinancials(
  tenantId: string,
  fromKey: string,
  toKey: string,
  branchId?: string,
): Promise<BusinessFinancialSummary> {
  const days = listBusinessDays(fromKey, toKey)
  const branches = branchId ? [branchId] : await tenantBranchIds(tenantId)

  let total = emptySummary()
  for (const day of days) {
    for (const bid of branches) {
      const dayFin = await getBranchDayFinancials(tenantId, bid, day)
      total = addSummaries(total, dayFin)
    }
  }
  return total
}

export async function getDailyRevenueBreakdown(
  tenantId: string,
  fromKey: string,
  toKey: string,
  branchId?: string,
): Promise<DailyRevenueRow[]> {
  const days = listBusinessDays(fromKey, toKey)
  const branches = branchId ? [branchId] : await tenantBranchIds(tenantId)

  const results: DailyRevenueRow[] = []
  for (const day of days) {
    let dayTotal = emptySummary()
    for (const bid of branches) {
      dayTotal = addSummaries(dayTotal, await getBranchDayFinancials(tenantId, bid, day))
    }
    results.push(toDailyRevenueRow(day, dayTotal))
  }
  return results
}

/** Finance /summary API shape */
export function toFinanceSummaryResponse(
  fin: BusinessFinancialSummary,
  period: { from: string; to: string },
) {
  const ancillaryIncome = round2(fin.otherIncome + fin.reloadCommission)
  const totalCogs = round2(fin.cogs + fin.repairPartsCogs)
  const totalIncome = round2(fin.grossSales + fin.reloadCommission)
  const totalExpense = round2(totalCogs + fin.opExpenses + fin.refundsTotal)

  return {
    salesRevenue: fin.salesRevenue,
    salesCount: fin.salesCount,
    otherIncome: ancillaryIncome,
    totalIncome,
    cogs: totalCogs,
    opExpenses: fin.opExpenses,
    refundsTotal: fin.refundsTotal,
    reloadCommission: fin.reloadCommission,
    totalExpense,
    grossProfit: fin.grossProfit,
    profit: fin.netProfit,
    period,
  }
}
