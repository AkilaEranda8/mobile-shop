import { prisma } from '../../../config/database'
import { businessDateDb, businessDateKeyFromInstant, normalizeBusinessDate } from '../../../utils/date-range'
import { AppError } from '../../../middleware/error.middleware'
import { createPostedJournalEntry } from '../journals/journal-create.service'
import type { JournalDraftLine } from '../journals/journal-validator.util'
import { getProfitAndLoss } from '../reports/gl-reports.service'
import { round2 } from '../reports/gl-balances.util'
import { requireAccountingInitialized } from '../accounting-init.service'

async function assertInitialized(tenantId: string) {
  await requireAccountingInitialized(tenantId)
}

async function getPeriodOrThrow(tenantId: string, periodId: string) {
  const period = await prisma.accountingPeriod.findFirst({ where: { id: periodId, tenantId } })
  if (!period) throw new AppError('Accounting period not found', 404)
  return period
}

function periodDateKeys(period: { startDate: Date; endDate: Date }) {
  return {
    fromKey: businessDateKeyFromInstant(period.startDate),
    toKey: businessDateKeyFromInstant(period.endDate),
  }
}

async function resolveRetainedEarningsId(tenantId: string) {
  const settings = await prisma.accountingSettings.findUnique({ where: { tenantId } })
  const map = (settings?.defaultAccounts ?? {}) as Record<string, unknown>
  if (typeof map.retainedEarnings === 'string' && map.retainedEarnings) return map.retainedEarnings
  const acc = await prisma.glAccount.findFirst({ where: { tenantId, code: '3100', branchId: null } })
  if (!acc) throw new AppError('Retained earnings account (3100) not found', 400)
  return acc.id
}

async function pendingOutboxForPeriod(tenantId: string, fromKey: string, toKey: string) {
  const from = businessDateDb(fromKey)
  const toEnd = new Date(businessDateDb(toKey).getTime() + 24 * 60 * 60 * 1000 - 1)
  return prisma.accountingOutbox.count({
    where: {
      tenantId,
      status: { in: ['PENDING', 'FAILED'] },
      createdAt: { gte: from, lte: toEnd },
    },
  })
}

export async function listAccountingPeriods(tenantId: string) {
  await assertInitialized(tenantId)
  const periods = await prisma.accountingPeriod.findMany({
    where: { tenantId },
    orderBy: { startDate: 'desc' },
    include: {
      _count: { select: { journalEntries: true } },
    },
  })

  return periods.map(p => ({
    id: p.id,
    name: p.name,
    startDate: periodDateKeys(p).fromKey,
    endDate: periodDateKeys(p).toKey,
    status: p.status,
    closedBy: p.closedBy,
    closedAt: p.closedAt,
    journalCount: p._count.journalEntries,
  }))
}

export async function getPeriodClosePreview(tenantId: string, periodId: string) {
  const period = await getPeriodOrThrow(tenantId, periodId)
  const { fromKey, toKey } = periodDateKeys(period)
  const pl = await getProfitAndLoss({ tenantId, fromKey, toKey })
  const pendingOutbox = await pendingOutboxForPeriod(tenantId, fromKey, toKey)

  const existingClose = await prisma.journalEntry.findFirst({
    where: {
      tenantId,
      sourceRefType: 'AccountingPeriod',
      sourceRefId: period.id,
      sourceEvent: 'PERIOD_HARD_CLOSE',
      status: 'POSTED',
    },
    select: { id: true, entryNo: true },
  })

  const journalCount = await prisma.journalEntry.count({
    where: {
      tenantId,
      status: 'POSTED',
      entryDate: {
        gte: businessDateDb(normalizeBusinessDate(fromKey)),
        lte: businessDateDb(normalizeBusinessDate(toKey)),
      },
    },
  })

  return {
    period: {
      id: period.id,
      name: period.name,
      startDate: fromKey,
      endDate: toKey,
      status: period.status,
      journalCount,
    },
    profitAndLoss: pl,
    pendingOutbox,
    hasClosingJournal: !!existingClose,
    closingJournalEntryNo: existingClose?.entryNo ?? null,
    canSoftClose: period.status === 'OPEN',
    canHardClose: period.status === 'OPEN' || period.status === 'SOFT_CLOSED',
    canReopen: period.status === 'SOFT_CLOSED' || period.status === 'HARD_CLOSED',
  }
}

function buildClosingJournalLines(
  pl: Awaited<ReturnType<typeof getProfitAndLoss>>,
  retainedEarningsId: string,
): JournalDraftLine[] {
  const lines: JournalDraftLine[] = []

  for (const r of pl.revenue.lines) {
    if (r.amount > 0) {
      lines.push({
        accountId: r.accountId,
        debit: r.amount,
        credit: 0,
        description: `Close ${r.name}`,
      })
    }
  }
  for (const e of [...pl.cogs.lines, ...pl.operatingExpenses.lines]) {
    if (e.amount > 0) {
      lines.push({
        accountId: e.accountId,
        debit: 0,
        credit: e.amount,
        description: `Close ${e.name}`,
      })
    }
  }

  const net = round2(pl.netIncome)
  if (net > 0) {
    lines.push({
      accountId: retainedEarningsId,
      debit: 0,
      credit: net,
      description: 'Net income to retained earnings',
    })
  } else if (net < 0) {
    lines.push({
      accountId: retainedEarningsId,
      debit: round2(Math.abs(net)),
      credit: 0,
      description: 'Net loss to retained earnings',
    })
  }

  return lines
}

export async function softClosePeriod(tenantId: string, periodId: string, actorEmail?: string) {
  const period = await getPeriodOrThrow(tenantId, periodId)
  if (period.status !== 'OPEN') throw new AppError('Only open periods can be soft-closed', 400)

  const updated = await prisma.accountingPeriod.update({
    where: { id: period.id },
    data: { status: 'SOFT_CLOSED', closedBy: actorEmail, closedAt: new Date() },
  })

  await prisma.auditEvent.create({
    data: {
      tenantId,
      actorEmail: actorEmail ?? 'system',
      eventType: 'PERIOD_SOFT_CLOSED',
      entityType: 'AccountingPeriod',
      entityId: period.id,
      afterJson: { name: period.name },
    },
  })

  return updated
}

export async function hardClosePeriod(tenantId: string, periodId: string, actorEmail?: string) {
  const period = await getPeriodOrThrow(tenantId, periodId)
  if (period.status === 'HARD_CLOSED') throw new AppError('Period is already hard-closed', 400)
  if (period.status !== 'OPEN' && period.status !== 'SOFT_CLOSED') {
    throw new AppError('Invalid period status for hard close', 400)
  }

  const existingClose = await prisma.journalEntry.findFirst({
    where: {
      tenantId,
      sourceRefType: 'AccountingPeriod',
      sourceRefId: period.id,
      sourceEvent: 'PERIOD_HARD_CLOSE',
    },
  })
  if (existingClose) throw new AppError('Closing journal already exists for this period', 400)

  const { fromKey, toKey } = periodDateKeys(period)
  const pl = await getProfitAndLoss({ tenantId, fromKey, toKey })
  const retainedId = await resolveRetainedEarningsId(tenantId)
  const lines = buildClosingJournalLines(pl, retainedId)

  let closingJournal = null
  if (lines.length > 0) {
    closingJournal = await createPostedJournalEntry({
      tenantId,
      entryDate: period.endDate,
      sourceModule: 'PERIOD_CLOSE',
      sourceRefType: 'AccountingPeriod',
      sourceRefId: period.id,
      sourceEvent: 'PERIOD_HARD_CLOSE',
      memo: `Period close ${period.name}`,
      createdByEmail: actorEmail,
      lines,
      skipPeriodStatusCheck: true,
    })
  }

  const updated = await prisma.accountingPeriod.update({
    where: { id: period.id },
    data: { status: 'HARD_CLOSED', closedBy: actorEmail, closedAt: new Date() },
  })

  await prisma.auditEvent.create({
    data: {
      tenantId,
      actorEmail: actorEmail ?? 'system',
      eventType: 'PERIOD_HARD_CLOSED',
      entityType: 'AccountingPeriod',
      entityId: period.id,
      afterJson: {
        name: period.name,
        netIncome: pl.netIncome,
        closingJournalId: closingJournal?.id ?? null,
      },
    },
  })

  return { period: updated, closingJournal, netIncome: pl.netIncome }
}

export async function reopenPeriod(tenantId: string, periodId: string, actorEmail?: string) {
  const period = await getPeriodOrThrow(tenantId, periodId)
  if (period.status === 'OPEN') throw new AppError('Period is already open', 400)

  let reversalJournal = null
  if (period.status === 'HARD_CLOSED') {
    const closingJe = await prisma.journalEntry.findFirst({
      where: {
        tenantId,
        sourceRefType: 'AccountingPeriod',
        sourceRefId: period.id,
        sourceEvent: 'PERIOD_HARD_CLOSE',
        status: 'POSTED',
      },
      include: { lines: true },
    })

    if (closingJe) {
      const existingReversal = await prisma.journalEntry.findFirst({
        where: { tenantId, reversalOfId: closingJe.id, status: 'POSTED' },
      })
      if (existingReversal) throw new AppError('Period closing reversal already exists', 400)

      reversalJournal = await createPostedJournalEntry({
        tenantId,
        entryDate: period.endDate,
        sourceModule: 'PERIOD_CLOSE',
        sourceRefType: 'AccountingPeriod',
        sourceRefId: period.id,
        sourceEvent: 'PERIOD_HARD_CLOSE_REVERSAL',
        memo: `Reopen period ${period.name}`,
        createdByEmail: actorEmail,
        reversalOfId: closingJe.id,
        lines: closingJe.lines.map(l => ({
          accountId: l.accountId,
          debit: round2(Number(l.credit)),
          credit: round2(Number(l.debit)),
          description: `Reversal: ${l.description ?? ''}`.trim(),
        })),
        skipPeriodStatusCheck: true,
      })
    }
  }

  const updated = await prisma.accountingPeriod.update({
    where: { id: period.id },
    data: { status: 'OPEN', closedBy: null, closedAt: null },
  })

  await prisma.auditEvent.create({
    data: {
      tenantId,
      actorEmail: actorEmail ?? 'system',
      eventType: 'PERIOD_REOPENED',
      entityType: 'AccountingPeriod',
      entityId: period.id,
      afterJson: { name: period.name, priorStatus: period.status },
    },
  })

  return { period: updated, reversalJournal }
}
