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
      category: { not: 'Refund' },
      createdAt: { gte: start, lte: end },
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

  return {
    summary,
    previous,
    margins: { gross: grossMargin, net: netMargin },
    dailyTrend,
    incomeBreakdown,
    expenseBreakdown,
    insights,
    statement: [
      { section: 'income', label: 'Sales Revenue', amount: summary.salesRevenue, indent: 0 },
      { section: 'income', label: 'Other Income (Repairs, Bills, Reload Commission)', amount: summary.otherIncome, indent: 1 },
      { section: 'income', label: 'Total Income', amount: summary.totalIncome, bold: true },
      { section: 'cost', label: 'Cost of Goods Sold (COGS)', amount: -summary.cogs, indent: 1 },
      { section: 'cost', label: 'Refunds', amount: -summary.refundsTotal, indent: 1 },
      { section: 'profit', label: 'Gross Profit', amount: summary.grossProfit, bold: true },
      { section: 'cost', label: 'Operating Expenses', amount: -summary.opExpenses, indent: 1 },
      { section: 'profit', label: 'Net Profit / (Loss)', amount: summary.profit, bold: true, highlight: true },
    ],
  }
}
