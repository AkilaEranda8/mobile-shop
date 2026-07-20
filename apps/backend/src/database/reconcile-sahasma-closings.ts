/**
 * Reconcile Sahasma daily closings: chain opening cash from prior day's actual count,
 * recalculate expected/variance, fix Jul 20 draft, reverse orphan variance journal,
 * align Main Cash GL to physical drawer (last actualCash).
 *
 * Run: npx tsx src/database/reconcile-sahasma-closings.ts
 */
import { PrismaClient } from '@prisma/client'
import { buildDailyClosingPreview } from '../modules/daily-closing/daily-closing.service'
import { createPostedJournalEntry } from '../modules/accounting/journals/journal-create.service'
import { businessDateDb, normalizeBusinessDate } from '../utils/date-range'

const prisma = new PrismaClient()

const TENANT_ID = 'cmrggsith01b3ukdxrg0xc9pf'
const BRANCH_ID = 'cmrggsith01b4ukdxsbn0mevr'
const ACTOR = 'system@hexalyte-reconcile'
const ALIGN_REF = 'sahasma-closing-reconcile-v2'

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

async function glBalance(accountId: string) {
  const agg = await prisma.journalLine.aggregate({
    where: { accountId },
    _sum: { debit: true, credit: true },
  })
  return round2(Number(agg._sum.debit ?? 0) - Number(agg._sum.credit ?? 0))
}

function buildClosingFields(
  preview: Awaited<ReturnType<typeof buildDailyClosingPreview>>,
  openingCash: number,
  actualCash: number,
) {
  const cashOperatingExpenses = preview.expenses.cashOperatingExpenses ?? 0
  const cashSupplierPayments = preview.expenses.cashSupplierPayments ?? 0
  const cashBankDeposits = preview.cash.cashBankDeposits ?? 0
  const cashRefunds = preview.cash.cashRefunds ?? 0
  const expectedCash = round2(
    openingCash + preview.cash.cashSales - cashOperatingExpenses - cashSupplierPayments - cashBankDeposits - cashRefunds,
  )
  const cashVariance = round2(expectedCash - actualCash)

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
    openingCash: round2(openingCash),
    cashSales: preview.cash.cashSales,
    bankDeposits: preview.cash.bankDeposits,
    qrPayments: preview.cash.qrPayments,
    cardPayments: preview.cash.cardPayments,
    expectedCash,
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
  }
}

async function reverseVarianceJournal(closingId: string) {
  const link = await prisma.integrationLink.findUnique({
    where: {
      tenantId_sourceType_sourceId_eventType: {
        tenantId: TENANT_ID,
        sourceType: 'DailyClosing',
        sourceId: closingId,
        eventType: 'DAILY_CLOSING_VARIANCE',
      },
    },
    include: { journalEntry: { include: { lines: true } } },
  })
  if (!link?.journalEntry) return null

  const original = link.journalEntry
  const reversalLines = original.lines.map(l => ({
    accountId: l.accountId,
    debit: l.credit,
    credit: l.debit,
    description: `Reversal — ${l.description ?? original.memo ?? 'variance'}`,
  }))

  const reversal = await createPostedJournalEntry({
    tenantId: TENANT_ID,
    branchId: BRANCH_ID,
    entryDate: new Date(),
    sourceModule: 'DAILY_CLOSING',
    sourceRefType: 'DailyClosing',
    sourceRefId: closingId,
    sourceEvent: 'DAILY_CLOSING_VARIANCE_REVERSAL',
    memo: `Reversal — ${original.memo ?? original.entryNo}`,
    createdByEmail: ACTOR,
    reversalOfId: original.id,
    skipPeriodStatusCheck: true,
    lines: reversalLines,
  })

  await prisma.integrationLink.delete({ where: { id: link.id } })
  console.log('Reversed variance journal', original.entryNo, '→', reversal.entryNo)
  return reversal
}

async function main() {
  const closings = await prisma.dailyClosing.findMany({
    where: { tenantId: TENANT_ID, branchId: BRANCH_ID },
    orderBy: { date: 'asc' },
  })

  let prevActual = 0
  console.log('\n=== DAILY CLOSING CHAIN ===')
  for (const row of closings) {
    const dateKey = normalizeBusinessDate(row.date.toISOString().slice(0, 10))
    const actualCash = round2(Number(row.actualCash ?? 0))
    const openingCash = prevActual
    const preview = await buildDailyClosingPreview(TENANT_ID, BRANCH_ID, dateKey)
    const data = buildClosingFields(preview, openingCash, actualCash)

    await prisma.dailyClosing.update({
      where: { id: row.id },
      data,
    })

    console.log(
      dateKey,
      row.status,
      '| opening', data.openingCash,
      '→ expected', data.expectedCash,
      '| actual', data.actualCash,
      '| variance', data.cashVariance,
    )

    if (row.status === 'DRAFT') {
      await reverseVarianceJournal(row.id)
    }

    prevActual = actualCash
  }

  const cashAcc = await prisma.cashAccount.findFirst({
    where: { tenantId: TENANT_ID, branchId: BRANCH_ID, name: 'Main Cash', isActive: true },
  })
  if (!cashAcc) throw new Error('Main Cash not found')

  const settings = await prisma.accountingSettings.findUnique({ where: { tenantId: TENANT_ID } })
  const retained = (settings?.defaultAccounts as Record<string, string> | null)?.retainedEarnings
  if (!retained) throw new Error('retainedEarnings mapping missing')

  const lastClosing = closings[closings.length - 1]
  const targetCash = round2(Number(lastClosing?.actualCash ?? 0))
  const before = await glBalance(cashAcc.glAccountId)
  const gap = round2(targetCash - before)

  console.log('\n=== MAIN CASH GL ===')
  console.log('Before:', before, '| Target (physical):', targetCash, '| Gap:', gap)

  if (Math.abs(gap) >= 0.01) {
    const existing = await prisma.journalEntry.findFirst({
      where: {
        tenantId: TENANT_ID,
        sourceRefType: 'CashOpening',
        sourceRefId: ALIGN_REF,
        sourceEvent: 'OPENING_BALANCE',
      },
    })
    if (existing) {
      console.log('Alignment entry already exists:', existing.entryNo)
    } else {
      const lines =
        gap > 0
          ? [
              { accountId: cashAcc.glAccountId, debit: gap, credit: 0, description: 'Drawer alignment — physical count' },
              { accountId: retained, debit: 0, credit: gap, description: 'Equity — drawer alignment' },
            ]
          : [
              { accountId: retained, debit: Math.abs(gap), credit: 0, description: 'Equity — drawer alignment' },
              { accountId: cashAcc.glAccountId, debit: 0, credit: Math.abs(gap), description: 'Drawer alignment — physical count' },
            ]

      const je = await createPostedJournalEntry({
        tenantId: TENANT_ID,
        branchId: BRANCH_ID,
        entryDate: lastClosing?.date ?? new Date(),
        sourceModule: 'MANUAL',
        sourceRefType: 'CashOpening',
        sourceRefId: ALIGN_REF,
        sourceEvent: 'OPENING_BALANCE',
        memo: 'Main Cash aligned to physical drawer after daily-closing reconciliation',
        createdByEmail: ACTOR,
        skipPeriodStatusCheck: true,
        lines,
      })
      console.log('Posted alignment', je.entryNo, 'amount', Math.abs(gap))
    }
  }

  const after = await glBalance(cashAcc.glAccountId)
  console.log('Main Cash after:', after)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
