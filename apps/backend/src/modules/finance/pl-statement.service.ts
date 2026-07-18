import { prisma } from '../../config/database'
import {
  listBusinessDays,
  resolveQueryDateRange,
  shiftBusinessDate,
} from '../../utils/date-range'
import { isReloadSaleItem } from './reload-item.util'
import {
  getDailyRevenueBreakdown,
  getPeriodFinancials,
  toFinanceSummaryResponse,
  type BusinessFinancialSummary,
} from './business-financials.service'
import { isTenantFeatureEnabled } from '../../utils/tenant-feature.util'

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function isMobileProduct(product: { trackImei?: boolean; category?: { name?: string; slug?: string } | null } | null) {
  if (!product) return false
  if (product.trackImei) return true
  const cat = `${product.category?.name ?? ''} ${product.category?.slug ?? ''}`.toLowerCase()
  return /mobile|phone|smartphone|handset/.test(cat)
}

type LineItem = { key: string; label: string; amount: number }

export type PlStatementLine = {
  section: 'income' | 'cost' | 'profit' | 'note'
  label: string
  amount?: number
  bold?: boolean
  highlight?: boolean
  indent?: number
  separator?: boolean
}

export type RepairAccrualSummary = {
  jobs: number
  quoted: number
  discount: number
  collected: number
  cashPaid: number
  creditDue: number
  partsBuy: number
  netProfit: number
}

async function buildRepairAccrualSummary(
  tenantId: string,
  fromKey: string,
  toKey: string,
  branchId?: string,
): Promise<RepairAccrualSummary> {
  const { start, end } = resolveQueryDateRange({ from: fromKey, to: toKey })
  const bf = await branchFilter(tenantId, branchId)
  const repairs = await prisma.repairTicket.findMany({
    where: {
      tenantId,
      ...bf,
      status: 'DELIVERED',
      completedAt: { gte: start, lte: end },
    },
    include: { spareParts: { select: { quantity: true, unitBuyCost: true } } },
  })

  let quoted = 0
  let discount = 0
  let collected = 0
  let cashPaid = 0
  let creditDue = 0
  let partsBuy = 0

  for (const r of repairs) {
    const quote = Number(r.estimatedCost) || 0
    const bill = r.actualCost != null ? Number(r.actualCost) : quote
    quoted += quote
    discount += Math.max(0, quote - bill)
    collected += bill
    cashPaid += r.paidAmount != null ? Number(r.paidAmount) : bill
    creditDue += r.dueAmount != null ? Number(r.dueAmount) : Math.max(0, bill - (r.paidAmount != null ? Number(r.paidAmount) : bill))
    for (const p of r.spareParts) {
      partsBuy += Number(p.quantity) * Number(p.unitBuyCost ?? 0)
    }
  }

  return {
    jobs: repairs.length,
    quoted: round2(quoted),
    discount: round2(discount),
    collected: round2(collected),
    cashPaid: round2(cashPaid),
    creditDue: round2(creditDue),
    partsBuy: round2(partsBuy),
    netProfit: round2(collected - partsBuy),
  }
}

function buildStatementLines(
  summary: ReturnType<typeof toFinanceSummaryResponse>,
  fin: BusinessFinancialSummary,
  repairAccrual: RepairAccrualSummary,
): PlStatementLine[] {
  const lines: PlStatementLine[] = [
    { section: 'income', label: 'POS Sales Revenue', amount: summary.salesRevenue, indent: 1 },
  ]

  if (summary.repairIncome > 0) {
    lines.push({ section: 'income', label: 'Repair Income (Cash Received)', amount: summary.repairIncome, indent: 1 })
  }
  if (summary.billPaymentIncome > 0) {
    lines.push({ section: 'income', label: 'Bill Payment Income', amount: summary.billPaymentIncome, indent: 1 })
  }
  if (summary.creditPayments > 0) {
    lines.push({ section: 'income', label: 'Customer Credit Payments', amount: summary.creditPayments, indent: 1 })
  }
  if (summary.reloadCommission > 0) {
    lines.push({ section: 'income', label: 'Reload Commission', amount: summary.reloadCommission, indent: 1 })
  }
  if (summary.miscIncome > 0) {
    lines.push({ section: 'income', label: 'Other Income', amount: summary.miscIncome, indent: 1 })
  }

  lines.push({
    section: 'income',
    label: 'Total Income',
    amount: summary.totalIncome,
    bold: true,
    separator: true,
  })

  lines.push({ section: 'cost', label: 'POS Cost of Goods Sold', amount: summary.posCogs, indent: 1 })
  if (summary.repairPartsCogs > 0) {
    lines.push({ section: 'cost', label: 'Repair Parts Cost', amount: summary.repairPartsCogs, indent: 1 })
  }
  if (summary.refundsTotal > 0) {
    lines.push({ section: 'cost', label: 'Refunds', amount: summary.refundsTotal, indent: 1 })
  }

  lines.push({
    section: 'profit',
    label: 'Gross Profit',
    amount: summary.grossProfit,
    bold: true,
    separator: true,
  })

  lines.push({ section: 'cost', label: 'Operating Expenses', amount: summary.opExpenses, indent: 1 })

  lines.push({
    section: 'profit',
    label: 'Net Profit / (Loss)',
    amount: summary.profit,
    bold: true,
    highlight: true,
    separator: true,
  })

  if (repairAccrual.jobs > 0) {
    lines.push({ section: 'note', label: `Repair jobs completed (accrual): ${repairAccrual.jobs}`, indent: 1 })
    lines.push({ section: 'note', label: 'Repair collected (quotes − discounts)', amount: repairAccrual.collected, indent: 1 })
    if (repairAccrual.discount > 0) {
      lines.push({ section: 'note', label: 'Repair discounts', amount: repairAccrual.discount, indent: 1 })
    }
    lines.push({ section: 'note', label: 'Repair parts inventory cost', amount: repairAccrual.partsBuy, indent: 1 })
    lines.push({ section: 'note', label: 'Repair net profit (collected − parts buy)', amount: repairAccrual.netProfit, indent: 1, bold: true })
    if (repairAccrual.creditDue > 0) {
      lines.push({ section: 'note', label: 'Repair credit outstanding', amount: repairAccrual.creditDue, indent: 1 })
    }
  }

  return lines
}

async function branchFilter(tenantId: string, branchId?: string) {
  if (branchId) return { branchId }
  const rows = await prisma.branch.findMany({
    where: { tenantId, isActive: true },
    select: { id: true },
  })
  return { branchId: { in: rows.map(r => r.id) } }
}

async function buildPeriodIncomeBreakdown(
  tenantId: string,
  fromKey: string,
  toKey: string,
  branchId: string | undefined,
  reloadCommission: number,
): Promise<LineItem[]> {
  const { start, end } = resolveQueryDateRange({ from: fromKey, to: toKey })
  const bf = await branchFilter(tenantId, branchId)
  const dailyReloadEnabled = await isTenantFeatureEnabled(tenantId, 'DAILY_RELOAD')

  const sales = await prisma.sale.findMany({
    where: {
      tenantId,
      ...bf,
      status: { not: 'RETURNED' },
      createdAt: { gte: start, lte: end },
      source: { not: 'REPAIR' },
    },
    include: {
      items: { include: { product: { include: { category: true } } } },
    },
  })

  const transactions = await prisma.transaction.findMany({
    where: {
      tenantId,
      ...bf,
      createdAt: { gte: start, lte: end },
    },
  })

  let mobileSales = 0
  let accessorySales = 0
  let serviceIncome = 0
  let reloadPosSales = 0

  for (const sale of sales) {
    for (const item of sale.items) {
      const total = Number(item.total)
      if (isReloadSaleItem(item)) {
        if (dailyReloadEnabled) reloadPosSales += total
        continue
      }
      if (!item.productId) {
        serviceIncome += total
        continue
      }
      if (isMobileProduct(item.product)) mobileSales += total
      else accessorySales += total
    }
  }

  let repairIncome = 0
  let billPaymentIncome = 0
  let creditPayments = 0
  let otherIncome = 0

  for (const tx of transactions) {
    if (tx.type !== 'INCOME') continue
    const amt = Number(tx.amount)
    const cat = tx.category ?? 'Other'
    if (cat === 'Sales') continue
    if (cat === 'Repairs') repairIncome += amt
    else if (/bill\s*pay/i.test(cat)) billPaymentIncome += amt
    else if (cat === 'Customer Credit Payment') creditPayments += amt
    else otherIncome += amt
  }

  const lines: LineItem[] = [
    { key: 'mobile_sales', label: 'Mobile Sales', amount: round2(mobileSales) },
    { key: 'accessories', label: 'Accessories', amount: round2(accessorySales) },
    { key: 'services', label: 'Services', amount: round2(serviceIncome) },
    { key: 'reload_pos', label: 'Reload (POS)', amount: round2(reloadPosSales) },
    { key: 'repair_income', label: 'Repair Income', amount: round2(repairIncome) },
    { key: 'bill_payment', label: 'Bill Payments', amount: round2(billPaymentIncome) },
    { key: 'credit_payments', label: 'Credit Payments', amount: round2(creditPayments) },
    { key: 'other_income', label: 'Other Income', amount: round2(otherIncome) },
  ]

  if (reloadCommission > 0) {
    lines.push({ key: 'reload_commission', label: 'Reload Commission', amount: round2(reloadCommission) })
  }

  return lines.filter(l => l.amount !== 0).sort((a, b) => b.amount - a.amount)
}

async function buildPeriodExpenseBreakdown(
  tenantId: string,
  fromKey: string,
  toKey: string,
  branchId?: string,
): Promise<LineItem[]> {
  const { start, end } = resolveQueryDateRange({ from: fromKey, to: toKey })
  const bf = await branchFilter(tenantId, branchId)

  const rows = await prisma.transaction.groupBy({
    by: ['category'],
    where: {
      tenantId,
      ...bf,
      type: 'EXPENSE',
      category: { notIn: ['Refund', 'Supplier Payment'] },
      OR: [
        { occurredAt: { gte: start, lte: end } },
        { AND: [{ occurredAt: null }, { createdAt: { gte: start, lte: end } }] },
      ],
    },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
  })

  return rows
    .map(r => ({
      key: r.category ?? 'Other',
      label: r.category ?? 'Other',
      amount: round2(Number(r._sum.amount ?? 0)),
    }))
    .filter(r => r.amount > 0)
}

function buildInsights(
  summary: ReturnType<typeof toFinanceSummaryResponse>,
  previous: ReturnType<typeof toFinanceSummaryResponse> | null,
  expenses: LineItem[],
  income: LineItem[],
): string[] {
  const insights: string[] = []
  const net = summary.profit
  const prevNet = previous?.profit ?? 0

  if (net >= 0) {
    insights.push(`Net profit of Rs ${net.toLocaleString()} for this period.`)
  } else {
    insights.push(`Net loss of Rs ${Math.abs(net).toLocaleString()} — expenses and costs exceeded income.`)
  }

  if (previous && prevNet !== 0) {
    const pct = Math.round(((net - prevNet) / Math.abs(prevNet)) * 100)
    insights.push(
      `Net ${pct >= 0 ? 'improved' : 'declined'} ${Math.abs(pct)}% vs previous period (Rs ${prevNet.toLocaleString()} → Rs ${net.toLocaleString()}).`,
    )
  }

  if (summary.refundsTotal > 0) {
    insights.push(`Refunds reduced profit by Rs ${summary.refundsTotal.toLocaleString()}.`)
  }

  if (summary.cogs > 0 && summary.salesRevenue > 0) {
    const cogsPct = Math.round((summary.cogs / summary.salesRevenue) * 100)
    insights.push(`Cost of goods is ${cogsPct}% of sales revenue.`)
  }

  const topExpense = expenses[0]
  if (topExpense && summary.opExpenses > 0) {
    const pct = Math.round((topExpense.amount / summary.opExpenses) * 100)
    insights.push(`Largest expense: ${topExpense.label} (Rs ${topExpense.amount.toLocaleString()}, ${pct}% of operating expenses).`)
  }

  const topIncome = income[0]
  if (topIncome) {
    insights.push(`Top income source: ${topIncome.label} (Rs ${topIncome.amount.toLocaleString()}).`)
  }

  if (net < 0 && summary.opExpenses > summary.grossProfit) {
    insights.push('Operating expenses alone exceed gross profit — review recurring costs.')
  }

  return insights.slice(0, 6)
}

export async function buildPlStatement(
  tenantId: string,
  fromKey: string,
  toKey: string,
  branchId?: string,
) {
  const fin = await getPeriodFinancials(tenantId, fromKey, toKey, branchId)
  const summary = toFinanceSummaryResponse(fin, { from: fromKey, to: toKey })
  const dailyTrend = await getDailyRevenueBreakdown(tenantId, fromKey, toKey, branchId)
  const repairAccrual = await buildRepairAccrualSummary(tenantId, fromKey, toKey, branchId)

  const periodDays = listBusinessDays(fromKey, toKey).length
  const prevToKey = shiftBusinessDate(fromKey, -1)
  const prevFromKey = shiftBusinessDate(fromKey, -periodDays)
  const prevFin = await getPeriodFinancials(tenantId, prevFromKey, prevToKey, branchId)
  const previous = toFinanceSummaryResponse(prevFin, { from: prevFromKey, to: prevToKey })

  const [incomeBreakdown, expenseBreakdown] = await Promise.all([
    buildPeriodIncomeBreakdown(tenantId, fromKey, toKey, branchId, fin.reloadCommission),
    buildPeriodExpenseBreakdown(tenantId, fromKey, toKey, branchId),
  ])

  const insights = buildInsights(summary, previous, expenseBreakdown, incomeBreakdown)

  const grossMargin = summary.salesRevenue > 0
    ? Math.round((summary.grossProfit / summary.salesRevenue) * 100)
    : 0
  const netMargin = summary.totalIncome > 0
    ? Math.round((summary.profit / summary.totalIncome) * 100)
    : 0

  const statement = buildStatementLines(summary, fin, repairAccrual)

  return {
    summary,
    previous,
    margins: { gross: grossMargin, net: netMargin },
    dailyTrend,
    incomeBreakdown,
    expenseBreakdown,
    insights,
    repairAccrual,
    statement,
  }
}
