import { prisma } from '../../../config/database'
import { businessDateDb, normalizeBusinessDate } from '../../../utils/date-range'
import { AppError } from '../../../middleware/error.middleware'
import { normalBalance, round2 } from '../reports/gl-balances.util'

async function assertInitialized(tenantId: string) {
  const s = await prisma.accountingSettings.findUnique({ where: { tenantId } })
  if (!s?.initializedAt) throw new AppError('Accounting is not initialized', 400)
  return s
}

export async function updateGlAccount(
  tenantId: string,
  accountId: string,
  body: { name?: string; description?: string; isActive?: boolean },
) {
  await assertInitialized(tenantId)
  const account = await prisma.glAccount.findFirst({ where: { id: accountId, tenantId } })
  if (!account) throw new AppError('GL account not found', 404)
  if (account.isSystem && body.isActive === false) {
    throw new AppError('System accounts cannot be deactivated', 400)
  }
  return prisma.glAccount.update({
    where: { id: accountId },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
  })
}

export async function getAccountLedger(
  tenantId: string,
  accountId: string,
  opts: { from?: string; to?: string; branchId?: string; skip: number; limit: number },
) {
  await assertInitialized(tenantId)
  const account = await prisma.glAccount.findFirst({ where: { id: accountId, tenantId } })
  if (!account) throw new AppError('GL account not found', 404)

  const entryDate: Record<string, Date> = {}
  if (opts.from) entryDate.gte = businessDateDb(normalizeBusinessDate(opts.from))
  if (opts.to) entryDate.lte = businessDateDb(normalizeBusinessDate(opts.to))

  const where = {
    tenantId,
    accountId,
    ...(opts.branchId ? { OR: [{ branchId: null }, { branchId: opts.branchId }] } : {}),
    entry: {
      status: 'POSTED' as const,
      ...(Object.keys(entryDate).length ? { entryDate } : {}),
      ...(opts.branchId ? { OR: [{ branchId: null }, { branchId: opts.branchId }] } : {}),
    },
  }

  const [lines, total, openingAgg] = await Promise.all([
    prisma.journalLine.findMany({
      where,
      skip: opts.skip,
      take: opts.limit,
      orderBy: [{ entry: { entryDate: 'asc' } }, { lineNo: 'asc' }],
      include: {
        entry: {
          select: {
            id: true,
            entryNo: true,
            entryDate: true,
            sourceModule: true,
            memo: true,
          },
        },
      },
    }),
    prisma.journalLine.count({ where }),
    opts.from
      ? prisma.journalLine.aggregate({
          where: {
            tenantId,
            accountId,
            ...(opts.branchId ? { OR: [{ branchId: null }, { branchId: opts.branchId }] } : {}),
            entry: {
              status: 'POSTED',
              entryDate: { lt: businessDateDb(normalizeBusinessDate(opts.from)) },
              ...(opts.branchId ? { OR: [{ branchId: null }, { branchId: opts.branchId }] } : {}),
            },
          },
          _sum: { debit: true, credit: true },
        })
      : Promise.resolve({ _sum: { debit: 0, credit: 0 } }),
  ])

  const openingBalance = normalBalance(
    account.type,
    Number(openingAgg._sum.debit ?? 0),
    Number(openingAgg._sum.credit ?? 0),
  )

  let running = openingBalance
  const rows = lines.map(l => {
    const delta = account.type === 'ASSET' || account.type === 'EXPENSE'
      ? round2(Number(l.debit) - Number(l.credit))
      : round2(Number(l.credit) - Number(l.debit))
    running = round2(running + delta)
    return {
      id: l.id,
      lineNo: l.lineNo,
      entryId: l.entry.id,
      entryNo: l.entry.entryNo,
      entryDate: l.entry.entryDate.toISOString().slice(0, 10),
      sourceModule: l.entry.sourceModule,
      memo: l.entry.memo,
      description: l.description,
      debit: Number(l.debit),
      credit: Number(l.credit),
      runningBalance: running,
    }
  })

  const periodAgg = await prisma.journalLine.aggregate({
    where,
    _sum: { debit: true, credit: true },
  })

  return {
    account: {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      subtype: account.subtype,
    },
    openingBalance,
    closingBalance: running,
    totalDebit: round2(Number(periodAgg._sum.debit ?? 0)),
    totalCredit: round2(Number(periodAgg._sum.credit ?? 0)),
    rows,
    total,
  }
}

export async function getAccountingSettingsDetail(tenantId: string) {
  const s = await assertInitialized(tenantId)
  return {
    baseCurrency: s.baseCurrency,
    autoPostEnabled: s.autoPostEnabled,
    requireApprovalAbove: s.requireApprovalAbove,
    expenseCategoryMap: (s.expenseCategoryMap ?? {}) as Record<string, string>,
    defaultAccounts: (s.defaultAccounts ?? {}) as Record<string, string>,
  }
}

export async function updateAccountingSettings(
  tenantId: string,
  body: {
    expenseCategoryMap?: Record<string, string>
    requireApprovalAbove?: number | null
    autoPostEnabled?: boolean
  },
) {
  await assertInitialized(tenantId)
  return prisma.accountingSettings.update({
    where: { tenantId },
    data: {
      ...(body.expenseCategoryMap !== undefined ? { expenseCategoryMap: body.expenseCategoryMap } : {}),
      ...(body.requireApprovalAbove !== undefined ? { requireApprovalAbove: body.requireApprovalAbove } : {}),
      ...(body.autoPostEnabled !== undefined ? { autoPostEnabled: body.autoPostEnabled } : {}),
    },
  })
}
