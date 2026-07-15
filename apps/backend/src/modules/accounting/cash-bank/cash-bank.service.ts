import { randomUUID } from 'crypto'
import { prisma } from '../../../config/database'
import { businessDateDb, normalizeBusinessDate } from '../../../utils/date-range'
import { AppError } from '../../../middleware/error.middleware'
import { createPostedJournalEntry } from '../journals/journal-create.service'
import type { JournalDraftLine } from '../journals/journal-validator.util'
import { normalBalance, round2 } from '../reports/gl-balances.util'
import { resolvePaymentGlAccountId } from '../subledgers/ar-ap-payment.service'
import { ensureAccountingRegisters, requireAccountingInitialized } from '../accounting-init.service'

async function assertInitialized(tenantId: string) {
  const s = await requireAccountingInitialized(tenantId)
  await ensureAccountingRegisters(tenantId)
  return s
}

async function glBalanceForAccount(
  tenantId: string,
  accountId: string,
  branchId?: string,
) {
  const account = await prisma.glAccount.findFirst({ where: { id: accountId, tenantId } })
  if (!account) return 0
  const agg = await prisma.journalLine.aggregate({
    where: {
      tenantId,
      accountId,
      ...(branchId ? { OR: [{ branchId: null }, { branchId }] } : {}),
      entry: {
        status: 'POSTED',
        ...(branchId ? { OR: [{ branchId: null }, { branchId }] } : {}),
      },
    },
    _sum: { debit: true, credit: true },
  })
  return normalBalance(account.type, Number(agg._sum.debit ?? 0), Number(agg._sum.credit ?? 0))
}

export async function listCashBankRegisters(tenantId: string, branchId?: string) {
  await assertInitialized(tenantId)
  await ensureUniqueBankGlAccounts(tenantId)

  const [cashAccounts, bankAccounts] = await Promise.all([
    prisma.cashAccount.findMany({
      where: { tenantId, isActive: true, ...(branchId ? { branchId } : {}) },
      include: {
        branch: { select: { id: true, name: true } },
        glAccount: { select: { id: true, code: true, name: true, subtype: true } },
      },
      orderBy: [{ branchId: 'asc' }, { name: 'asc' }],
    }),
    prisma.bankAccount.findMany({
      where: { tenantId, isActive: true, ...(branchId ? { OR: [{ branchId: null }, { branchId }] } : {}) },
      include: {
        branch: { select: { id: true, name: true } },
        glAccount: { select: { id: true, code: true, name: true, subtype: true } },
      },
      orderBy: { name: 'asc' },
    }),
  ])

  const registers: Array<{
    kind: 'CASH' | 'BANK' | 'CLEARING'
    id: string
    name: string
    branchId: string | null
    branchName: string | null
    glAccountId: string
    code: string
    glName: string
    balance: number
    clearingType?: 'CARD' | 'UPI'
    accountNo?: string | null
    bankName?: string | null
    accountType?: 'CURRENT' | 'SAVINGS'
  }> = await Promise.all([
    ...cashAccounts.map(async c => ({
      kind: 'CASH' as const,
      id: c.id,
      name: c.name,
      branchId: c.branchId,
      branchName: c.branch.name,
      glAccountId: c.glAccountId,
      code: c.glAccount.code,
      glName: c.glAccount.name,
      balance: await glBalanceForAccount(tenantId, c.glAccountId, c.branchId),
    })),
    ...bankAccounts.map(async b => ({
      kind: 'BANK' as const,
      id: b.id,
      name: b.name,
      branchId: b.branchId,
      branchName: b.branch?.name ?? null,
      accountNo: b.accountNo,
      bankName: b.bankName,
      accountType: b.accountType,
      glAccountId: b.glAccountId,
      code: b.glAccount.code,
      glName: b.glAccount.name,
      balance: await glBalanceForAccount(tenantId, b.glAccountId, b.branchId ?? undefined),
    })),
  ])

  const settings = await prisma.accountingSettings.findUnique({ where: { tenantId } })
  const map = (settings?.defaultAccounts ?? {}) as Record<string, string>
  const clearingDefs = [
    { key: 'cardClearing', clearingType: 'CARD' as const },
    { key: 'upiClearing', clearingType: 'UPI' as const },
  ]
  for (const def of clearingDefs) {
    const glAccountId = map[def.key]
    if (!glAccountId) continue
    const gl = await prisma.glAccount.findFirst({
      where: { id: glAccountId, tenantId },
      select: { id: true, code: true, name: true },
    })
    if (!gl) continue
    registers.push({
      kind: 'CLEARING' as const,
      id: gl.id,
      name: gl.name,
      branchId: branchId ?? null,
      branchName: null,
      glAccountId: gl.id,
      code: gl.code,
      glName: gl.name,
      clearingType: def.clearingType,
      balance: await glBalanceForAccount(tenantId, gl.id, branchId),
    })
  }

  const kindOrder = { CASH: 0, BANK: 1, CLEARING: 2 }
  return registers.sort((a, b) => {
    const ko = kindOrder[a.kind] - kindOrder[b.kind]
    if (ko !== 0) return ko
    return a.name.localeCompare(b.name)
  })
}

function formatBankAccountName(bankName: string, accountType: 'CURRENT' | 'SAVINGS') {
  const label = accountType === 'SAVINGS' ? 'Savings Account' : 'Current Account'
  return `${bankName.trim()} ${label}`
}

async function nextBankGlCode(tenantId: string) {
  const accounts = await prisma.glAccount.findMany({
    where: { tenantId, code: { startsWith: '11' } },
    select: { code: true },
  })
  let max = 1100
  for (const a of accounts) {
    const n = parseInt(a.code, 10)
    if (!Number.isNaN(n) && n >= max) max = n
  }
  return String(max + 1)
}

/** Each bank register must have its own GL — repairs legacy rows that share 1100. */
export async function ensureUniqueBankGlAccounts(tenantId: string) {
  const settings = await prisma.accountingSettings.findUnique({ where: { tenantId } })
  if (!settings?.initializedAt) return { repaired: 0 }

  const defaultBankGlId = ((settings.defaultAccounts ?? {}) as Record<string, string>).bank
  const banks = await prisma.bankAccount.findMany({
    where: { tenantId, isActive: true },
    orderBy: { name: 'asc' },
  })
  if (banks.length <= 1) return { repaired: 0 }

  const byGl = new Map<string, typeof banks>()
  for (const b of banks) {
    const group = byGl.get(b.glAccountId) ?? []
    group.push(b)
    byGl.set(b.glAccountId, group)
  }

  let repaired = 0
  for (const group of byGl.values()) {
    if (group.length <= 1) continue

    const keeper =
      group.find(b => b.name === 'Main Bank') ??
      (defaultBankGlId ? group.find(b => b.glAccountId === defaultBankGlId) : undefined) ??
      group[0]

    for (const bank of group) {
      if (bank.id === keeper.id) continue

      const code = await nextBankGlCode(tenantId)
      const gl = await prisma.glAccount.create({
        data: {
          tenantId,
          branchId: bank.branchId,
          code,
          name: bank.name,
          type: 'ASSET',
          subtype: 'BANK',
          isSystem: false,
        },
      })
      await prisma.bankAccount.update({
        where: { id: bank.id },
        data: { glAccountId: gl.id },
      })
      repaired += 1
    }
  }

  return { repaired }
}

export async function createBankAccount(
  tenantId: string,
  body: {
    name?: string
    bankName?: string
    accountType?: 'CURRENT' | 'SAVINGS'
    branchId?: string
    accountNo?: string
  },
) {
  await assertInitialized(tenantId)

  const accountType = body.accountType ?? 'CURRENT'
  const rawBankName = body.bankName?.trim()
  const rawName = body.name?.trim()

  let displayName: string
  let bankName: string

  if (rawBankName) {
    bankName = rawBankName
    displayName = rawName || formatBankAccountName(bankName, accountType)
  } else if (rawName) {
    // Legacy clients sent only `name`
    bankName = rawName
    displayName = rawName
  } else {
    throw new AppError('Bank name is required', 400)
  }

  const existing = await prisma.bankAccount.findFirst({
    where: { tenantId, name: displayName },
  })
  if (existing) throw new AppError(`Bank account "${displayName}" already exists`, 400)

  const code = await nextBankGlCode(tenantId)
  const glAccount = await prisma.glAccount.create({
    data: {
      tenantId,
      branchId: body.branchId ?? null,
      code,
      name: displayName,
      type: 'ASSET',
      subtype: 'BANK',
      isSystem: false,
    },
  })

  return prisma.bankAccount.create({
    data: {
      tenantId,
      branchId: body.branchId,
      name: displayName,
      accountNo: body.accountNo?.trim() || null,
      bankName,
      accountType,
      glAccountId: glAccount.id,
    },
    include: { glAccount: { select: { code: true, name: true } } },
  })
}

type TransferBody = {
  branchId: string
  entryDate: string
  amount: number
  fromType: 'CASH' | 'BANK' | 'CARD_CLEARING' | 'UPI_CLEARING'
  toType: 'CASH' | 'BANK' | 'CARD_CLEARING' | 'UPI_CLEARING'
  fromId?: string
  toId?: string
  reference?: string
  memo?: string
}

async function resolveRegisterGl(
  tenantId: string,
  branchId: string,
  type: TransferBody['fromType'],
  id?: string,
) {
  const settings = await prisma.accountingSettings.findUniqueOrThrow({ where: { tenantId } })
  const map = (settings.defaultAccounts ?? {}) as Record<string, string>

  if (type === 'CASH') {
    const cash = id
      ? await prisma.cashAccount.findFirst({ where: { id, tenantId, isActive: true } })
      : await prisma.cashAccount.findFirst({ where: { tenantId, branchId, name: 'Main Cash', isActive: true } })
    if (!cash) throw new AppError('Cash register not found', 404)
    return cash.glAccountId
  }
  if (type === 'BANK') {
    const bank = id
      ? await prisma.bankAccount.findFirst({ where: { id, tenantId, isActive: true } })
      : await prisma.bankAccount.findFirst({ where: { tenantId, name: 'Main Bank', isActive: true } })
        ?? await prisma.bankAccount.findFirst({ where: { tenantId, isActive: true }, orderBy: { name: 'asc' } })
    if (!bank) throw new AppError('Bank account not found', 404)
    return bank.glAccountId
  }
  if (type === 'CARD_CLEARING') {
    const glId = map.cardClearing
    if (!glId) throw new AppError('Card clearing account not configured', 400)
    return glId
  }
  const glId = map.upiClearing
  if (!glId) throw new AppError('UPI clearing account not configured', 400)
  return glId
}

export async function postCashBankTransfer(
  tenantId: string,
  body: TransferBody,
  actorEmail?: string,
) {
  await assertInitialized(tenantId)
  const amount = round2(Math.max(0, Number(body.amount)))
  if (amount <= 0) throw new AppError('Transfer amount must be greater than zero', 400)
  if (body.fromType === body.toType && !body.fromId && !body.toId) {
    throw new AppError('Source and destination must differ', 400)
  }

  const fromGl = await resolveRegisterGl(tenantId, body.branchId, body.fromType, body.fromId)
  const toGl = await resolveRegisterGl(tenantId, body.branchId, body.toType, body.toId)
  if (fromGl === toGl) throw new AppError('Source and destination use the same GL account', 400)

  const refId = randomUUID()
  const lines: JournalDraftLine[] = [
    { accountId: toGl, debit: amount, credit: 0, description: body.memo ?? 'Transfer in' },
    { accountId: fromGl, debit: 0, credit: amount, description: body.memo ?? 'Transfer out' },
  ]

  const je = await createPostedJournalEntry({
    tenantId,
    branchId: body.branchId,
    entryDate: businessDateDb(normalizeBusinessDate(body.entryDate)),
    sourceModule: 'CASH_BANK',
    sourceRefType: 'CashBankTransfer',
    sourceRefId: refId,
    sourceEvent: 'TRANSFER',
    memo: body.memo ?? `Transfer ${body.fromType} → ${body.toType}`,
    createdByEmail: actorEmail,
    lines,
  })

  return je
}

export async function settleClearingAccount(
  tenantId: string,
  body: {
    branchId: string
    entryDate: string
    clearingType: 'CARD' | 'UPI'
    amount: number
    bankAccountId?: string
    reference?: string
    memo?: string
  },
  actorEmail?: string,
) {
  const fromType = body.clearingType === 'CARD' ? 'CARD_CLEARING' : 'UPI_CLEARING'
  return postCashBankTransfer(tenantId, {
    branchId: body.branchId,
    entryDate: body.entryDate,
    amount: body.amount,
    fromType,
    toType: 'BANK',
    toId: body.bankAccountId,
    reference: body.reference,
    memo: body.memo ?? `Settle ${body.clearingType} clearing`,
  }, actorEmail)
}

export async function getRegisterRecentLines(
  tenantId: string,
  glAccountId: string,
  branchId?: string,
  limit = 20,
) {
  const lines = await prisma.journalLine.findMany({
    where: {
      tenantId,
      accountId: glAccountId,
      ...(branchId ? { OR: [{ branchId: null }, { branchId }] } : {}),
      entry: { status: 'POSTED' },
    },
    take: limit,
    orderBy: [{ entry: { entryDate: 'desc' } }, { lineNo: 'desc' }],
    include: {
      entry: { select: { entryNo: true, entryDate: true, sourceModule: true, memo: true } },
    },
  })
  return lines.map(l => ({
    entryNo: l.entry.entryNo,
    entryDate: l.entry.entryDate.toISOString().slice(0, 10),
    sourceModule: l.entry.sourceModule,
    memo: l.entry.memo,
    description: l.description,
    debit: Number(l.debit),
    credit: Number(l.credit),
  }))
}

export async function reconcileBankAccount(
  tenantId: string,
  body: {
    branchId: string
    entryDate: string
    bankAccountId?: string
    statementBalance: number
    memo?: string
  },
  actorEmail?: string,
) {
  await assertInitialized(tenantId)
  const bank = body.bankAccountId
    ? await prisma.bankAccount.findFirst({ where: { id: body.bankAccountId, tenantId, isActive: true } })
    : await prisma.bankAccount.findFirst({ where: { tenantId, name: 'Main Bank', isActive: true } })
      ?? await prisma.bankAccount.findFirst({ where: { tenantId, isActive: true }, orderBy: { name: 'asc' } })
  if (!bank) throw new AppError('Bank account not found', 404)

  const glBalance = await glBalanceForAccount(tenantId, bank.glAccountId, body.branchId)
  const statementBalance = round2(Number(body.statementBalance))
  const diff = round2(statementBalance - glBalance)

  if (Math.abs(diff) < 0.01) {
    return { balanced: true, glBalance, statementBalance, adjustment: 0 }
  }

  const settings = await prisma.accountingSettings.findUniqueOrThrow({ where: { tenantId } })
  const map = (settings.defaultAccounts ?? {}) as Record<string, string>
  const varianceGlId = map.cashVariance
  if (!varianceGlId) throw new AppError('Cash variance account not configured', 400)

  const refId = randomUUID()
  const lines: JournalDraftLine[] = diff > 0
    ? [
        { accountId: bank.glAccountId, debit: diff, credit: 0, description: 'Bank reconciliation adjustment' },
        { accountId: varianceGlId, debit: 0, credit: diff, description: 'Reconciliation gain' },
      ]
    : [
        { accountId: varianceGlId, debit: Math.abs(diff), credit: 0, description: 'Reconciliation loss' },
        { accountId: bank.glAccountId, debit: 0, credit: Math.abs(diff), description: 'Bank reconciliation adjustment' },
      ]

  const je = await createPostedJournalEntry({
    tenantId,
    branchId: body.branchId,
    entryDate: businessDateDb(normalizeBusinessDate(body.entryDate)),
    sourceModule: 'CASH_BANK',
    sourceRefType: 'BankReconciliation',
    sourceRefId: refId,
    sourceEvent: 'RECONCILED',
    memo: body.memo ?? `Bank reconciliation — stmt ${statementBalance}`,
    createdByEmail: actorEmail,
    lines,
  })

  return { balanced: false, glBalance, statementBalance, adjustment: diff, journalEntry: je }
}
