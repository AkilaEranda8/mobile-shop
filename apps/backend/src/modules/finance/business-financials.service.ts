import { prisma } from '../../config/database'
import { listBusinessDays, normalizeBusinessDate, businessDateDb } from '../../utils/date-range'
import { buildDailyClosingPreview } from '../daily-closing/daily-closing.service'

/** Canonical day financials — same formulas as Daily Closing preview */
export interface BusinessFinancialSummary {
  salesRevenue: number
  grossSales: number
  otherIncome: number
  repairIncome: number
  billPaymentIncome: number
  creditPayments: number
  miscIncome: number
  reloadCommission: number
  salesCount: number
  cogs: number
  repairPartsCogs: number
  opExpenses: number
  refundsTotal: number
  grossProfit: number
  netProfit: number
  repairJobsCompleted: number
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
    repairIncome: 0,
    billPaymentIncome: 0,
    creditPayments: 0,
    miscIncome: 0,
    reloadCommission: 0,
    salesCount: 0,
    cogs: 0,
    repairPartsCogs: 0,
    opExpenses: 0,
    refundsTotal: 0,
    grossProfit: 0,
    netProfit: 0,
    repairJobsCompleted: 0,
  }
}

function addSummaries(a: BusinessFinancialSummary, b: BusinessFinancialSummary): BusinessFinancialSummary {
  return {
    salesRevenue: round2(a.salesRevenue + b.salesRevenue),
    grossSales: round2(a.grossSales + b.grossSales),
    otherIncome: round2(a.otherIncome + b.otherIncome),
    repairIncome: round2(a.repairIncome + b.repairIncome),
    billPaymentIncome: round2(a.billPaymentIncome + b.billPaymentIncome),
    creditPayments: round2(a.creditPayments + b.creditPayments),
    miscIncome: round2(a.miscIncome + b.miscIncome),
    reloadCommission: round2(a.reloadCommission + b.reloadCommission),
    salesCount: a.salesCount + b.salesCount,
    cogs: round2(a.cogs + b.cogs),
    repairPartsCogs: round2(a.repairPartsCogs + b.repairPartsCogs),
    opExpenses: round2(a.opExpenses + b.opExpenses),
    refundsTotal: round2(a.refundsTotal + b.refundsTotal),
    grossProfit: round2(a.grossProfit + b.grossProfit),
    netProfit: round2(a.netProfit + b.netProfit),
    repairJobsCompleted: a.repairJobsCompleted + b.repairJobsCompleted,
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
    repairIncome: round2(s.repairIncome),
    billPaymentIncome: round2(s.billPaymentIncome),
    creditPayments: round2(s.creditPayments),
    miscIncome: round2(s.otherIncome),
    reloadCommission: p.reloadCommission,
    salesCount: s.salesCount,
    cogs: p.cogs,
    repairPartsCogs,
    opExpenses: preview.expenses.totalExpenses,
    refundsTotal: s.refundsTotal,
    grossProfit: p.grossProfit,
    netProfit: p.netProfit,
    repairJobsCompleted: preview.repairs.repairsCompleted,
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
    const frozenEmpty =
      Number(closed.salesCount ?? 0) === 0 &&
      Number(closed.totalSales ?? 0) === 0 &&
      Number(closed.grossSales ?? 0) === 0 &&
      Number(closed.repairIncome ?? 0) === 0 &&
      Number(closed.reloadCommission ?? 0) === 0

    // Day closed before any activity (or empty freeze) — use live preview so
    // later POS/repair sales still appear on Dashboard / Finance.
    if (frozenEmpty) {
      const preview = await buildDailyClosingPreview(tenantId, branchId, dateKey)
      const live = mapPreviewToSummary(preview)
      if (
        live.salesCount > 0 ||
        live.salesRevenue > 0 ||
        live.grossSales > 0 ||
        live.repairIncome > 0
      ) {
        return live
      }
    }
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
    repairIncome: round2(closed.repairIncome),
    billPaymentIncome: round2(closed.billPaymentIncome),
    creditPayments: 0,
    miscIncome: round2(closed.otherIncome + closed.serviceIncome),
    reloadCommission: closed.reloadCommission,
    salesCount: closed.salesCount,
    cogs: closed.cogs,
    repairPartsCogs: 0,
    opExpenses: closed.totalExpenses,
    refundsTotal: 0,
    grossProfit: closed.grossProfit,
    netProfit: closed.netProfit,
    repairJobsCompleted: 0,
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
    repairIncome: fin.repairIncome,
    billPaymentIncome: fin.billPaymentIncome,
    creditPayments: fin.creditPayments,
    miscIncome: fin.miscIncome,
    reloadCommission: fin.reloadCommission,
    totalIncome,
    posCogs: fin.cogs,
    repairPartsCogs: fin.repairPartsCogs,
    cogs: totalCogs,
    opExpenses: fin.opExpenses,
    refundsTotal: fin.refundsTotal,
    repairJobsCompleted: fin.repairJobsCompleted,
    totalExpense,
    grossProfit: fin.grossProfit,
    profit: fin.netProfit,
    period,
  }
}
