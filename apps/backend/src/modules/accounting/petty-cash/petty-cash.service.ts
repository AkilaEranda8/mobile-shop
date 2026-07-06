import { randomUUID } from 'crypto'
import { prisma } from '../../../config/database'
import { businessDateDb, normalizeBusinessDate } from '../../../utils/date-range'
import { AppError } from '../../../middleware/error.middleware'
import { createPostedJournalEntry } from '../journals/journal-create.service'
import type { JournalDraftLine } from '../journals/journal-validator.util'
import { normalBalance, round2 } from '../reports/gl-balances.util'

async function getSettings(tenantId: string) {
  const s = await prisma.accountingSettings.findUnique({ where: { tenantId } })
  if (!s?.initializedAt) throw new AppError('Accounting is not initialized', 400)
  return s
}

async function pettyCashGlId(tenantId: string) {
  const map = ((await getSettings(tenantId)).defaultAccounts ?? {}) as Record<string, string>
  const id = map.pettyCash
  if (!id) throw new AppError('Petty cash GL not configured', 400)
  return id
}

async function mainCashGlId(tenantId: string, branchId: string) {
  const cash = await prisma.cashAccount.findFirst({
    where: { tenantId, branchId, name: 'Main Cash', isActive: true },
  })
  if (!cash) throw new AppError('Main cash register not found for branch', 404)
  return cash.glAccountId
}

async function opexGlId(tenantId: string) {
  const map = ((await getSettings(tenantId)).defaultAccounts ?? {}) as Record<string, string>
  return map.opex ?? map.operatingExpenses
}

export async function getPettyCashStatus(tenantId: string, branchId: string) {
  await getSettings(tenantId)
  const pettyGlId = await pettyCashGlId(tenantId)
  const register = await prisma.cashAccount.findFirst({
    where: { tenantId, branchId, name: 'Petty Cash', isActive: true },
    include: { glAccount: { select: { code: true, name: true } } },
  })

  const agg = await prisma.journalLine.aggregate({
    where: {
      tenantId,
      accountId: pettyGlId,
      OR: [{ branchId: null }, { branchId }],
      entry: { status: 'POSTED', OR: [{ branchId: null }, { branchId }] },
    },
    _sum: { debit: true, credit: true },
  })
  const balance = normalBalance('ASSET', Number(agg._sum.debit ?? 0), Number(agg._sum.credit ?? 0))

  const recent = await prisma.journalLine.findMany({
    where: {
      tenantId,
      accountId: pettyGlId,
      OR: [{ branchId: null }, { branchId }],
      entry: { status: 'POSTED', sourceModule: 'PETTY_CASH' },
    },
    take: 15,
    orderBy: [{ entry: { entryDate: 'desc' } }],
    include: { entry: { select: { entryNo: true, entryDate: true, memo: true } } },
  })

  return {
    register,
    glAccountId: pettyGlId,
    balance,
    recent: recent.map(l => ({
      entryNo: l.entry.entryNo,
      entryDate: l.entry.entryDate.toISOString().slice(0, 10),
      memo: l.entry.memo,
      description: l.description,
      debit: Number(l.debit),
      credit: Number(l.credit),
    })),
  }
}

export async function recordPettyCashExpense(
  tenantId: string,
  body: { branchId: string; entryDate: string; amount: number; description: string; category?: string },
  actorEmail?: string,
) {
  await getSettings(tenantId)
  const amount = round2(Math.max(0, Number(body.amount)))
  if (amount <= 0) throw new AppError('Expense amount must be greater than zero', 400)

  const pettyGlId = await pettyCashGlId(tenantId)
  const expenseGlId = await opexGlId(tenantId)
  if (!expenseGlId) throw new AppError('Operating expense account not configured', 400)

  const refId = randomUUID()
  const lines: JournalDraftLine[] = [
    { accountId: expenseGlId, debit: amount, credit: 0, description: body.description },
    { accountId: pettyGlId, debit: 0, credit: amount, description: body.description },
  ]

  return createPostedJournalEntry({
    tenantId,
    branchId: body.branchId,
    entryDate: businessDateDb(normalizeBusinessDate(body.entryDate)),
    sourceModule: 'PETTY_CASH',
    sourceRefType: 'PettyCashExpense',
    sourceRefId: refId,
    sourceEvent: 'EXPENSE',
    memo: body.category ? `${body.category}: ${body.description}` : body.description,
    createdByEmail: actorEmail,
    lines,
  })
}

export async function replenishPettyCash(
  tenantId: string,
  body: { branchId: string; entryDate: string; amount: number; memo?: string },
  actorEmail?: string,
) {
  await getSettings(tenantId)
  const amount = round2(Math.max(0, Number(body.amount)))
  if (amount <= 0) throw new AppError('Replenish amount must be greater than zero', 400)

  const pettyGlId = await pettyCashGlId(tenantId)
  const mainGlId = await mainCashGlId(tenantId, body.branchId)
  const refId = randomUUID()

  const lines: JournalDraftLine[] = [
    { accountId: pettyGlId, debit: amount, credit: 0, description: 'Petty cash replenishment' },
    { accountId: mainGlId, debit: 0, credit: amount, description: 'Fund petty cash' },
  ]

  return createPostedJournalEntry({
    tenantId,
    branchId: body.branchId,
    entryDate: businessDateDb(normalizeBusinessDate(body.entryDate)),
    sourceModule: 'PETTY_CASH',
    sourceRefType: 'PettyCashReplenish',
    sourceRefId: refId,
    sourceEvent: 'REPLENISH',
    memo: body.memo ?? 'Petty cash replenishment',
    createdByEmail: actorEmail,
    lines,
  })
}
