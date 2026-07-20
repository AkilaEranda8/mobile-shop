/**
 * One-off: backfill missing cash journals for Sahasma / I phone market
 * and align Main Cash GL to last closed daily-closing actualCash.
 *
 * Run: npx tsx src/database/backfill-sahasma-cash-journals.ts
 */
import { PrismaClient } from '@prisma/client'
import { postSaleJournal, postSaleCogsJournal } from '../modules/accounting/integration/auto-journal.engine'
import { postApPaymentFromTransaction } from '../modules/accounting/subledgers/ar-ap-payment.service'
import { createPostedJournalEntry } from '../modules/accounting/journals/journal-create.service'
import { enqueueOutboxItem } from '../modules/accounting/integration/accounting-outbox.service'

const prisma = new PrismaClient()

const TENANT_ID = 'cmrggsith01b3ukdxrg0xc9pf'
const BRANCH_ID = 'cmrggsith01b4ukdxsbn0mevr'
const ACTOR = 'system@hexalyte-backfill'

/** POS sales missing SALE_CREATED (skip REPAIR — already on REPAIR_DELIVERED) */
const MISSING_SALE_IDS = [
  'cmrkg7re9000g47exscabncbi', // INV-00011
  'cmrklcek400622v1lfm20tcaz', // INV-00012
  'cmrlwcega006n7e3qobdzei9y', // INV-00016 (was FAILED — discount imbalance)
]

/** Post-init supplier payment missing AP journal */
const MISSING_AP_TX_IDS = [
  'cmrol0ngx009x13y1zj4vbo19', // 220 — U G Sanjeewa
]

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

async function main() {
  const cashAcc = await prisma.cashAccount.findFirst({
    where: { tenantId: TENANT_ID, branchId: BRANCH_ID, name: 'Main Cash', isActive: true },
  })
  if (!cashAcc) throw new Error('Main Cash account not found')

  const settings = await prisma.accountingSettings.findUnique({ where: { tenantId: TENANT_ID } })
  const retained = (settings?.defaultAccounts as Record<string, string> | null)?.retainedEarnings
  if (!retained) throw new Error('retainedEarnings mapping missing')

  const before = await glBalance(cashAcc.glAccountId)
  console.log('Main Cash before:', before)

  // Reset FAILED SALE_CREATED so we can retry after discount fix
  await prisma.accountingOutbox.updateMany({
    where: {
      tenantId: TENANT_ID,
      sourceId: { in: MISSING_SALE_IDS },
      eventType: 'SALE_CREATED',
      status: 'FAILED',
    },
    data: { status: 'PENDING', lastError: null, attempts: 0 },
  })

  for (const saleId of MISSING_SALE_IDS) {
    const linked = await prisma.integrationLink.findUnique({
      where: {
        tenantId_sourceType_sourceId_eventType: {
          tenantId: TENANT_ID,
          sourceType: 'Sale',
          sourceId: saleId,
          eventType: 'SALE_CREATED',
        },
      },
    })
    if (linked) {
      console.log('SALE_CREATED already linked', saleId)
    } else {
      const je = await postSaleJournal(TENANT_ID, saleId, ACTOR)
      console.log('Posted SALE_CREATED', saleId, je.entryNo)
    }

    const cogsLinked = await prisma.integrationLink.findUnique({
      where: {
        tenantId_sourceType_sourceId_eventType: {
          tenantId: TENANT_ID,
          sourceType: 'Sale',
          sourceId: saleId,
          eventType: 'SALE_COGS',
        },
      },
    })
    if (cogsLinked) {
      console.log('SALE_COGS already linked', saleId)
    } else {
      const cogs = await postSaleCogsJournal(TENANT_ID, saleId, ACTOR)
      console.log('Posted SALE_COGS', saleId, cogs?.entryNo ?? '(zero-cogs link)')
    }

    await prisma.accountingOutbox.updateMany({
      where: {
        tenantId: TENANT_ID,
        sourceId: saleId,
        eventType: { in: ['SALE_CREATED', 'SALE_COGS'] },
      },
      data: { status: 'COMPLETED', lastError: null },
    })
  }

  for (const txId of MISSING_AP_TX_IDS) {
    const linked = await prisma.integrationLink.findUnique({
      where: {
        tenantId_sourceType_sourceId_eventType: {
          tenantId: TENANT_ID,
          sourceType: 'Transaction',
          sourceId: txId,
          eventType: 'AP_PAYMENT_MADE',
        },
      },
    })
    if (linked) {
      console.log('AP_PAYMENT_MADE already linked', txId)
      continue
    }
    const je = await postApPaymentFromTransaction(TENANT_ID, txId, ACTOR)
    console.log('Posted AP_PAYMENT_MADE', txId, je.entryNo, 'amount', je.totalDebit)
    await enqueueOutboxItem({
      tenantId: TENANT_ID,
      branchId: BRANCH_ID,
      sourceType: 'Transaction',
      sourceId: txId,
      eventType: 'AP_PAYMENT_MADE',
    })
    await prisma.accountingOutbox.updateMany({
      where: { tenantId: TENANT_ID, sourceId: txId, eventType: 'AP_PAYMENT_MADE' },
      data: { status: 'COMPLETED', lastError: null },
    })
  }

  const afterOps = await glBalance(cashAcc.glAccountId)
  console.log('Main Cash after ops backfill:', afterOps)

  // Align to last CLOSED drawer count + genuine cash sales since (ignore Fill/Settle/Replenish noise)
  const lastClosed = await prisma.dailyClosing.findFirst({
    where: { tenantId: TENANT_ID, branchId: BRANCH_ID, status: 'CLOSED' },
    orderBy: { date: 'desc' },
  })
  if (!lastClosed) throw new Error('No closed daily closing found')

  const closedActual = round2(Number(lastClosed.actualCash ?? lastClosed.closingBalance ?? 0))
  const closedDate = lastClosed.date

  const salesSince = await prisma.journalLine.aggregate({
    where: {
      accountId: cashAcc.glAccountId,
      entry: {
        tenantId: TENANT_ID,
        entryDate: { gt: closedDate },
        sourceEvent: { in: ['SALE_CREATED', 'REPAIR_DELIVERED'] },
      },
    },
    _sum: { debit: true, credit: true },
  })
  const sinceSales = round2(Number(salesSince._sum.debit ?? 0) - Number(salesSince._sum.credit ?? 0))
  const target = round2(closedActual + sinceSales)
  console.log(
    'Target Main Cash:',
    target,
    `(closed ${closedDate.toISOString().slice(0, 10)} actual ${closedActual} + sales/repairs since ${sinceSales})`,
  )

  const gap = round2(target - afterOps)
  if (Math.abs(gap) < 0.01) {
    console.log('Already aligned — no opening adjustment')
  } else {
    const existing = await prisma.journalEntry.findFirst({
      where: {
        tenantId: TENANT_ID,
        sourceRefType: 'CashOpening',
        sourceRefId: 'sahasma-iphone-market-opening-v1',
        sourceEvent: 'OPENING_BALANCE',
      },
    })
    if (existing) {
      console.log('Opening adjustment already exists', existing.entryNo)
    } else {
      const lines =
        gap > 0
          ? [
              { accountId: cashAcc.glAccountId, debit: gap, credit: 0, description: 'Opening / capital — cash alignment' },
              { accountId: retained, debit: 0, credit: gap, description: 'Opening equity — cash alignment' },
            ]
          : [
              { accountId: retained, debit: Math.abs(gap), credit: 0, description: 'Opening equity — cash alignment' },
              { accountId: cashAcc.glAccountId, debit: 0, credit: Math.abs(gap), description: 'Opening / capital — cash alignment' },
            ]

      const je = await createPostedJournalEntry({
        tenantId: TENANT_ID,
        branchId: BRANCH_ID,
        entryDate: settings!.initializedAt ?? closedDate,
        sourceModule: 'MANUAL',
        sourceRefType: 'CashOpening',
        sourceRefId: 'sahasma-iphone-market-opening-v1',
        sourceEvent: 'OPENING_BALANCE',
        memo: 'Opening cash alignment — absorb pre-accounting supplier payments & drawer capital so Main Cash matches physical',
        createdByEmail: ACTOR,
        skipPeriodStatusCheck: true,
        lines,
      })
      console.log('Posted OPENING_BALANCE', je.entryNo, 'gap', gap)
    }
  }

  const finalBal = await glBalance(cashAcc.glAccountId)
  const petty = await prisma.glAccount.findFirst({ where: { tenantId: TENANT_ID, code: '1010' } })
  const bank = await prisma.glAccount.findFirst({ where: { tenantId: TENANT_ID, code: '1100' } })
  console.log('=== FINAL ===')
  console.log('Main Cash:', finalBal)
  if (petty) console.log('Petty Cash:', await glBalance(petty.id))
  if (bank) console.log('Bank:', await glBalance(bank.id))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
