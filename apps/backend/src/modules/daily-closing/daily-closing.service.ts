import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { businessDayRange, businessDateDb, previousBusinessDate, businessDateFromInstant, normalizeBusinessDate } from '../../utils/date-range'
import {
  calcReloadCommission,
  fetchTenantReloadSettings,
  RELOAD_PROVIDER_IDS,
  resolveReloadProvider,
} from '../daily-reload/reload-settings.util'

export interface CashCountInput {
  d5000?: number
  d2000?: number
  d1000?: number
  d500?: number
  d100?: number
  d50?: number
  d20?: number
  d10?: number
  coins?: number
}

const DENOM_VALUES: Array<[keyof CashCountInput, number]> = [
  ['d5000', 5000], ['d2000', 2000], ['d1000', 1000], ['d500', 500],
  ['d100', 100], ['d50', 50], ['d20', 20], ['d10', 10],
]

export function calcCashCountTotal(input: CashCountInput): number {
  let total = Number(input.coins ?? 0)
  for (const [key, value] of DENOM_VALUES) {
    total += Number(input[key] ?? 0) * value
  }
  return Math.round(total * 100) / 100
}

function parseDateRange(dateStr: string) {
  return businessDayRange(dateStr)
}

function isReloadItem(item: { sku?: string | null; productName?: string; productId?: string | null }) {
  const sku = (item.sku ?? '').toUpperCase()
  const name = (item.productName ?? '').toLowerCase()
  return sku.startsWith('RELOAD-') || name.includes('reload')
}

function isMobileProduct(product: { trackImei?: boolean; category?: { name?: string; slug?: string } | null } | null) {
  if (!product) return false
  if (product.trackImei) return true
  const cat = `${product.category?.name ?? ''} ${product.category?.slug ?? ''}`.toLowerCase()
  return /mobile|phone|smartphone|handset/.test(cat)
}

async function isDailyReloadEnabled(tenantId: string): Promise<boolean> {
  const feat = await prisma.tenantFeature.findFirst({
    where: { tenantId, feature: 'DAILY_RELOAD', enabled: true },
  })
  return !!feat
}

async function getOpeningCash(tenantId: string, branchId: string, dateStr: string): Promise<number> {
  const prevStr = previousBusinessDate(dateStr)
  const prevClosing = await prisma.dailyClosing.findUnique({
    where: { tenantId_branchId_date: { tenantId, branchId, date: businessDateDb(prevStr) } },
    select: { closingBalance: true, actualCash: true, status: true },
  })
  if (prevClosing?.status === 'CLOSED') return prevClosing.closingBalance || prevClosing.actualCash || 0
  return 0
}

export async function buildDailyClosingPreview(tenantId: string, branchId: string, dateStr: string) {
  const dateKey = normalizeBusinessDate(dateStr)
  const dailyReloadEnabled = await isDailyReloadEnabled(tenantId)
  const { start, end } = parseDateRange(dateKey)
  const branchFilter = { tenantId, branchId }
  const imeiWhere = { branchId }
  const saleWhere = {
    tenantId,
    branchId,
    status: { not: 'RETURNED' as const },
    createdAt: { gte: start, lte: end },
  }
  const txWhere = { ...branchFilter, createdAt: { gte: start, lte: end } }

  const [
    sales,
    transactions,
    reloadSettings,
    newCustomers,
    repairsCompleted,
    imeiSoldToday,
    imeiRegistered,
    pendingImeis,
    warrantiesActivated,
    existingClosing,
    openingCashFromPrev,
    branch,
    saleReturns,
  ] = await Promise.all([
    prisma.sale.findMany({
      where: saleWhere,
      include: {
        items: { include: { product: { include: { category: true } } } },
        payments: true,
      },
    }),
    prisma.transaction.findMany({ where: txWhere, orderBy: { createdAt: 'asc' } }),
    dailyReloadEnabled ? fetchTenantReloadSettings(tenantId) : Promise.resolve(null),
    prisma.customer.count({ where: { tenantId, createdAt: { gte: start, lte: end } } }),
    prisma.repairTicket.count({
      where: { ...branchFilter, status: 'DELIVERED', completedAt: { gte: start, lte: end } },
    }),
    prisma.imeiRecord.count({
      where: { ...imeiWhere, status: 'SOLD', updatedAt: { gte: start, lte: end } },
    }),
    prisma.imeiRecord.count({
      where: { ...imeiWhere, createdAt: { gte: start, lte: end } },
    }),
    prisma.imeiRecord.count({ where: { ...imeiWhere, status: 'IN_STOCK' } }),
    prisma.warranty.count({ where: { tenantId, startDate: { gte: start, lte: end } } }),
    prisma.dailyClosing.findUnique({
      where: { tenantId_branchId_date: { tenantId, branchId, date: businessDateDb(dateKey) } },
      include: { cashCount: true },
    }),
    getOpeningCash(tenantId, branchId, dateKey),
    prisma.branch.findFirst({ where: { id: branchId, tenantId }, select: { id: true, name: true } }),
    prisma.saleReturn.findMany({
      where: {
        tenantId,
        createdAt: { gte: start, lte: end },
        sale: { branchId },
      },
    }),
  ])

  const branchInvoiceNos = sales.map(s => s.invoiceNumber)
  const reloads = dailyReloadEnabled
    ? await prisma.dailyReload.findMany({
        where: {
          tenantId,
          reloadDate: { gte: start, lte: end },
          OR: [
            { transactionId: { in: branchInvoiceNos.length ? branchInvoiceNos : ['__none__'] } },
            { connectionNo: { in: [...RELOAD_PROVIDER_IDS] } },
          ],
        },
      })
    : []

  // Repair payments create their own POS Sale AND a Finance "Repairs" transaction.
  // Aggregate repair revenue/cash from the Finance transaction only (below) and keep
  // these repair-source sales out of the POS buckets to avoid double-counting.
  const posSales = sales.filter(s => (s as any).source !== 'REPAIR')
  const repairSales = sales.filter(s => (s as any).source === 'REPAIR')

  let mobileSales = 0
  let accessorySales = 0
  let serviceIncome = 0
  let reloadSalesFromPos = 0
  let mobilesSold = 0
  let cashSales = 0
  let cardPayments = 0
  let qrPayments = 0
  let bankFromSales = 0

  for (const sale of posSales) {
    for (const p of sale.payments) {
      const amt = Number(p.amount)
      if (p.method === 'CASH') cashSales += amt
      else if (p.method === 'CARD') cardPayments += amt
      else if (p.method === 'UPI' || p.method === 'WALLET') qrPayments += amt
      else if (p.method === 'BANK_TRANSFER') bankFromSales += amt
    }
    for (const item of sale.items) {
      const total = Number(item.total)
      if (isReloadItem(item)) {
        if (dailyReloadEnabled) reloadSalesFromPos += total
        continue
      }
      if (!item.productId) {
        serviceIncome += total
        continue
      }
      if (isMobileProduct(item.product)) {
        mobileSales += total
        mobilesSold += item.quantity
      } else {
        accessorySales += total
      }
    }
  }

  let repairIncome = 0
  let billPaymentIncome = 0
  let otherIncome = 0
  let creditPayments = 0
  let totalExpenses = 0
  let bankDeposits = 0
  const expenseMap: Record<string, number> = {}

  for (const tx of transactions) {
    const amt = Number(tx.amount)
    const cat = tx.category ?? 'Other'
    if (tx.type === 'INCOME') {
      if (cat === 'Sales') continue
      if (cat === 'Repairs') {
        // Repairs are the single source of repair revenue; route their payment to the
        // matching bucket so card/QR/bank repair income isn't lost from reconciliation.
        repairIncome += amt
        if (tx.paymentMethod === 'CASH') cashSales += amt
        else if (tx.paymentMethod === 'CARD') cardPayments += amt
        else if (tx.paymentMethod === 'UPI' || tx.paymentMethod === 'WALLET') qrPayments += amt
        else if (tx.paymentMethod === 'BANK_TRANSFER') bankFromSales += amt
      }
      else if (/bill\s*pay/i.test(cat)) {
        billPaymentIncome += amt
        if (tx.paymentMethod === 'CASH') cashSales += amt
      }
      else if (cat === 'Customer Credit Payment') {
        creditPayments += amt
        if (tx.paymentMethod === 'CASH') cashSales += amt
      } else otherIncome += amt
    } else if (tx.type === 'EXPENSE') {
      if (cat === 'Refund') continue
      totalExpenses += amt
      expenseMap[cat] = (expenseMap[cat] ?? 0) + amt
      if (/bank|deposit/i.test(cat)) bankDeposits += amt
    }
  }

  let refundsTotal = 0
  let cashRefunds = 0
  for (const ret of saleReturns) {
    refundsTotal += Number(ret.refundAmount)
    if (ret.refundMethod === 'CASH') cashRefunds += Number(ret.refundAmount)
  }

  const reloadBreakdown: Record<string, { amount: number; commission: number; count: number }> = {}
  for (const id of RELOAD_PROVIDER_IDS) {
    reloadBreakdown[id] = { amount: 0, commission: 0, count: 0 }
  }
  let reloadSalesFromRecords = 0
  let reloadCommission = 0

  for (const r of reloads) {
    const amt = Number(r.amount)
    reloadSalesFromRecords += amt
    const provider = resolveReloadProvider(r.connectionNo, r.provider) ?? 'Other'
    const commission = calcReloadCommission(amt, reloadSettings!, r.connectionNo, r.provider)
    reloadCommission += commission
    if (RELOAD_PROVIDER_IDS.includes(provider as typeof RELOAD_PROVIDER_IDS[number])) {
      reloadBreakdown[provider].amount += amt
      reloadBreakdown[provider].commission += commission
      reloadBreakdown[provider].count += 1
    }
  }

  // Reload: DailyReload table is source of truth (matches POS + import module). Avoid double-count with cart reload lines.
  const reloadSales = dailyReloadEnabled
    ? (reloadSalesFromRecords > 0 ? reloadSalesFromRecords : reloadSalesFromPos)
    : 0
  if (!dailyReloadEnabled) reloadCommission = 0
  const totalSales = mobileSales + accessorySales + serviceIncome + reloadSales
  const salesCount = posSales.length
  const posSalesTotal = posSales.reduce((s, sale) => s + Number(sale.total), 0)

  const cogsRaw = await prisma.$queryRaw<Array<{ cogs: number }>>`
    SELECT COALESCE(SUM(si.quantity::float * p."buyingPrice"), 0)::float AS cogs
    FROM   "SaleItem" si
    JOIN   "Sale"    s ON s.id = si."saleId"
    JOIN   "Product" p ON p.id = si."productId"
    WHERE  s."tenantId" = ${tenantId}
      AND  s."branchId" = ${branchId}
      AND  s."createdAt" >= ${start}
      AND  s."createdAt" <= ${end}
      AND  s.status != 'RETURNED'
  `
  const totalCogsAll = Number(cogsRaw[0]?.cogs ?? 0)
  // Repair spare-part cost is part of repair income, not POS product sales — split it
  // out so POS gross profit and repair margin are each reported correctly.
  let repairPartsCogs = 0
  for (const sale of repairSales) {
    for (const item of sale.items) {
      if (item.productId && item.product) {
        repairPartsCogs += item.quantity * Number((item.product as any).buyingPrice ?? 0)
      }
    }
  }
  const cogs = Math.max(0, totalCogsAll - repairPartsCogs)
  const grossSales = totalSales + repairIncome + billPaymentIncome + otherIncome + creditPayments
  const grossProfit = totalSales - cogs - refundsTotal
  const netProfit = grossSales + reloadCommission - cogs - repairPartsCogs - totalExpenses - refundsTotal

  const openingCash = existingClosing?.openingCash ?? openingCashFromPrev
  const expectedCash = openingCash + cashSales - totalExpenses - bankDeposits - cashRefunds
  const cashInBank = bankFromSales + bankDeposits

  const expenseBreakdown = Object.entries(expenseMap)
    .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount)

  const reloadBreakdownArr = RELOAD_PROVIDER_IDS.map(id => ({
    provider: id,
    ...reloadBreakdown[id],
    amount: Math.round(reloadBreakdown[id].amount * 100) / 100,
    commission: Math.round(reloadBreakdown[id].commission * 100) / 100,
  }))

  const productTotals: Record<string, { name: string; qty: number; revenue: number }> = {}
  const brandTotals: Record<string, number> = {}
  for (const sale of posSales) {
    for (const item of sale.items) {
      if (isReloadItem(item)) continue
      const key = item.productId ?? item.productName
      if (!productTotals[key]) productTotals[key] = { name: item.productName, qty: 0, revenue: 0 }
      productTotals[key].qty += item.quantity
      productTotals[key].revenue += Number(item.total)
      if (item.product && isMobileProduct(item.product)) {
        const brand = (item.product as { brandName?: string | null }).brandName ?? 'Other'
        brandTotals[brand] = (brandTotals[brand] ?? 0) + Number(item.total)
      }
    }
  }
  const topProduct = Object.values(productTotals).sort((a, b) => b.qty - a.qty)[0]
  const topBrand = Object.entries(brandTotals).sort((a, b) => b[1] - a[1])[0]

  const prevKey = previousBusinessDate(dateKey)
  const { start: prevStart, end: prevEnd } = parseDateRange(prevKey)
  const prevSalesAgg = await prisma.sale.aggregate({
    where: { tenantId, branchId, status: { not: 'RETURNED' }, createdAt: { gte: prevStart, lte: prevEnd } },
    _sum: { total: true },
  })
  const prevSalesTotal = Number(prevSalesAgg._sum.total ?? 0)

  const insights: string[] = []
  if (salesCount > 0) insights.push(`${salesCount} sale${salesCount > 1 ? 's' : ''} recorded today`)
  if (prevSalesTotal > 0 && totalSales > 0) {
    const pct = ((totalSales - prevSalesTotal) / prevSalesTotal) * 100
    insights.push(
      `Sales ${pct >= 0 ? 'up' : 'down'} ${Math.abs(pct).toFixed(1)}% vs yesterday (${Math.round(prevSalesTotal)} → ${Math.round(totalSales)})`,
    )
  }
  if (topProduct) insights.push(`Top selling product: ${topProduct.name} (${topProduct.qty} units)`)
  if (topBrand) insights.push(`Top mobile brand: ${topBrand[0]} (Rs ${topBrand[1].toFixed(2)})`)
  if (mobileSales > accessorySales && mobileSales > 0) {
    insights.push('Mobile category leads today\'s product revenue')
  } else if (accessorySales > 0) {
    insights.push('Accessory category leads today\'s product revenue')
  }
  if (dailyReloadEnabled && reloadCommission > 0) {
    insights.push(`Reload commission earned: Rs ${reloadCommission.toFixed(2)}`)
  }
  if (newCustomers > 0) insights.push(`${newCustomers} new customer${newCustomers > 1 ? 's' : ''} registered today`)
  if (repairsCompleted > 0) insights.push(`${repairsCompleted} repair job${repairsCompleted > 1 ? 's' : ''} delivered today`)
  if (expenseBreakdown[0]) {
    insights.push(`Highest expense: ${expenseBreakdown[0].category} (Rs ${expenseBreakdown[0].amount.toFixed(2)})`)
    if (totalExpenses > 0 && expenseBreakdown[0].amount / totalExpenses > 0.4) {
      insights.push(
        `Expense anomaly: ${expenseBreakdown[0].category} is ${((expenseBreakdown[0].amount / totalExpenses) * 100).toFixed(0)}% of total expenses`,
      )
    }
  }

  const salesMixEntries = [
    { name: 'Mobile', value: Math.round(mobileSales * 100) / 100 },
    { name: 'Accessories', value: Math.round(accessorySales * 100) / 100 },
    { name: 'Services', value: Math.round(serviceIncome * 100) / 100 },
  ]
  if (dailyReloadEnabled) {
    salesMixEntries.push({ name: 'Reload', value: Math.round(reloadSales * 100) / 100 })
  }
  const charts = {
    salesMix: salesMixEntries.filter(x => x.value > 0),
    expenses: expenseBreakdown.slice(0, 8).map(e => ({ name: e.category, value: e.amount })),
    reloadCommission: dailyReloadEnabled
      ? reloadBreakdownArr.filter(r => r.amount > 0).map(r => ({
          name: r.provider,
          amount: r.amount,
          commission: r.commission,
        }))
      : [],
  }

  return {
    date: dateKey,
    branchId,
    branchName: branch?.name ?? '',
    status: existingClosing?.status ?? 'OPEN',
    isClosed: existingClosing?.status === 'CLOSED',
    closingId: existingClosing?.id ?? null,
    openingCash: Math.round(openingCash * 100) / 100,
    dataSources: {
      salesOrders: salesCount,
      posSalesTotal: Math.round(posSalesTotal * 100) / 100,
      financeTransactions: transactions.length,
      reloadRecords: reloads.length,
      repairJobsCompleted: repairsCompleted,
      returnsProcessed: saleReturns.length,
      linkedModules: dailyReloadEnabled
        ? ['POS Sales', 'Finance', 'Daily Reload', 'Repairs', 'IMEI', 'Warranty', 'Customers']
        : ['POS Sales', 'Finance', 'Repairs', 'IMEI', 'Warranty', 'Customers'],
    },
    features: { dailyReload: dailyReloadEnabled },
    sales: {
      totalSales: Math.round(totalSales * 100) / 100,
      mobileSales: Math.round(mobileSales * 100) / 100,
      accessorySales: Math.round(accessorySales * 100) / 100,
      serviceIncome: Math.round(serviceIncome * 100) / 100,
      repairIncome: Math.round(repairIncome * 100) / 100,
      billPaymentIncome: Math.round(billPaymentIncome * 100) / 100,
      reloadSales: Math.round(reloadSales * 100) / 100,
      otherIncome: Math.round(otherIncome * 100) / 100,
      creditPayments: Math.round(creditPayments * 100) / 100,
      refundsTotal: Math.round(refundsTotal * 100) / 100,
      salesCount,
    },
    profit: {
      grossSales: Math.round(grossSales * 100) / 100,
      cogs: Math.round(cogs * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      reloadCommission: Math.round(reloadCommission * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
    },
    expenses: {
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      breakdown: expenseBreakdown,
    },
    reload: {
      breakdown: reloadBreakdownArr,
      totalCommission: Math.round(reloadCommission * 100) / 100,
    },
    cash: {
      openingCash: Math.round(openingCash * 100) / 100,
      cashSales: Math.round(cashSales * 100) / 100,
      bankDeposits: Math.round(bankDeposits * 100) / 100,
      qrPayments: Math.round(qrPayments * 100) / 100,
      cardPayments: Math.round(cardPayments * 100) / 100,
      cashRefunds: Math.round(cashRefunds * 100) / 100,
      expectedCash: Math.round(expectedCash * 100) / 100,
      actualCash: existingClosing?.actualCash ?? 0,
      cashVariance: existingClosing?.cashVariance ?? 0,
      cashInBank: Math.round(cashInBank * 100) / 100,
      cashInHand: existingClosing?.actualCash ?? 0,
    },
    imei: {
      mobilesSold,
      imeisRegistered: imeiRegistered,
      imeisSoldToday: imeiSoldToday,
      pendingImeis,
      warrantiesActivated,
    },
    customers: { newCustomers },
    repairs: { repairsCompleted },
    insights,
    charts,
    cashCount: existingClosing?.cashCount ?? null,
    notes: existingClosing?.notes ?? '',
    closedAt: existingClosing?.closedAt ?? null,
    closedByName: existingClosing?.closedByName ?? null,
  }
}

export async function assertBusinessDayOpen(tenantId: string, branchId: string, at: Date = new Date()) {
  const dateStr = businessDateFromInstant(at)
  const closed = await prisma.dailyClosing.findFirst({
    where: {
      tenantId,
      branchId,
      date: businessDateDb(dateStr),
      status: 'CLOSED',
    },
  })
  if (closed) {
    throw new AppError('Business day is closed. Reopen the day from Daily Closing to add transactions.', 403)
  }
}

function previewToClosingData(
  preview: Awaited<ReturnType<typeof buildDailyClosingPreview>>,
  overrides: { openingCash?: number; actualCash?: number; notes?: string },
) {
  const openingCash = overrides.openingCash ?? preview.openingCash
  const actualCash = overrides.actualCash ?? preview.cash.actualCash
  const expectedCash = openingCash + preview.cash.cashSales - preview.expenses.totalExpenses - preview.cash.bankDeposits - (preview.cash.cashRefunds ?? 0)
  const cashVariance = Math.round((expectedCash - actualCash) * 100) / 100

  return {
    totalSales: preview.sales.totalSales,
    mobileSales: preview.sales.mobileSales,
    accessorySales: preview.sales.accessorySales,
    serviceIncome: preview.sales.serviceIncome,
    repairIncome: preview.sales.repairIncome,
    billPaymentIncome: preview.sales.billPaymentIncome,
    reloadSales: preview.sales.reloadSales,
    otherIncome: preview.sales.otherIncome,
    grossSales: preview.profit.grossSales,
    cogs: preview.profit.cogs,
    grossProfit: preview.profit.grossProfit,
    reloadCommission: preview.profit.reloadCommission,
    netProfit: preview.profit.netProfit,
    totalExpenses: preview.expenses.totalExpenses,
    openingCash,
    cashSales: preview.cash.cashSales,
    bankDeposits: preview.cash.bankDeposits,
    qrPayments: preview.cash.qrPayments,
    cardPayments: preview.cash.cardPayments,
    expectedCash: Math.round(expectedCash * 100) / 100,
    actualCash,
    cashVariance,
    cashInBank: preview.cash.cashInBank,
    closingBalance: actualCash,
    mobilesSold: preview.imei.mobilesSold,
    imeisRegistered: preview.imei.imeisRegistered,
    pendingImeis: preview.imei.pendingImeis,
    warrantiesActivated: preview.imei.warrantiesActivated,
    salesCount: preview.sales.salesCount,
    newCustomers: preview.customers.newCustomers,
    repairsCompleted: preview.repairs.repairsCompleted,
    summaryJson: { sales: preview.sales, profit: preview.profit, cash: preview.cash, imei: preview.imei },
    expenseBreakdown: preview.expenses.breakdown,
    reloadBreakdown: preview.reload.breakdown,
    insightsJson: preview.insights,
    notes: overrides.notes ?? preview.notes,
  }
}

export async function saveDailyClosingDraft(
  tenantId: string,
  branchId: string,
  dateStr: string,
  body: { openingCash?: number; cashCount?: CashCountInput; notes?: string },
) {
  const preview = await buildDailyClosingPreview(tenantId, branchId, dateStr)
  if (preview.isClosed) throw new AppError('Day is already closed', 400)

  const actualCash = body.cashCount ? calcCashCountTotal(body.cashCount) : preview.cash.actualCash
  const data = previewToClosingData(preview, {
    openingCash: body.openingCash ?? preview.openingCash,
    actualCash,
    notes: body.notes,
  })

  const date = businessDateDb(dateStr)
  const closing = await prisma.dailyClosing.upsert({
    where: { tenantId_branchId_date: { tenantId, branchId, date } },
    create: { tenantId, branchId, date, status: 'DRAFT', ...data },
    update: { status: 'DRAFT', ...data },
  })

  if (body.cashCount) {
    const total = calcCashCountTotal(body.cashCount)
    await prisma.dailyClosingCashCount.upsert({
      where: { closingId: closing.id },
      create: { closingId: closing.id, ...body.cashCount, total },
      update: { ...body.cashCount, total },
    })
  }

  return buildDailyClosingPreview(tenantId, branchId, dateStr)
}

export async function closeBusinessDay(
  tenantId: string,
  branchId: string,
  dateStr: string,
  userId: string,
  userName: string,
  body: { openingCash?: number; cashCount: CashCountInput; notes?: string },
) {
  const preview = await buildDailyClosingPreview(tenantId, branchId, dateStr)
  if (preview.isClosed) throw new AppError('Day is already closed', 400)

  const actualCash = calcCashCountTotal(body.cashCount)
  const data = previewToClosingData(preview, {
    openingCash: body.openingCash ?? preview.openingCash,
    actualCash,
    notes: body.notes,
  })

  const date = businessDateDb(dateStr)

  await prisma.$transaction(async tx => {
    const record = await tx.dailyClosing.upsert({
      where: { tenantId_branchId_date: { tenantId, branchId, date } },
      create: {
        tenantId,
        branchId,
        date,
        status: 'CLOSED',
        closedBy: userId,
        closedByName: userName,
        closedAt: new Date(),
        ...data,
      },
      update: {
        status: 'CLOSED',
        closedBy: userId,
        closedByName: userName,
        closedAt: new Date(),
        ...data,
      },
    })

    await tx.dailyClosingCashCount.upsert({
      where: { closingId: record.id },
      create: { closingId: record.id, ...body.cashCount, total: actualCash },
      update: { ...body.cashCount, total: actualCash },
    })

    await tx.dailySummary.upsert({
      where: { tenantId_branchId_date: { tenantId, branchId, date } },
      create: {
        tenantId,
        branchId,
        date,
        totalSales: preview.sales.salesCount,
        totalRevenue: preview.profit.grossSales,
        totalExpenses: preview.expenses.totalExpenses,
        profit: preview.profit.netProfit,
        repairsCompleted: preview.repairs.repairsCompleted,
        newCustomers: preview.customers.newCustomers,
      },
      update: {
        totalSales: preview.sales.salesCount,
        totalRevenue: preview.profit.grossSales,
        totalExpenses: preview.expenses.totalExpenses,
        profit: preview.profit.netProfit,
        repairsCompleted: preview.repairs.repairsCompleted,
        newCustomers: preview.customers.newCustomers,
      },
    })

    const reportTypes = ['DAILY_CLOSING', 'PROFIT', 'EXPENSE', 'RELOAD', 'CASH', 'IMEI']
    await tx.dailyClosingReport.deleteMany({ where: { closingId: record.id } })
    await tx.dailyClosingReport.createMany({
      data: reportTypes.map(reportType => ({
        closingId: record.id,
        reportType,
        format: 'PDF',
        generatedBy: userName,
      })),
    })
  })

  return buildDailyClosingPreview(tenantId, branchId, dateStr)
}

export async function reopenBusinessDay(tenantId: string, branchId: string, dateStr: string) {
  const date = businessDateDb(dateStr)
  const existing = await prisma.dailyClosing.findUnique({
    where: { tenantId_branchId_date: { tenantId, branchId, date } },
  })
  if (!existing || existing.status !== 'CLOSED') throw new AppError('No closed record found for this date', 404)

  await prisma.dailyClosing.update({
    where: { id: existing.id },
    data: { status: 'DRAFT', closedBy: null, closedByName: null, closedAt: null },
  })

  return buildDailyClosingPreview(tenantId, branchId, dateStr)
}
