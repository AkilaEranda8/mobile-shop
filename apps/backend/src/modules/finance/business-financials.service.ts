import { prisma } from '../../config/database'
import { listBusinessDays, normalizeBusinessDate, businessDateDb, businessDayRange } from '../../utils/date-range'
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
  /** AP settlements — cash out only, excluded from net profit */
  supplierPayments: number
  /** Reload provider settlements — cash out only, excluded from net profit */
  reloadProviderPayments: number
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
  supplierPayments: number
  reloadProviderPayments: number
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
    supplierPayments: 0,
    reloadProviderPayments: 0,
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
    supplierPayments: round2(a.supplierPayments + b.supplierPayments),
    reloadProviderPayments: round2(a.reloadProviderPayments + b.reloadProviderPayments),
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
    s.repairIncome + s.billPaymentIncome + s.otherIncome,
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
    supplierPayments: round2(preview.expenses.supplierPayments ?? 0),
    reloadProviderPayments: round2(preview.expenses.reloadProviderPayments ?? 0),
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
    supplierPayments: fin.supplierPayments,
    reloadProviderPayments: fin.reloadProviderPayments,
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
    return await mapClosingRecordToSummary(closed)
  }
  const preview = await buildDailyClosingPreview(tenantId, branchId, dateKey)
  return mapPreviewToSummary(preview)
}

async function sumSettlementExpensesForDay(
  tenantId: string,
  branchId: string,
  dateKey: string,
  category: 'Supplier Payment' | 'Reload Provider',
): Promise<number> {
  const { start, end } = businessDayRange(dateKey)
  const agg = await prisma.transaction.aggregate({
    where: {
      tenantId,
      branchId,
      type: 'EXPENSE',
      category,
      OR: [
        { occurredAt: { gte: start, lte: end } },
        { AND: [{ occurredAt: null }, { createdAt: { gte: start, lte: end } }] },
      ],
    },
    _sum: { amount: true },
  })
  return round2(agg._sum.amount ?? 0)
}

async function sumSupplierPaymentsForDay(
  tenantId: string,
  branchId: string,
  dateKey: string,
): Promise<number> {
  return sumSettlementExpensesForDay(tenantId, branchId, dateKey, 'Supplier Payment')
}

async function mapClosingRecordToSummary(closed: {
  tenantId: string
  branchId: string
  date: Date
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
  summaryJson?: unknown
}): Promise<BusinessFinancialSummary> {
  const summary = (closed.summaryJson ?? {}) as {
    expenses?: {
      totalExpenses?: number
      supplierPayments?: number
      reloadProviderPayments?: number
    }
    profit?: { grossSales?: number; grossProfit?: number; netProfit?: number }
    sales?: { reloadSales?: number }
  }
  const expensesMeta = summary.expenses
  const hasSplit = expensesMeta != null && typeof expensesMeta.supplierPayments === 'number'
  const hasReloadSplit = expensesMeta != null && typeof expensesMeta.reloadProviderPayments === 'number'
  const dateKey = closed.date.toISOString().slice(0, 10)

  let supplierPayments = hasSplit
    ? round2(expensesMeta.supplierPayments ?? 0)
    : await sumSupplierPaymentsForDay(closed.tenantId, closed.branchId, dateKey)

  let reloadProviderPayments = hasReloadSplit
    ? round2(expensesMeta.reloadProviderPayments ?? 0)
    : await sumSettlementExpensesForDay(closed.tenantId, closed.branchId, dateKey, 'Reload Provider')

  let opExpenses = round2(
    hasSplit && typeof expensesMeta?.totalExpenses === 'number'
      ? expensesMeta.totalExpenses
      : closed.totalExpenses,
  )
  let netProfit = round2(closed.netProfit)
  let grossSales = round2(closed.grossSales)
  let grossProfit = round2(closed.grossProfit)

  // Legacy closes baked Supplier Payment into totalExpenses + netProfit.
  // Only unwind when OpEx still includes those settlements (otherwise we'd inflate profit).
  if (!hasSplit && supplierPayments > 0 && opExpenses + 0.01 >= supplierPayments) {
    opExpenses = round2(opExpenses - supplierPayments)
    netProfit = round2(netProfit + supplierPayments)
  }

  // Legacy closes baked Reload Provider settlements into OpEx / net profit.
  if (!hasReloadSplit && reloadProviderPayments > 0 && opExpenses + 0.01 >= reloadProviderPayments) {
    opExpenses = round2(opExpenses - reloadProviderPayments)
    netProfit = round2(netProfit + reloadProviderPayments)
  }

  // Legacy closes counted reload face value inside gross sales / gross profit.
  // Current P&L keeps face value as pass-through and only counts commission.
  const reloadSales = round2(summary.sales?.reloadSales ?? 0)
  if (reloadSales > 0 && !hasReloadSplit) {
    grossSales = round2(Math.max(0, grossSales - reloadSales))
    grossProfit = round2(grossProfit - reloadSales)
    netProfit = round2(netProfit - reloadSales)
  }

  const otherIncome = round2(
    closed.repairIncome + closed.billPaymentIncome + closed.otherIncome + closed.serviceIncome,
  )
  return {
    salesRevenue: closed.totalSales,
    grossSales,
    otherIncome,
    repairIncome: round2(closed.repairIncome),
    billPaymentIncome: round2(closed.billPaymentIncome),
    creditPayments: 0,
    miscIncome: round2(closed.otherIncome + closed.serviceIncome),
    reloadCommission: closed.reloadCommission,
    salesCount: closed.salesCount,
    cogs: closed.cogs,
    repairPartsCogs: 0,
    opExpenses,
    supplierPayments,
    reloadProviderPayments,
    refundsTotal: 0,
    grossProfit,
    netProfit,
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
    supplierPayments: fin.supplierPayments,
    reloadProviderPayments: fin.reloadProviderPayments,
    cashOutTotal: round2(fin.opExpenses + fin.supplierPayments + fin.reloadProviderPayments + fin.refundsTotal),
    refundsTotal: fin.refundsTotal,
    repairJobsCompleted: fin.repairJobsCompleted,
    totalExpense,
    grossProfit: fin.grossProfit,
    profit: fin.netProfit,
    period,
  }
}
