/**
 * Repair Sahasma (I phone market) phantom daily closings. IDEMPOTENT.
 *
 * Problem: three daily closings were recorded on dates that had ZERO sales
 * (device date drift / wrong date selected), while the real trading day next
 * to each stayed unclosed. The physical cash the owner counted was therefore
 * booked as a huge "Cash over" variance against an expected cash of 0.
 *
 *   Closing date   sales  actualCash  variance      real trading day (sales)
 *   2026-07-31     0      15,650      -15,650  ->   2026-07-30 (15,650)
 *   2026-07-29     0       5,300       -5,300  ->   2026-07-28 ( 8,500 repair)
 *   2026-07-27     0       4,850       -4,850  ->   2026-07-26 ( 4,850)
 *
 * Fix (per pair):
 *  1. Reverse the phantom DAILY_CLOSING_VARIANCE ("Cash over") journal.
 *  2. Re-date the closing row onto the real trading day and recompute all
 *     fields from that day's data (opening cash = 0).
 *  3. Move the DailySummary row to the real date.
 *  4. If the recomputed variance is material, post a corrected variance journal
 *     (sourceEvent DAILY_CLOSING_VARIANCE_CORRECTED) using the branch cash /
 *     cash-variance GL accounts, and link it as DAILY_CLOSING_VARIANCE.
 *
 * DRY RUN by default. Set APPLY=1 to write.
 *   Preview: npx tsx src/database/reconcile-sahasma-phantom-closings.ts
 *   Apply:   APPLY=1 npx tsx src/database/reconcile-sahasma-phantom-closings.ts
 */
import { PrismaClient } from '@prisma/client'
import { buildDailyClosingPreview } from '../modules/daily-closing/daily-closing.service'
import { createPostedJournalEntry } from '../modules/accounting/journals/journal-create.service'
import { businessDateDb, normalizeBusinessDate } from '../utils/date-range'

const prisma = new PrismaClient()

const TENANT_ID = 'cmrggsith01b3ukdxrg0xc9pf'
const BRANCH_ID = 'cmrggsith01b4ukdxsbn0mevr'
const ACTOR = 'system@hexalyte-reconcile'
const DRY_RUN = process.env.APPLY !== '1'
const CORRECTED_EVENT = 'DAILY_CLOSING_VARIANCE_CORRECTED'

const PAIRS: Array<{ wrong: string; real: string }> = [
  { wrong: '2026-07-31', real: '2026-07-30' },
  { wrong: '2026-07-29', real: '2026-07-28' },
  { wrong: '2026-07-27', real: '2026-07-26' },
]

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function tag() {
  return DRY_RUN ? '[dry-run]' : '[apply]'
}

async function resolveAccounts() {
  const settings = await prisma.accountingSettings.findUnique({ where: { tenantId: TENANT_ID } })
  const map = (settings?.defaultAccounts ?? {}) as Record<string, unknown>
  const varianceAccountId = typeof map.cashVariance === 'string' ? (map.cashVariance as string) : null
  const cash = await prisma.cashAccount.findFirst({
    where: { tenantId: TENANT_ID, branchId: BRANCH_ID, name: 'Main Cash', isActive: true },
    select: { glAccountId: true },
  })
  return { cashAccountId: cash?.glAccountId ?? null, varianceAccountId }
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

/** Reverse the phantom variance journal (only the original DAILY_CLOSING_VARIANCE one). Idempotent. */
async function reversePhantomVarianceJournal(closingId: string) {
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
  if (!link?.journalEntry) {
    console.log(`  ${tag()} no live variance link — reversal already done or none`)
    return
  }
  if (link.journalEntry.sourceEvent !== 'DAILY_CLOSING_VARIANCE') {
    console.log(`  ${tag()} link points to ${link.journalEntry.sourceEvent} (already corrected) — skip reversal`)
    return
  }

  const original = link.journalEntry
  console.log(
    `  ${tag()} reverse variance journal ${original.entryNo} (${original.memo}) amount ${round2(Number(original.totalDebit))}`,
  )

  if (!DRY_RUN) {
    const reversalLines = original.lines.map(l => ({
      accountId: l.accountId,
      debit: Number(l.credit),
      credit: Number(l.debit),
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
      memo: `Reversal — phantom ${original.memo ?? original.entryNo}`,
      createdByEmail: ACTOR,
      reversalOfId: original.id,
      skipPeriodStatusCheck: true,
      lines: reversalLines,
    })
    await prisma.integrationLink.delete({ where: { id: link.id } })
    console.log(`  ${tag()} posted reversal ${reversal.entryNo}`)
  }
}

/** Post a corrected variance journal + link. Idempotent (skips if CORRECTED entry already exists). */
async function postCorrectedVariance(
  closingId: string,
  realDate: string,
  variance: number,
  accounts: { cashAccountId: string | null; varianceAccountId: string | null },
) {
  if (Math.abs(variance) < 0.01) {
    console.log(`  ${tag()} variance ~0 — no corrected journal needed`)
    return
  }
  const existing = await prisma.journalEntry.findFirst({
    where: {
      tenantId: TENANT_ID,
      sourceRefType: 'DailyClosing',
      sourceRefId: closingId,
      sourceEvent: CORRECTED_EVENT,
    },
  })
  if (existing) {
    console.log(`  ${tag()} corrected variance already posted (${existing.entryNo}) — ensure link`)
    if (!DRY_RUN) {
      await prisma.integrationLink.upsert({
        where: {
          tenantId_sourceType_sourceId_eventType: {
            tenantId: TENANT_ID,
            sourceType: 'DailyClosing',
            sourceId: closingId,
            eventType: 'DAILY_CLOSING_VARIANCE',
          },
        },
        create: {
          tenantId: TENANT_ID,
          sourceType: 'DailyClosing',
          sourceId: closingId,
          eventType: 'DAILY_CLOSING_VARIANCE',
          journalEntryId: existing.id,
        },
        update: { journalEntryId: existing.id },
      })
    }
    return
  }
  if (!accounts.cashAccountId || !accounts.varianceAccountId) {
    console.log(`  ${tag()} WARN missing GL accounts — cannot post corrected variance`)
    return
  }
  const amount = round2(Math.abs(variance))
  // variance > 0 => SHORT (cash missing): debit cash-variance (loss), credit cash.
  // variance < 0 => OVER  (extra cash):   debit cash, credit cash-variance (income).
  const lines =
    variance > 0
      ? [
          { accountId: accounts.varianceAccountId, debit: amount, credit: 0, description: 'Cash shortage' },
          { accountId: accounts.cashAccountId, debit: 0, credit: amount, description: 'Cash on hand adjustment' },
        ]
      : [
          { accountId: accounts.cashAccountId, debit: amount, credit: 0, description: 'Cash on hand adjustment' },
          { accountId: accounts.varianceAccountId, debit: 0, credit: amount, description: 'Cash overage' },
        ]

  console.log(
    `  ${tag()} post corrected variance journal — ${variance > 0 ? 'short' : 'over'} ${amount} on ${realDate}`,
  )
  if (!DRY_RUN) {
    const je = await createPostedJournalEntry({
      tenantId: TENANT_ID,
      branchId: BRANCH_ID,
      entryDate: businessDateDb(realDate),
      sourceModule: 'DAILY_CLOSING',
      sourceRefType: 'DailyClosing',
      sourceRefId: closingId,
      sourceEvent: CORRECTED_EVENT,
      memo: `Cash ${variance > 0 ? 'short' : 'over'} — ${realDate} (corrected)`,
      createdByEmail: ACTOR,
      skipPeriodStatusCheck: true,
      lines,
    })
    await prisma.integrationLink.upsert({
      where: {
        tenantId_sourceType_sourceId_eventType: {
          tenantId: TENANT_ID,
          sourceType: 'DailyClosing',
          sourceId: closingId,
          eventType: 'DAILY_CLOSING_VARIANCE',
        },
      },
      create: {
        tenantId: TENANT_ID,
        sourceType: 'DailyClosing',
        sourceId: closingId,
        eventType: 'DAILY_CLOSING_VARIANCE',
        journalEntryId: je.id,
      },
      update: { journalEntryId: je.id },
    })
    console.log(`  ${tag()} posted corrected variance ${je.entryNo}`)
  }
}

async function main() {
  console.log(`\n=== SAHASMA PHANTOM CLOSING REPAIR ${tag()} ===\n`)
  const accounts = await resolveAccounts()
  console.log(`accounts: cash=${accounts.cashAccountId} variance=${accounts.varianceAccountId}\n`)

  for (const { wrong, real } of PAIRS) {
    console.log(`--- ${wrong} (phantom) -> ${real} (real trading day) ---`)

    const wrongDate = businessDateDb(wrong)
    const realDate = businessDateDb(real)

    // Locate the closing: may still be on the wrong date, or already re-dated to real.
    let closing = await prisma.dailyClosing.findUnique({
      where: { tenantId_branchId_date: { tenantId: TENANT_ID, branchId: BRANCH_ID, date: wrongDate } },
    })
    let alreadyMoved = false
    if (!closing) {
      closing = await prisma.dailyClosing.findUnique({
        where: { tenantId_branchId_date: { tenantId: TENANT_ID, branchId: BRANCH_ID, date: realDate } },
      })
      alreadyMoved = !!closing
    }
    if (!closing) {
      console.log(`  SKIP — no closing found on ${wrong} or ${real}\n`)
      continue
    }

    const actualCash = round2(Number(closing.actualCash ?? 0))

    // 1) reverse phantom variance journal (idempotent)
    await reversePhantomVarianceJournal(closing.id)

    // 2) recompute closing fields from the real trading day (opening cash = 0)
    const dateKey = normalizeBusinessDate(real)
    const preview = await buildDailyClosingPreview(TENANT_ID, BRANCH_ID, dateKey)
    const data = buildClosingFields(preview, 0, actualCash)

    console.log(
      `  ${tag()} recompute: sales ${data.salesCount}, totalSales ${data.totalSales}, netProfit ${data.netProfit}, ` +
        `cashSales ${data.cashSales}, expected ${data.expectedCash}, actual ${data.actualCash}, variance ${data.cashVariance}` +
        (alreadyMoved ? ' (already on real date)' : ''),
    )

    if (!DRY_RUN) {
      await prisma.$transaction(async tx => {
        await tx.dailyClosing.update({
          where: { id: closing!.id },
          data: { date: realDate, ...data },
        })
        const wrongSummary = await tx.dailySummary.findUnique({
          where: { tenantId_branchId_date: { tenantId: TENANT_ID, branchId: BRANCH_ID, date: wrongDate } },
        })
        if (wrongSummary) await tx.dailySummary.delete({ where: { id: wrongSummary.id } })
        await tx.dailySummary.upsert({
          where: { tenantId_branchId_date: { tenantId: TENANT_ID, branchId: BRANCH_ID, date: realDate } },
          create: {
            tenantId: TENANT_ID,
            branchId: BRANCH_ID,
            date: realDate,
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
      })
      console.log(`  ${tag()} closing ${closing.id} set to ${real} + summary moved`)
    }

    // 3) post corrected variance if material (idempotent)
    await postCorrectedVariance(closing.id, real, data.cashVariance, accounts)
    console.log('')
  }

  console.log('=== POST-REPAIR CHAIN ===')
  const closings = await prisma.dailyClosing.findMany({
    where: { tenantId: TENANT_ID, branchId: BRANCH_ID, date: { gte: businessDateDb('2026-07-25') } },
    orderBy: { date: 'desc' },
    select: {
      date: true, status: true, salesCount: true, totalSales: true, netProfit: true,
      openingCash: true, cashSales: true, expectedCash: true, actualCash: true, cashVariance: true,
    },
  })
  for (const c of closings) {
    console.log(
      c.date.toISOString().slice(0, 10),
      c.status,
      '| sales', c.salesCount,
      '| totalSales', c.totalSales,
      '| netProfit', c.netProfit,
      '| expected', c.expectedCash,
      '| actual', c.actualCash,
      '| variance', c.cashVariance,
    )
  }
  console.log(`\n${DRY_RUN ? 'DRY RUN complete — re-run with APPLY=1 to apply.' : 'APPLIED.'}`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
