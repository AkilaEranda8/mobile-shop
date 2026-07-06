import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database'
import { businessDateDb } from '../../../utils/date-range'
import { AppError } from '../../../middleware/error.middleware'
import {
  AccountBalanceRow,
  normalBalance,
  round2,
  sumBalances,
  trialBalanceColumns,
} from './gl-balances.util'

type ReportOpts = {
  tenantId: string
  branchId?: string
  fromKey: string
  toKey: string
}

type AsOfOpts = {
  tenantId: string
  branchId?: string
  asOfKey: string
}

function entryDateFilter(fromKey?: string, toKey?: string) {
  const filter: Prisma.DateTimeFilter = {}
  if (fromKey) filter.gte = businessDateDb(fromKey)
  if (toKey) filter.lte = businessDateDb(toKey)
  return Object.keys(filter).length ? filter : undefined
}

function branchLineFilter(branchId?: string): Prisma.JournalLineWhereInput {
  if (!branchId) return {}
  return { OR: [{ branchId: null }, { branchId }] }
}

function branchEntryFilter(branchId?: string): Prisma.JournalEntryWhereInput {
  if (!branchId) return {}
  return { OR: [{ branchId: null }, { branchId }] }
}

async function aggregateAccountBalances(opts: {
  tenantId: string
  branchId?: string
  fromKey?: string
  toKey?: string
  accountTypes?: string[]
}): Promise<AccountBalanceRow[]> {
  const entryDate = entryDateFilter(opts.fromKey, opts.toKey)
  const accounts = await prisma.glAccount.findMany({
    where: {
      tenantId: opts.tenantId,
      isActive: true,
      ...(opts.accountTypes?.length ? { type: { in: opts.accountTypes as any } } : {}),
      ...(opts.branchId ? { OR: [{ branchId: null }, { branchId: opts.branchId }] } : {}),
    },
    orderBy: { code: 'asc' },
    select: { id: true, code: true, name: true, type: true, subtype: true },
  })
  if (!accounts.length) return []

  const sums = await prisma.journalLine.groupBy({
    by: ['accountId'],
    where: {
      tenantId: opts.tenantId,
      ...branchLineFilter(opts.branchId),
      entry: {
        status: 'POSTED',
        ...branchEntryFilter(opts.branchId),
        ...(entryDate ? { entryDate } : {}),
      },
    },
    _sum: { debit: true, credit: true },
  })

  const sumMap = new Map(sums.map(s => [s.accountId, s]))
  return accounts.map(a => {
    const agg = sumMap.get(a.id)
    const totalDebit = round2(Number(agg?._sum.debit ?? 0))
    const totalCredit = round2(Number(agg?._sum.credit ?? 0))
    return {
      accountId: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      subtype: a.subtype,
      totalDebit,
      totalCredit,
      balance: normalBalance(a.type, totalDebit, totalCredit),
    }
  })
}

async function assertAccountingInitialized(tenantId: string) {
  const s = await prisma.accountingSettings.findUnique({ where: { tenantId } })
  if (!s?.initializedAt) throw new AppError('Accounting is not initialized', 400)
  return s
}

export async function getTrialBalance(opts: ReportOpts) {
  await assertAccountingInitialized(opts.tenantId)
  const rows = await aggregateAccountBalances({
    tenantId: opts.tenantId,
    branchId: opts.branchId,
    fromKey: opts.fromKey,
    toKey: opts.toKey,
  })

  const active = rows.filter(r => r.totalDebit > 0 || r.totalCredit > 0)
  const lines = active.map(r => {
    const cols = trialBalanceColumns(r.type, r.balance)
    return {
      ...r,
      debitBalance: cols.debit,
      creditBalance: cols.credit,
    }
  })

  const totalDebit = round2(lines.reduce((s, l) => s + l.debitBalance, 0))
  const totalCredit = round2(lines.reduce((s, l) => s + l.creditBalance, 0))

  return {
    basis: 'accrual' as const,
    period: { from: opts.fromKey, to: opts.toKey },
    lines,
    totals: { debit: totalDebit, credit: totalCredit, balanced: totalDebit === totalCredit },
  }
}

export async function getProfitAndLoss(opts: ReportOpts) {
  await assertAccountingInitialized(opts.tenantId)
  const rows = await aggregateAccountBalances({
    tenantId: opts.tenantId,
    branchId: opts.branchId,
    fromKey: opts.fromKey,
    toKey: opts.toKey,
    accountTypes: ['INCOME', 'EXPENSE'],
  })

  const revenue = rows
    .filter(r => r.type === 'INCOME')
    .map(r => ({ ...r, amount: r.balance }))
    .filter(r => r.amount !== 0)

  const expenses = rows
    .filter(r => r.type === 'EXPENSE')
    .map(r => ({ ...r, amount: r.balance }))
    .filter(r => r.amount !== 0)

  const cogs = expenses.filter(e => e.subtype === 'COGS')
  const opex = expenses.filter(e => e.subtype !== 'COGS')

  const totalRevenue = round2(sumBalances(revenue))
  const totalCogs = round2(sumBalances(cogs))
  const totalOpex = round2(sumBalances(opex))
  const grossProfit = round2(totalRevenue - totalCogs)
  const netIncome = round2(totalRevenue - totalCogs - totalOpex)

  return {
    basis: 'accrual' as const,
    period: { from: opts.fromKey, to: opts.toKey },
    revenue: { lines: revenue, total: totalRevenue },
    cogs: { lines: cogs, total: totalCogs },
    grossProfit,
    operatingExpenses: { lines: opex, total: totalOpex },
    netIncome,
  }
}

export async function getBalanceSheet(opts: AsOfOpts) {
  await assertAccountingInitialized(opts.tenantId)
  const cumulative = await aggregateAccountBalances({
    tenantId: opts.tenantId,
    branchId: opts.branchId,
    toKey: opts.asOfKey,
  })

  const assets = cumulative.filter(r => r.type === 'ASSET' && r.balance !== 0)
  const liabilities = cumulative.filter(r => r.type === 'LIABILITY' && r.balance !== 0)
  const equityAccounts = cumulative.filter(r => r.type === 'EQUITY' && r.balance !== 0)

  const incomeExpense = cumulative.filter(r => (r.type === 'INCOME' || r.type === 'EXPENSE') && (r.totalDebit > 0 || r.totalCredit > 0))
  const openEarnings = round2(
    incomeExpense.reduce((s, r) => {
      if (r.type === 'INCOME') return s + r.balance
      return s - r.balance
    }, 0),
  )

  const totalAssets = round2(sumBalances(assets))
  const totalLiabilities = round2(sumBalances(liabilities))
  const totalEquityAccounts = round2(sumBalances(equityAccounts))
  const totalEquity = round2(totalEquityAccounts + openEarnings)
  const totalLiabilitiesAndEquity = round2(totalLiabilities + totalEquity)

  return {
    basis: 'accrual' as const,
    asOf: opts.asOfKey,
    assets: { lines: assets, total: totalAssets },
    liabilities: { lines: liabilities, total: totalLiabilities },
    equity: {
      lines: equityAccounts,
      openEarnings,
      total: totalEquity,
    },
    totals: {
      assets: totalAssets,
      liabilitiesAndEquity: totalLiabilitiesAndEquity,
      balanced: totalAssets === totalLiabilitiesAndEquity,
    },
  }
}

export async function getCashFlow(opts: ReportOpts) {
  await assertAccountingInitialized(opts.tenantId)
  const fromDate = businessDateDb(opts.fromKey)
  const toDate = businessDateDb(opts.toKey)

  const cashAccounts = await prisma.glAccount.findMany({
    where: {
      tenantId: opts.tenantId,
      isActive: true,
      subtype: { in: ['CASH', 'BANK'] },
      ...(opts.branchId ? { OR: [{ branchId: null }, { branchId: opts.branchId }] } : {}),
    },
    select: { id: true },
  })
  const cashAccountIds = cashAccounts.map(a => a.id)
  if (!cashAccountIds.length) {
    return {
      basis: 'accrual' as const,
      period: { from: opts.fromKey, to: opts.toKey },
      operating: { inflows: 0, outflows: 0, net: 0, byModule: [] },
      investing: { inflows: 0, outflows: 0, net: 0, byModule: [] },
      financing: { inflows: 0, outflows: 0, net: 0, byModule: [] },
      netChangeInCash: 0,
      openingCash: 0,
      closingCash: 0,
    }
  }

  const lines = await prisma.journalLine.findMany({
    where: {
      tenantId: opts.tenantId,
      accountId: { in: cashAccountIds },
      ...branchLineFilter(opts.branchId),
      entry: {
        status: 'POSTED',
        ...branchEntryFilter(opts.branchId),
        entryDate: { gte: fromDate, lte: toDate },
      },
    },
    select: {
      debit: true,
      credit: true,
      entry: { select: { sourceModule: true } },
    },
  })

  type ModuleFlow = { module: string; inflows: number; outflows: number; net: number }
  const moduleMap = new Map<string, ModuleFlow>()

  for (const line of lines) {
    const mod = line.entry.sourceModule
    const cur = moduleMap.get(mod) ?? { module: mod, inflows: 0, outflows: 0, net: 0 }
    const dr = round2(Number(line.debit ?? 0))
    const cr = round2(Number(line.credit ?? 0))
    cur.inflows = round2(cur.inflows + dr)
    cur.outflows = round2(cur.outflows + cr)
    cur.net = round2(cur.net + dr - cr)
    moduleMap.set(mod, cur)
  }

  const operatingModules = new Set(['SALES', 'REPAIR', 'EXPENSE', 'DAILY_CLOSING', 'AR', 'AP', 'TAX'])
  const investingModules = new Set(['PURCHASE'])
  const financingModules = new Set(['MANUAL', 'PERIOD_CLOSE', 'PAYROLL', 'CASH_BANK', 'PETTY_CASH'])

  function section(modules: Set<string>) {
    const rows = [...moduleMap.values()].filter(r => modules.has(r.module))
    const inflows = round2(rows.reduce((s, r) => s + r.inflows, 0))
    const outflows = round2(rows.reduce((s, r) => s + r.outflows, 0))
    return { inflows, outflows, net: round2(inflows - outflows), byModule: rows }
  }

  const operating = section(operatingModules)
  const investing = section(investingModules)
  const financing = section(financingModules)

  const netChangeInCash = round2(operating.net + investing.net + financing.net)

  const openingRows = await prisma.journalLine.groupBy({
    by: ['accountId'],
    where: {
      tenantId: opts.tenantId,
      accountId: { in: cashAccountIds },
      ...branchLineFilter(opts.branchId),
      entry: {
        status: 'POSTED',
        ...branchEntryFilter(opts.branchId),
        entryDate: { lt: fromDate },
      },
    },
    _sum: { debit: true, credit: true },
  })
  const openingCash = round2(
    openingRows.reduce((s, r) => s + round2(Number(r._sum.debit ?? 0) - Number(r._sum.credit ?? 0)), 0),
  )
  const closingCash = round2(openingCash + netChangeInCash)

  return {
    basis: 'accrual' as const,
    period: { from: opts.fromKey, to: opts.toKey },
    operating,
    investing,
    financing,
    netChangeInCash,
    openingCash,
    closingCash,
  }
}
