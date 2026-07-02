import { ProfitFundType, ProfitTxnType } from '@prisma/client'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { buildDailyClosingPreview } from '../daily-closing/daily-closing.service'
import { financialsFromPreview } from '../finance/business-financials.service'
import { buildCategoryCostMap, buildCategoryProfitTable } from '../finance/category-profit.util'
import {
  calcReloadCommission,
  fetchTenantReloadSettings,
  RELOAD_PROVIDER_IDS,
  resolveReloadProvider,
} from '../daily-reload/reload-settings.util'
import { businessDayRange, businessDateDb, businessDateKeyFromInstant, listBusinessDays, normalizeBusinessDate } from '../../utils/date-range'
import { isTenantFeatureEnabled } from '../../utils/tenant-feature.util'
import type { createFundSchema, updateFundSchema } from './profit-allocation.schema'
import type { z } from 'zod'

type CreateFundInput = z.infer<typeof createFundSchema>
type UpdateFundInput = z.infer<typeof updateFundSchema>

export { buildCategoryProfitTable }

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
  { name: 'Dialog Card', type: 'MANUAL', sortOrder: 12 },
  { name: 'Mobitel Reload', type: 'MANUAL', sortOrder: 13 },
  { name: 'Mobitel Card', type: 'MANUAL', sortOrder: 14 },
  { name: 'Airtel Reload', type: 'MANUAL', sortOrder: 15 },
  { name: 'Airtel Card', type: 'MANUAL', sortOrder: 16 },
  { name: 'Hutch Reload', type: 'MANUAL', sortOrder: 17 },
  { name: 'Hutch Card', type: 'MANUAL', sortOrder: 18 },
  { name: 'Mobile Items', type: 'MANUAL', sortOrder: 20 },
  { name: 'Mobile Profit', type: 'MANUAL', sortOrder: 21 },
  { name: 'Anu Art\'s', type: 'MANUAL', sortOrder: 22 },
  { name: 'Savings', type: 'PERCENTAGE', percentage: 20, sortOrder: 30 },
  { name: 'Emergency Fund', type: 'PERCENTAGE', percentage: 10, sortOrder: 31 },
  { name: 'Repair', type: 'PERCENTAGE', percentage: 5, sortOrder: 32 },
  { name: 'Print', type: 'PERCENTAGE', percentage: 10, sortOrder: 33 },
  { name: 'Accessories', type: 'PERCENTAGE', percentage: 20, sortOrder: 34 },
  { name: 'Puja', type: 'PERCENTAGE', percentage: 2, sortOrder: 35 },
  { name: 'Other Loan', type: 'PERCENTAGE', percentage: 3, sortOrder: 36 },
  { name: 'Salary', type: 'PERCENTAGE', percentage: 30, sortOrder: 37 },
]

function defaultFundsForTenant(dailyReloadEnabled: boolean) {
  return DEFAULT_FUNDS.filter(f => dailyReloadEnabled || !f.name.endsWith(' Card'))
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

const FUND_COST_ALIASES: Record<string, string[]> = {
  accessories: ['accessories'],
  print: ['print', 'printing', 'printout', 'print out'],
  printer: ['printer'],
}

function fundCategoryCost(fundName: string, costMap: Record<string, { cogs: number }>) {
  const normalized = fundName.trim().toLowerCase()
  if (normalized === 'print') {
    return round2((costMap.Print?.cogs ?? 0) + (costMap.Printer?.cogs ?? 0))
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

async function getReloadCommissionByFund(tenantId: string, branchId: string, dateStr: string) {
  const { start, end } = businessDayRange(normalizeBusinessDate(dateStr))
  const reloadSettings = await fetchTenantReloadSettings(tenantId)
  const reloads = await findBranchReloads(tenantId, branchId, start, end)
  const map: Record<string, number> = {}
  for (const r of reloads) {
    const provider = resolveReloadProvider(r.connectionNo, r.provider)
    if (!provider || !RELOAD_PROVIDER_IDS.includes(provider)) continue
    const serviceType = r.reloadType === 'RECHARGE_CARD' ? 'RECHARGE_CARD' : 'RELOAD'
    const fundName = serviceType === 'RECHARGE_CARD' ? `${provider} Card` : `${provider} Reload`
    const commission = calcReloadCommission(
      Number(r.amount),
      reloadSettings,
      r.connectionNo,
      r.provider,
      serviceType,
    )
    map[fundName] = round2((map[fundName] ?? 0) + commission)
  }
  return map
}

async function getManualFundIncomeMap(tenantId: string, branchId: string, dateStr: string) {
  const dateKey = normalizeBusinessDate(dateStr)
  const dailyReloadEnabled = await isTenantFeatureEnabled(tenantId, 'DAILY_RELOAD')

  const map: Record<string, number> = {}
  if (dailyReloadEnabled) {
    Object.assign(map, await getReloadCommissionByFund(tenantId, branchId, dateKey))
  }

  const [preview, categoryCostMap] = await Promise.all([
    buildDailyClosingPreview(tenantId, branchId, dateKey),
    buildCategoryCostMap(tenantId, branchId, dateKey),
  ])

  map['Bill Payment'] = round2(preview.sales.billPaymentIncome)
  map['Mobile Items'] = round2(categoryCostMap.Mobile?.revenue ?? 0)
  map['Mobile Profit'] = round2(categoryCostMap.Mobile?.profit ?? 0)

  for (const [catName, val] of Object.entries(categoryCostMap)) {
    if (/anu\s*art/i.test(catName)) {
      map["Anu Art's"] = round2(val.profit)
    }
  }

  return map
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
  const dailyReloadEnabled = await isTenantFeatureEnabled(tenantId, 'DAILY_RELOAD')
  const funds = defaultFundsForTenant(dailyReloadEnabled)
  await prisma.profitFund.createMany({
    data: funds.map(f => ({
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

async function ensureExtendedFunds(tenantId: string, branchId: string) {
  await ensureDefaultFunds(tenantId, branchId)
  const dailyReloadEnabled = await isTenantFeatureEnabled(tenantId, 'DAILY_RELOAD')
  const existing = await prisma.profitFund.findMany({
    where: { tenantId, branchId },
    select: { name: true },
  })
  const names = new Set(existing.map(f => f.name))
  const missing = defaultFundsForTenant(dailyReloadEnabled).filter(f => !names.has(f.name))
  if (missing.length === 0) return
  await prisma.profitFund.createMany({
    data: missing.map(f => ({
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
  await ensureExtendedFunds(tenantId, branchId)
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
  await ensureExtendedFunds(tenantId, branchId)
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
  const profitAllocationExcel = await isTenantFeatureEnabled(tenantId, 'PROFIT_ALLOCATION')
  const manualIncomeMap = profitAllocationExcel
    ? await getManualFundIncomeMap(tenantId, branchId, dateStr)
    : {}

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

  for (const fund of manualFunds) {
    const yesterdayBalance = await getYesterdayBalance(fund.id, dateStr)
    const withdrawn = await getDayWithdrawn(fund.id, dateStr)
    const todayAllocation = round2(manualIncomeMap[fund.name] ?? 0)
    remainingProfit = round2(remainingProfit - todayAllocation)
    const totalBalance = round2(yesterdayBalance + todayAllocation)
    const remainingBalance = round2(totalBalance - withdrawn)
    lines.push({
      fundId: fund.id,
      fundName: fund.name,
      fundType: fund.type,
      value: todayAllocation,
      categoryCost: 0,
      pctAllocation: 0,
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

  lines.sort((a, b) => a.sortOrder - b.sortOrder || a.fundName.localeCompare(b.fundName))

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

export async function deleteAllocation(tenantId: string, branchId: string, dateStr: string) {
  const date = allocationDbDate(dateStr)
  const existing = await prisma.profitAllocation.findUnique({
    where: { tenantId_branchId_date: { tenantId, branchId, date } },
    include: { lines: true },
  })
  if (!existing) throw new AppError('No saved allocation for this date', 404)

  await prisma.$transaction(async tx => {
    for (const line of existing.lines) {
      if (line.todayAllocation > 0) {
        await tx.profitFund.update({
          where: { id: line.fundId },
          data: { balance: { decrement: line.todayAllocation } },
        })
      }
    }
    await tx.profitTransaction.deleteMany({
      where: { tenantId, branchId, date, type: 'ALLOCATION' },
    })
    await tx.profitAllocationLine.deleteMany({ where: { allocationId: existing.id } })
    await tx.profitAllocation.delete({ where: { id: existing.id } })
  })
}

export async function resaveAllocation(
  tenantId: string,
  branchId: string,
  dateStr: string,
  userId: string,
  userName: string,
  notes?: string,
) {
  const date = allocationDbDate(dateStr)
  const existing = await prisma.profitAllocation.findUnique({
    where: { tenantId_branchId_date: { tenantId, branchId, date } },
  })
  if (existing) await deleteAllocation(tenantId, branchId, dateStr)
  return saveAllocation(tenantId, branchId, dateStr, userId, userName, notes)
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

type PeriodFundLineAgg = {
  fundId: string
  fundName: string
  fundType: string
  value: number
  categoryCost?: number
  pctAllocation?: number
  todayAllocation: number
  yesterdayBalance: number
  totalBalance: number
  withdrawn: number
  remainingBalance: number
  isActive: boolean
  sortOrder: number
  description: string | null
}

function mergePeriodFundLine(
  fundLineAgg: Map<string, PeriodFundLineAgg>,
  line: {
    fundId: string
    fundName: string
    fundType: string
    value: number
    categoryCost?: number
    pctAllocation?: number
    todayAllocation: number
    yesterdayBalance: number
    totalBalance: number
    withdrawn: number
    remainingBalance: number
    isActive: boolean
    sortOrder: number
    description: string | null
  },
) {
  let agg = fundLineAgg.get(line.fundId)
  if (!agg) {
    agg = {
      fundId: line.fundId,
      fundName: line.fundName,
      fundType: line.fundType,
      value: line.value,
      categoryCost: 0,
      pctAllocation: 0,
      todayAllocation: 0,
      yesterdayBalance: line.yesterdayBalance,
      totalBalance: line.totalBalance,
      withdrawn: line.withdrawn,
      remainingBalance: line.remainingBalance,
      isActive: line.isActive,
      sortOrder: line.sortOrder,
      description: line.description,
    }
    fundLineAgg.set(line.fundId, agg)
  }
  agg.todayAllocation = round2(agg.todayAllocation + line.todayAllocation)
  agg.categoryCost = round2((agg.categoryCost ?? 0) + (line.categoryCost ?? 0))
  agg.pctAllocation = round2((agg.pctAllocation ?? 0) + (line.pctAllocation ?? 0))
  agg.totalBalance = line.totalBalance
  agg.withdrawn = line.withdrawn
  agg.remainingBalance = line.remainingBalance
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
  const days = listBusinessDays(from, to)

  await ensureDefaultFunds(tenantId, branchId)

  const allocRecords = await prisma.profitAllocation.findMany({
    where: { tenantId, branchId, date: { gte: start, lte: end } },
    orderBy: { date: 'asc' },
    include: { lines: { include: { fund: true } } },
  })

  const savedByDate = new Map<string, (typeof allocRecords)[number]>()
  for (const record of allocRecords) {
    savedByDate.set(businessDateKeyFromInstant(record.date), record)
  }

  const fundLineAgg = new Map<string, PeriodFundLineAgg>()
  let totalSales = 0
  let totalProfit = 0
  let totalAllocated = 0

  for (const day of days) {
    const saved = savedByDate.get(day)
    if (saved) {
      totalSales += saved.todaySales
      totalProfit += saved.todayProfit
      totalAllocated += saved.totalAllocated
      const categoryCostMap = await buildCategoryCostMap(tenantId, branchId, day)
      for (const line of saved.lines) {
        const fund = line.fund
        const categoryCost = fund.type === 'PERCENTAGE'
          ? fundCategoryCost(fund.name, categoryCostMap)
          : 0
        const pctAllocation = fund.type === 'PERCENTAGE'
          ? round2(line.todayAllocation - categoryCost)
          : 0
        mergePeriodFundLine(fundLineAgg, {
          fundId: line.fundId,
          fundName: fund.name,
          fundType: fund.type,
          value: fund.type === 'FIXED_AMOUNT' ? fund.fixedAmount : fund.type === 'PERCENTAGE' ? fund.percentage : 0,
          categoryCost,
          pctAllocation,
          todayAllocation: line.todayAllocation,
          yesterdayBalance: line.yesterdayBalance,
          totalBalance: line.totalBalance,
          withdrawn: line.withdrawn,
          remainingBalance: line.remainingBalance,
          isActive: fund.isActive,
          sortOrder: fund.sortOrder,
          description: fund.description,
        })
      }
      continue
    }

    const calc = await calculateAllocationLines(tenantId, branchId, day)
    totalSales += calc.todaySales
    totalProfit += calc.todayProfit
    totalAllocated += calc.totalAllocated
    for (const line of calc.lines) {
      mergePeriodFundLine(fundLineAgg, line)
    }
  }

  const totals = {
    sales: round2(totalSales),
    profit: round2(totalProfit),
    allocated: round2(totalAllocated),
    remaining: round2(totalProfit - totalAllocated),
    savedDays: allocRecords.length,
    liveDays: days.length - allocRecords.length,
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
