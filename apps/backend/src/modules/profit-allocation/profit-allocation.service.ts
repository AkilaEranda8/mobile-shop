import { ProfitFundType, ProfitTxnType } from '@prisma/client'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { buildDailyClosingPreview } from '../daily-closing/daily-closing.service'
import { financialsFromPreview } from '../finance/business-financials.service'
import { businessDayRange, businessDateDb, normalizeBusinessDate } from '../../utils/date-range'
import type { createFundSchema, updateFundSchema } from './profit-allocation.schema'
import type { z } from 'zod'

type CreateFundInput = z.infer<typeof createFundSchema>
type UpdateFundInput = z.infer<typeof updateFundSchema>

const DEFAULT_FUNDS: Array<{
  name: string
  type: ProfitFundType
  fixedAmount?: number
  percentage?: number
  sortOrder: number
}> = [
  { name: 'Rent', type: 'FIXED_AMOUNT', fixedAmount: 400, sortOrder: 1 },
  { name: 'RDB Loan', type: 'FIXED_AMOUNT', fixedAmount: 500, sortOrder: 2 },
  { name: 'Shop Bills', type: 'FIXED_AMOUNT', fixedAmount: 200, sortOrder: 3 },
  { name: 'Bill Payment', type: 'MANUAL', sortOrder: 10 },
  { name: 'Dialog Reload', type: 'MANUAL', sortOrder: 11 },
  { name: 'Mobitel Reload', type: 'MANUAL', sortOrder: 12 },
  { name: 'Airtel Reload', type: 'MANUAL', sortOrder: 13 },
  { name: 'Hutch Reload', type: 'MANUAL', sortOrder: 14 },
  { name: 'Mobile Items', type: 'MANUAL', sortOrder: 15 },
  { name: 'Mobile Profit', type: 'MANUAL', sortOrder: 16 },
  { name: 'Anu Art\'s', type: 'MANUAL', sortOrder: 17 },
  { name: 'Savings', type: 'PERCENTAGE', percentage: 20, sortOrder: 20 },
  { name: 'Emergency Fund', type: 'PERCENTAGE', percentage: 10, sortOrder: 21 },
  { name: 'Repair', type: 'PERCENTAGE', percentage: 5, sortOrder: 22 },
  { name: 'Print', type: 'PERCENTAGE', percentage: 10, sortOrder: 23 },
  { name: 'Accessories', type: 'PERCENTAGE', percentage: 20, sortOrder: 24 },
  { name: 'Puja', type: 'PERCENTAGE', percentage: 2, sortOrder: 25 },
  { name: 'Other Loan', type: 'PERCENTAGE', percentage: 3, sortOrder: 26 },
  { name: 'Salary', type: 'PERCENTAGE', percentage: 30, sortOrder: 27 },
]

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function isReloadSaleItem(item: { sku?: string | null; productName?: string }) {
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

const FUND_COST_ALIASES: Record<string, string[]> = {
  accessories: ['accessories'],
  print: ['print', 'printing', 'printout', 'print out'],
}

function isPrintRelated(category: string, productName: string) {
  const c = category.toLowerCase()
  const n = productName.toLowerCase()
  return /print|laminate|photocopy|xerox/.test(c) || /print|laminate/.test(n)
}

function fundCategoryCost(fundName: string, costMap: Record<string, { cogs: number }>) {
  const normalized = fundName.trim().toLowerCase()
  if (normalized === 'print') {
    return round2(costMap.Print?.cogs ?? 0)
  }
  const aliases = FUND_COST_ALIASES[normalized] ?? [normalized]
  let total = 0
  for (const alias of aliases) {
    for (const [key, val] of Object.entries(costMap)) {
      if (key.toLowerCase() === alias) total += val.cogs
    }
  }
  return round2(total)
}

async function buildCategoryCostMap(tenantId: string, branchId: string, dateStr: string) {
  const { start, end } = businessDayRange(normalizeBusinessDate(dateStr))
  const [sales, services] = await Promise.all([
    prisma.sale.findMany({
      where: {
        tenantId,
        branchId,
        status: { not: 'RETURNED' },
        createdAt: { gte: start, lte: end },
        source: { not: 'REPAIR' },
      },
      include: {
        items: { include: { product: { include: { category: true } } } },
      },
    }),
    prisma.service.findMany({
      where: { tenantId },
      select: { name: true, category: true, cost: true },
    }),
  ])

  const serviceMap = new Map(services.map(s => [s.name, s]))
  const map: Record<string, { revenue: number; cogs: number }> = {}

  const add = (key: string, revenue: number, cogs: number) => {
    const k = key.trim() || 'Other'
    if (!map[k]) map[k] = { revenue: 0, cogs: 0 }
    map[k].revenue += revenue
    map[k].cogs += cogs
  }

  for (const sale of sales) {
    for (const item of sale.items) {
      if (isReloadSaleItem(item)) continue
      const revenue = Number(item.total)
      if (item.productId && item.product) {
        const cogs = item.quantity * Number(item.product.buyingPrice ?? 0)
        const catName = item.product.category?.name ?? 'Uncategorised'
        add(catName, revenue, cogs)
        if (isMobileProduct(item.product)) add('Mobile', revenue, cogs)
        else add('Accessories', revenue, cogs)
        if (isPrintRelated(catName, item.productName)) add('Print', revenue, cogs)
      } else {
        const svc = serviceMap.get(item.productName)
        const cogs = item.quantity * Number(svc?.cost ?? 0)
        const catName = svc?.category?.trim() || 'Service'
        add(catName, revenue, cogs)
        add('Service', revenue, cogs)
        if (/print/i.test(item.productName) || /print/i.test(catName)) add('Print', revenue, cogs)
      }
    }
  }

  return Object.fromEntries(
    Object.entries(map).map(([k, v]) => [
      k,
      { revenue: round2(v.revenue), cogs: round2(v.cogs), profit: round2(v.revenue - v.cogs) },
    ]),
  )
}

function allocationDbDate(dateStr: string) {
  return businessDateDb(normalizeBusinessDate(dateStr))
}

async function getDayProfit(tenantId: string, branchId: string, dateStr: string) {
  const dateKey = normalizeBusinessDate(dateStr)
  const preview = await buildDailyClosingPreview(tenantId, branchId, dateKey)
  const fin = financialsFromPreview(preview)
  const source = preview.isClosed ? 'daily_closing_closed' : 'daily_closing_preview'
  return {
    todaySales: round2(fin.salesRevenue),
    todayProfit: round2(fin.netProfit),
    salesCount: fin.salesCount,
    source,
  }
}

export async function ensureDefaultFunds(tenantId: string, branchId: string) {
  const count = await prisma.profitFund.count({ where: { tenantId, branchId } })
  if (count > 0) return
  await prisma.profitFund.createMany({
    data: DEFAULT_FUNDS.map(f => ({
      tenantId,
      branchId,
      name: f.name,
      type: f.type,
      fixedAmount: f.fixedAmount ?? 0,
      percentage: f.percentage ?? 0,
      sortOrder: f.sortOrder,
    })),
  })
}

export async function listFunds(tenantId: string, branchId: string) {
  await ensureDefaultFunds(tenantId, branchId)
  return prisma.profitFund.findMany({
    where: { tenantId, branchId },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
}

export async function createFund(tenantId: string, input: CreateFundInput) {
  const existing = await prisma.profitFund.findFirst({
    where: { tenantId, branchId: input.branchId, name: input.name },
  })
  if (existing) throw new AppError('A fund with this name already exists', 409)
  return prisma.profitFund.create({
    data: {
      tenantId,
      branchId: input.branchId,
      name: input.name,
      type: input.type as ProfitFundType,
      fixedAmount: input.fixedAmount ?? 0,
      percentage: input.percentage ?? 0,
      sortOrder: input.sortOrder ?? 0,
      description: input.description,
      isActive: input.isActive ?? true,
    },
  })
}

export async function updateFund(tenantId: string, id: string, input: UpdateFundInput) {
  const fund = await prisma.profitFund.findFirst({ where: { id, tenantId } })
  if (!fund) throw new AppError('Fund not found', 404)
  if (input.name && input.name !== fund.name) {
    const dup = await prisma.profitFund.findFirst({
      where: { tenantId, branchId: fund.branchId, name: input.name },
    })
    if (dup) throw new AppError('A fund with this name already exists', 409)
  }
  return prisma.profitFund.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.type !== undefined && { type: input.type as ProfitFundType }),
      ...(input.fixedAmount !== undefined && { fixedAmount: input.fixedAmount }),
      ...(input.percentage !== undefined && { percentage: input.percentage }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  })
}

export async function deleteFund(tenantId: string, id: string) {
  const fund = await prisma.profitFund.findFirst({ where: { id, tenantId } })
  if (!fund) throw new AppError('Fund not found', 404)
  const txCount = await prisma.profitTransaction.count({ where: { fundId: id } })
  if (txCount > 0) throw new AppError('Cannot delete fund with transaction history. Deactivate instead.', 400)
  await prisma.profitFund.delete({ where: { id } })
}

export async function toggleFund(tenantId: string, id: string, isActive: boolean) {
  const fund = await prisma.profitFund.findFirst({ where: { id, tenantId } })
  if (!fund) throw new AppError('Fund not found', 404)
  return prisma.profitFund.update({ where: { id }, data: { isActive } })
}

async function getYesterdayBalance(fundId: string, dateStr: string) {
  const start = allocationDbDate(dateStr)
  const prevLine = await prisma.profitAllocationLine.findFirst({
    where: {
      fundId,
      allocation: { date: { lt: start } },
    },
    orderBy: { allocation: { date: 'desc' } },
    include: { allocation: true },
  })
  if (prevLine) return round2(prevLine.remainingBalance)
  const fund = await prisma.profitFund.findUnique({ where: { id: fundId } })
  return round2(fund?.balance ?? 0)
}

async function getDayWithdrawn(fundId: string, dateStr: string) {
  const { start, end } = businessDayRange(normalizeBusinessDate(dateStr))
  const agg = await prisma.profitWithdrawal.aggregate({
    where: {
      fundId,
      type: 'WITHDRAW',
      createdAt: { gte: start, lte: end },
    },
    _sum: { amount: true },
  })
  return round2(agg._sum.amount ?? 0)
}

function validatePercentageTotal(funds: { type: ProfitFundType; percentage: number; isActive: boolean }[]) {
  const pctFunds = funds.filter(f => f.isActive && f.type === 'PERCENTAGE')
  const total = pctFunds.reduce((s, f) => s + f.percentage, 0)
  return { total: round2(total), valid: pctFunds.length === 0 || total === 100 }
}

export async function calculateAllocationLines(
  tenantId: string,
  branchId: string,
  dateStr: string,
) {
  await ensureDefaultFunds(tenantId, branchId)
  const funds = await prisma.profitFund.findMany({
    where: { tenantId, branchId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  const pctCheck = validatePercentageTotal(funds)
  const profitMeta = await getDayProfit(tenantId, branchId, dateStr)
  const { todaySales, todayProfit } = profitMeta

  let remainingProfit = todayProfit
  const lines: Array<{
    fundId: string
    fundName: string
    fundType: ProfitFundType
    value: number
    categoryCost: number
    pctAllocation: number
    todayAllocation: number
    yesterdayBalance: number
    totalBalance: number
    withdrawn: number
    remainingBalance: number
    sortOrder: number
    isActive: boolean
    description: string | null
  }> = []

  const categoryCostMap = await buildCategoryCostMap(tenantId, branchId, dateStr)

  const fixedFunds = funds.filter(f => f.type === 'FIXED_AMOUNT')
  const pctFunds = funds.filter(f => f.type === 'PERCENTAGE')
  const manualFunds = funds.filter(f => f.type === 'MANUAL')

  for (const fund of fixedFunds) {
    const yesterdayBalance = await getYesterdayBalance(fund.id, dateStr)
    const withdrawn = await getDayWithdrawn(fund.id, dateStr)
    const todayAllocation = round2(Math.min(fund.fixedAmount, remainingProfit))
    remainingProfit = round2(remainingProfit - todayAllocation)
    const totalBalance = round2(yesterdayBalance + todayAllocation)
    const remainingBalance = round2(totalBalance - withdrawn)
    lines.push({
      fundId: fund.id,
      fundName: fund.name,
      fundType: fund.type,
      value: fund.fixedAmount,
      categoryCost: 0,
      pctAllocation: todayAllocation,
      todayAllocation,
      yesterdayBalance,
      totalBalance,
      withdrawn,
      remainingBalance,
      sortOrder: fund.sortOrder,
      isActive: fund.isActive,
      description: fund.description,
    })
  }

  const poolAfterFixed = round2(Math.max(0, remainingProfit))
  for (const fund of pctFunds) {
    const yesterdayBalance = await getYesterdayBalance(fund.id, dateStr)
    const withdrawn = await getDayWithdrawn(fund.id, dateStr)
    const categoryCost = fundCategoryCost(fund.name, categoryCostMap)
    const pctAllocation = round2(poolAfterFixed * (fund.percentage / 100))
    const todayAllocation = round2(categoryCost + pctAllocation)
    const totalBalance = round2(yesterdayBalance + todayAllocation)
    const remainingBalance = round2(totalBalance - withdrawn)
    lines.push({
      fundId: fund.id,
      fundName: fund.name,
      fundType: fund.type,
      value: fund.percentage,
      categoryCost,
      pctAllocation,
      todayAllocation,
      yesterdayBalance,
      totalBalance,
      withdrawn,
      remainingBalance,
      sortOrder: fund.sortOrder,
      isActive: fund.isActive,
      description: fund.description,
    })
  }

  for (const fund of manualFunds) {
    const yesterdayBalance = await getYesterdayBalance(fund.id, dateStr)
    const withdrawn = await getDayWithdrawn(fund.id, dateStr)
    const totalBalance = round2(yesterdayBalance)
    const remainingBalance = round2(totalBalance - withdrawn)
    lines.push({
      fundId: fund.id,
      fundName: fund.name,
      fundType: fund.type,
      value: 0,
      categoryCost: 0,
      pctAllocation: 0,
      todayAllocation: 0,
      yesterdayBalance,
      totalBalance,
      withdrawn,
      remainingBalance,
      sortOrder: fund.sortOrder,
      isActive: fund.isActive,
      description: fund.description,
    })
  }

  const totalAllocated = round2(
    lines.reduce((s, l) => s + l.todayAllocation, 0),
  )
  const remainingProfitFinal = round2(todayProfit - totalAllocated)

  return {
    date: normalizeBusinessDate(dateStr),
    todaySales,
    todayProfit,
    totalAllocated,
    remainingProfit: remainingProfitFinal,
    percentageTotal: pctCheck.total,
    percentageValid: pctCheck.valid,
    salesCount: profitMeta.salesCount,
    dataSource: profitMeta.source,
    lines,
    saved: false,
  }
}

export async function getDashboard(tenantId: string, branchId: string, dateStr: string, opts?: { live?: boolean }) {
  const date = allocationDbDate(dateStr)
  const existing = opts?.live ? null : await prisma.profitAllocation.findUnique({
    where: { tenantId_branchId_date: { tenantId, branchId, date } },
    include: {
      lines: { include: { fund: true } },
    },
  })

  if (existing) {
    const categoryCostMap = await buildCategoryCostMap(tenantId, branchId, dateStr)
    const lines = existing.lines.map(l => {
      const categoryCost = l.fund.type === 'PERCENTAGE'
        ? fundCategoryCost(l.fund.name, categoryCostMap)
        : 0
      const pctAllocation = l.fund.type === 'PERCENTAGE'
        ? round2(l.todayAllocation - categoryCost)
        : 0
      return {
        fundId: l.fundId,
        fundName: l.fund.name,
        fundType: l.fund.type,
        value: l.fund.type === 'FIXED_AMOUNT' ? l.fund.fixedAmount : l.fund.type === 'PERCENTAGE' ? l.fund.percentage : 0,
        categoryCost,
        pctAllocation,
        todayAllocation: l.todayAllocation,
        yesterdayBalance: l.yesterdayBalance,
        totalBalance: l.totalBalance,
        withdrawn: l.withdrawn,
        remainingBalance: l.remainingBalance,
        sortOrder: l.fund.sortOrder,
        isActive: l.fund.isActive,
        description: l.fund.description,
      }
    })
    const funds = await listFunds(tenantId, branchId)
    const pctCheck = validatePercentageTotal(funds)
    return {
      date: normalizeBusinessDate(dateStr),
      todaySales: existing.todaySales,
      todayProfit: existing.todayProfit,
      totalAllocated: existing.totalAllocated,
      remainingProfit: existing.remainingProfit,
      percentageTotal: pctCheck.total,
      percentageValid: pctCheck.valid,
      salesCount: null,
      dataSource: 'saved_allocation',
      lines,
      saved: true,
      allocationId: existing.id,
    }
  }

  const calc = await calculateAllocationLines(tenantId, branchId, dateStr)
  return { ...calc, allocationId: null }
}

export async function saveAllocation(
  tenantId: string,
  branchId: string,
  dateStr: string,
  userId: string,
  userName: string,
  notes?: string,
) {
  const calc = await calculateAllocationLines(tenantId, branchId, dateStr)
  if (!calc.percentageValid) {
    throw new AppError(`Percentage funds must total 100%. Current total: ${calc.percentageTotal}%`, 400)
  }

  const date = allocationDbDate(dateStr)
  const existing = await prisma.profitAllocation.findUnique({
    where: { tenantId_branchId_date: { tenantId, branchId, date } },
  })
  if (existing) throw new AppError('Allocation already saved for this date. Recalculate is not allowed after save.', 400)

  return prisma.$transaction(async tx => {
    const allocation = await tx.profitAllocation.create({
      data: {
        tenantId,
        branchId,
        date,
        todaySales: calc.todaySales,
        todayProfit: calc.todayProfit,
        totalAllocated: calc.totalAllocated,
        remainingProfit: calc.remainingProfit,
        notes,
        createdBy: userId,
        createdByName: userName,
      },
    })

    for (const line of calc.lines) {
      await tx.profitAllocationLine.create({
        data: {
          allocationId: allocation.id,
          fundId: line.fundId,
          todayAllocation: line.todayAllocation,
          yesterdayBalance: line.yesterdayBalance,
          totalBalance: line.totalBalance,
          withdrawn: line.withdrawn,
          remainingBalance: line.remainingBalance,
        },
      })

      if (line.todayAllocation > 0) {
        const fund = await tx.profitFund.update({
          where: { id: line.fundId },
          data: { balance: { increment: line.todayAllocation } },
        })
        await tx.profitTransaction.create({
          data: {
            tenantId,
            branchId,
            fundId: line.fundId,
            date,
            type: 'ALLOCATION',
            amount: line.todayAllocation,
            balanceAfter: fund.balance,
            notes: `Daily allocation for ${dateStr}`,
            userId,
            userName,
          },
        })
      }
    }

    return allocation
  })
}

async function applyFundMovement(
  tenantId: string,
  branchId: string,
  fundId: string,
  type: ProfitTxnType,
  amount: number,
  userId: string,
  userName: string,
  notes?: string,
  dateStr?: string,
) {
  const fund = await prisma.profitFund.findFirst({ where: { id: fundId, tenantId, branchId } })
  if (!fund) throw new AppError('Fund not found', 404)

  const date = dateStr ? allocationDbDate(dateStr) : businessDateDb(normalizeBusinessDate())
  let delta = amount
  if (type === 'WITHDRAW') {
    if (fund.balance < amount) throw new AppError('Insufficient fund balance', 400)
    delta = -amount
  } else if (type === 'ADJUSTMENT') {
    delta = amount
  }

  return prisma.$transaction(async tx => {
    const updated = await tx.profitFund.update({
      where: { id: fundId },
      data: { balance: { increment: delta } },
    })

    await tx.profitWithdrawal.create({
      data: {
        tenantId,
        branchId,
        fundId,
        type,
        amount: Math.abs(amount),
        notes,
        userId,
        userName,
      },
    })

    await tx.profitTransaction.create({
      data: {
        tenantId,
        branchId,
        fundId,
        date,
        type,
        amount: type === 'WITHDRAW' ? -Math.abs(amount) : Math.abs(amount),
        balanceAfter: updated.balance,
        notes,
        userId,
        userName,
      },
    })

    return updated
  })
}

export async function withdrawFromFund(
  tenantId: string,
  branchId: string,
  fundId: string,
  amount: number,
  userId: string,
  userName: string,
  notes?: string,
  dateStr?: string,
) {
  return applyFundMovement(tenantId, branchId, fundId, 'WITHDRAW', amount, userId, userName, notes, dateStr)
}

export async function depositToFund(
  tenantId: string,
  branchId: string,
  fundId: string,
  amount: number,
  userId: string,
  userName: string,
  notes?: string,
  dateStr?: string,
) {
  return applyFundMovement(tenantId, branchId, fundId, 'DEPOSIT', amount, userId, userName, notes, dateStr)
}

export async function adjustFund(
  tenantId: string,
  branchId: string,
  fundId: string,
  amount: number,
  userId: string,
  userName: string,
  notes?: string,
  dateStr?: string,
) {
  return applyFundMovement(tenantId, branchId, fundId, 'ADJUSTMENT', amount, userId, userName, notes, dateStr)
}

export async function listTransactions(
  tenantId: string,
  opts: {
    branchId?: string
    fundId?: string
    from?: string
    to?: string
    page: number
    limit: number
  },
) {
  const where: Record<string, unknown> = { tenantId }
  if (opts.branchId) where.branchId = opts.branchId
  if (opts.fundId) where.fundId = opts.fundId
  if (opts.from || opts.to) {
    where.date = {}
    if (opts.from) (where.date as Record<string, Date>).gte = allocationDbDate(opts.from)
    if (opts.to) (where.date as Record<string, Date>).lte = businessDayRange(normalizeBusinessDate(opts.to)).end
  }

  const skip = (opts.page - 1) * opts.limit
  const [data, total] = await Promise.all([
    prisma.profitTransaction.findMany({
      where,
      skip,
      take: opts.limit,
      orderBy: { createdAt: 'desc' },
      include: { fund: { select: { name: true, type: true } } },
    }),
    prisma.profitTransaction.count({ where }),
  ])
  return { data, total }
}

async function buildFundSummariesForRange(
  tenantId: string,
  branchId: string,
  start: Date,
  end: Date,
) {
  const funds = await listFunds(tenantId, branchId)
  return Promise.all(
    funds.map(async fund => {
      const openingLine = await prisma.profitAllocationLine.findFirst({
        where: {
          fundId: fund.id,
          allocation: { tenantId, branchId, date: { lt: start } },
        },
        orderBy: { allocation: { date: 'desc' } },
      })
      const openingBalance = round2(openingLine?.remainingBalance ?? fund.balance)

      const allocAgg = await prisma.profitTransaction.aggregate({
        where: {
          fundId: fund.id,
          type: 'ALLOCATION',
          date: { gte: start, lte: end },
        },
        _sum: { amount: true },
      })

      const withdrawAgg = await prisma.profitWithdrawal.aggregate({
        where: {
          fundId: fund.id,
          type: 'WITHDRAW',
          createdAt: { gte: start, lte: end },
        },
        _sum: { amount: true },
      })

      const depositAgg = await prisma.profitWithdrawal.aggregate({
        where: {
          fundId: fund.id,
          type: 'DEPOSIT',
          createdAt: { gte: start, lte: end },
        },
        _sum: { amount: true },
      })

      const allocatedAmount = round2(allocAgg._sum.amount ?? 0)
      const withdrawnAmount = round2(withdrawAgg._sum.amount ?? 0)
      const depositedAmount = round2(depositAgg._sum.amount ?? 0)
      const closingBalance = round2(fund.balance)

      return {
        fundId: fund.id,
        fundName: fund.name,
        fundType: fund.type,
        openingBalance,
        allocatedAmount,
        withdrawnAmount,
        depositedAmount,
        closingBalance,
      }
    }),
  )
}

export async function getPeriodSummary(
  tenantId: string,
  branchId: string,
  fromStr: string,
  toStr: string,
) {
  const from = normalizeBusinessDate(fromStr)
  const to = normalizeBusinessDate(toStr)
  if (from > to) throw new AppError('Start date must be on or before end date', 400)

  const start = allocationDbDate(from)
  const end = businessDayRange(to).end

  const allocRecords = await prisma.profitAllocation.findMany({
    where: { tenantId, branchId, date: { gte: start, lte: end } },
    orderBy: { date: 'asc' },
  })

  const totals = {
    sales: round2(allocRecords.reduce((s, a) => s + a.todaySales, 0)),
    profit: round2(allocRecords.reduce((s, a) => s + a.todayProfit, 0)),
    allocated: round2(allocRecords.reduce((s, a) => s + a.totalAllocated, 0)),
    remaining: round2(allocRecords.length ? allocRecords[allocRecords.length - 1].remainingProfit : 0),
    savedDays: allocRecords.length,
  }

  const linesInRange = await prisma.profitAllocationLine.findMany({
    where: { allocation: { tenantId, branchId, date: { gte: start, lte: end } } },
    include: { fund: true },
    orderBy: [{ allocation: { date: 'asc' } }, { fund: { sortOrder: 'asc' } }],
  })

  const fundLineAgg = new Map<string, {
    fundId: string
    fundName: string
    fundType: string
    value: number
    todayAllocation: number
    yesterdayBalance: number
    totalBalance: number
    withdrawn: number
    remainingBalance: number
    isActive: boolean
    sortOrder: number
    description: string | null
  }>()

  for (const line of linesInRange) {
    const fund = line.fund
    let agg = fundLineAgg.get(line.fundId)
    if (!agg) {
      agg = {
        fundId: line.fundId,
        fundName: fund.name,
        fundType: fund.type,
        value: fund.type === 'FIXED_AMOUNT' ? fund.fixedAmount : fund.type === 'PERCENTAGE' ? fund.percentage : 0,
        todayAllocation: 0,
        yesterdayBalance: line.yesterdayBalance,
        totalBalance: line.totalBalance,
        withdrawn: line.withdrawn,
        remainingBalance: line.remainingBalance,
        isActive: fund.isActive,
        sortOrder: fund.sortOrder,
        description: fund.description,
      }
      fundLineAgg.set(line.fundId, agg)
    }
    agg.todayAllocation = round2(agg.todayAllocation + line.todayAllocation)
    agg.totalBalance = line.totalBalance
    agg.withdrawn = line.withdrawn
    agg.remainingBalance = line.remainingBalance
  }

  const summaries = await buildFundSummariesForRange(tenantId, branchId, start, end)

  return {
    from,
    to,
    totals,
    fundLines: [...fundLineAgg.values()].sort((a, b) => a.sortOrder - b.sortOrder),
    summaries,
  }
}

export async function getMonthlySummary(
  tenantId: string,
  branchId: string,
  monthStr: string,
) {
  const [year, month] = monthStr.split('-').map(Number)
  const monthPad = String(month).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  const from = `${year}-${monthPad}-01`
  const to = `${year}-${monthPad}-${String(lastDay).padStart(2, '0')}`
  const period = await getPeriodSummary(tenantId, branchId, from, to)
  return { month: monthStr, ...period }
}
