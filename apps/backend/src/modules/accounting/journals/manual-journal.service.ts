import { randomUUID } from 'crypto'
import { prisma } from '../../../config/database'
import { businessDateDb, normalizeBusinessDate } from '../../../utils/date-range'
import { AppError } from '../../../middleware/error.middleware'
import { createPostedJournalEntry } from './journal-create.service'
import { assertBalanced, type JournalDraftLine } from './journal-validator.util'
import { round2 } from '../reports/gl-balances.util'
import { generateJournalEntryNo } from './journal-number.util'
import { resolveOpenPeriodForDate } from './journal-period.util'

async function assertInitialized(tenantId: string) {
  const s = await prisma.accountingSettings.findUnique({ where: { tenantId } })
  if (!s?.initializedAt) throw new AppError('Accounting is not initialized', 400)
}

export async function listJournalEntries(
  tenantId: string,
  opts: {
    skip: number
    limit: number
    branchId?: string
    sourceModule?: string
    status?: string
    from?: string
    to?: string
    search?: string
  },
) {
  await assertInitialized(tenantId)

  const where: Record<string, unknown> = {
    tenantId,
    ...(opts.branchId ? { branchId: opts.branchId } : {}),
    ...(opts.sourceModule ? { sourceModule: opts.sourceModule } : {}),
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.from || opts.to
      ? {
          entryDate: {
            ...(opts.from ? { gte: businessDateDb(normalizeBusinessDate(opts.from)) } : {}),
            ...(opts.to ? { lte: businessDateDb(normalizeBusinessDate(opts.to)) } : {}),
          },
        }
      : {}),
    ...(opts.search
      ? {
          OR: [
            { entryNo: { contains: opts.search, mode: 'insensitive' } },
            { memo: { contains: opts.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    prisma.journalEntry.findMany({
      where: where as any,
      skip: opts.skip,
      take: opts.limit,
      orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        entryNo: true,
        entryDate: true,
        sourceModule: true,
        sourceRefType: true,
        memo: true,
        status: true,
        totalDebit: true,
        totalCredit: true,
        createdByEmail: true,
        postedAt: true,
        reversalOfId: true,
        branchId: true,
        _count: { select: { lines: true } },
      },
    }),
    prisma.journalEntry.count({ where: where as any }),
  ])

  return {
    rows: rows.map(r => ({
      ...r,
      entryDate: r.entryDate.toISOString().slice(0, 10),
      lineCount: r._count.lines,
    })),
    total,
  }
}

export async function getJournalEntry(tenantId: string, entryId: string) {
  await assertInitialized(tenantId)

  const entry = await prisma.journalEntry.findFirst({
    where: { id: entryId, tenantId },
    include: {
      lines: {
        orderBy: { lineNo: 'asc' },
        include: {
          account: { select: { id: true, code: true, name: true, type: true } },
          taxCode: { select: { id: true, code: true, name: true, rate: true } },
        },
      },
      period: { select: { id: true, name: true, status: true } },
      integrationLinks: { select: { sourceType: true, sourceId: true, eventType: true } },
    },
  })
  if (!entry) throw new AppError('Journal entry not found', 404)

  const reversal = entry.reversalOfId
    ? await prisma.journalEntry.findUnique({
        where: { id: entry.reversalOfId },
        select: { id: true, entryNo: true },
      })
    : null

  const reversedBy = await prisma.journalEntry.findFirst({
    where: { tenantId, reversalOfId: entry.id, status: 'POSTED' },
    select: { id: true, entryNo: true },
  })

  return {
    ...entry,
    entryDate: entry.entryDate.toISOString().slice(0, 10),
    reversal,
    reversedBy,
  }
}

type ManualLineInput = {
  accountId: string
  description?: string
  debit?: number
  credit?: number
  taxCodeId?: string
  customerId?: string
  supplierId?: string
}

function parseManualLines(lines: ManualLineInput[]): JournalDraftLine[] {
  if (!lines?.length || lines.length < 2) {
    throw new AppError('A manual journal must have at least two lines', 400)
  }
  return lines.map(l => ({
    accountId: l.accountId,
    description: l.description,
    debit: round2(Math.max(0, Number(l.debit ?? 0))),
    credit: round2(Math.max(0, Number(l.credit ?? 0))),
    taxCodeId: l.taxCodeId,
    customerId: l.customerId,
    supplierId: l.supplierId,
  }))
}

function totalDebitFromLines(lines: JournalDraftLine[]) {
  return round2(lines.reduce((s, l) => s + l.debit, 0))
}

async function validateAccounts(tenantId: string, lines: JournalDraftLine[]) {
  const ids = [...new Set(lines.map(l => l.accountId))]
  const accounts = await prisma.glAccount.findMany({
    where: { tenantId, id: { in: ids }, isActive: true },
    select: { id: true },
  })
  if (accounts.length !== ids.length) {
    throw new AppError('One or more GL accounts are invalid or inactive', 400)
  }
}

export async function createManualJournalEntry(
  tenantId: string,
  body: {
    branchId?: string
    entryDate: string
    memo?: string
    lines: ManualLineInput[]
  },
  actorEmail?: string,
) {
  await assertInitialized(tenantId)

  const draftLines = parseManualLines(body.lines)
  assertBalanced(draftLines)
  await validateAccounts(tenantId, draftLines)

  const entryDate = businessDateDb(normalizeBusinessDate(body.entryDate))
  const manualId = randomUUID()
  const threshold = await getApprovalThreshold(tenantId)

  if (threshold != null && totalDebitFromLines(draftLines) > threshold) {
    return createPendingJournal(tenantId, {
      branchId: body.branchId,
      entryDate,
      memo: body.memo,
      lines: draftLines,
      createdByEmail: actorEmail,
      manualId,
    })
  }

  const je = await createPostedJournalEntry({
    tenantId,
    branchId: body.branchId,
    entryDate,
    sourceModule: 'MANUAL',
    sourceRefType: 'ManualJournal',
    sourceRefId: manualId,
    sourceEvent: 'MANUAL_POSTED',
    memo: body.memo,
    createdByEmail: actorEmail,
    lines: draftLines,
  })

  await prisma.auditEvent.create({
    data: {
      tenantId,
      branchId: body.branchId,
      actorEmail: actorEmail ?? 'system',
      eventType: 'MANUAL_JOURNAL_POSTED',
      entityType: 'JournalEntry',
      entityId: je.id,
      afterJson: { entryNo: je.entryNo, totalDebit: je.totalDebit },
    },
  })

  return getJournalEntry(tenantId, je.id)
}

async function getApprovalThreshold(tenantId: string) {
  const s = await prisma.accountingSettings.findUnique({ where: { tenantId } })
  return s?.requireApprovalAbove ?? null
}

async function createPendingJournal(
  tenantId: string,
  body: {
    branchId?: string
    entryDate: Date
    memo?: string
    lines: JournalDraftLine[]
    createdByEmail?: string
    manualId: string
  },
) {
  const { totalDebit, totalCredit } = assertBalanced(body.lines)
  const period = await resolveOpenPeriodForDate(tenantId, body.entryDate)
  const entryNo = await generateJournalEntryNo(tenantId)

  const je = await prisma.journalEntry.create({
    data: {
      tenantId,
      branchId: body.branchId ?? undefined,
      periodId: period.id,
      entryNo,
      entryDate: body.entryDate,
      sourceModule: 'MANUAL',
      sourceRefType: 'ManualJournal',
      sourceRefId: body.manualId,
      sourceEvent: 'MANUAL_PENDING',
      memo: body.memo,
      status: 'PENDING_APPROVAL',
      totalDebit,
      totalCredit,
      createdByEmail: body.createdByEmail,
      lines: {
        create: body.lines.map((l, idx) => ({
          tenantId,
          branchId: body.branchId ?? undefined,
          lineNo: idx + 1,
          account: { connect: { id: l.accountId } },
          description: l.description,
          debit: l.debit,
          credit: l.credit,
          customerId: l.customerId,
          supplierId: l.supplierId,
        })),
      },
    },
  })

  await prisma.approvalRequest.create({
    data: {
      tenantId,
      branchId: body.branchId,
      entityType: 'JournalEntry',
      entityId: je.id,
      action: 'POST',
      status: 'PENDING',
      requestedBy: body.createdByEmail ?? 'system',
    },
  })

  return getJournalEntry(tenantId, je.id)
}

export async function listPendingApprovals(tenantId: string) {
  await assertInitialized(tenantId)
  const rows = await prisma.journalEntry.findMany({
    where: { tenantId, status: 'PENDING_APPROVAL', sourceModule: 'MANUAL' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      entryNo: true,
      entryDate: true,
      memo: true,
      totalDebit: true,
      createdByEmail: true,
      createdAt: true,
    },
  })
  return rows.map(r => ({
    ...r,
    entryDate: r.entryDate.toISOString().slice(0, 10),
  }))
}

export async function approvePendingJournal(tenantId: string, entryId: string, actorEmail?: string) {
  await assertInitialized(tenantId)
  const entry = await prisma.journalEntry.findFirst({
    where: { id: entryId, tenantId, status: 'PENDING_APPROVAL' },
  })
  if (!entry) throw new AppError('Pending journal not found', 404)

  await resolveOpenPeriodForDate(tenantId, entry.entryDate)

  const updated = await prisma.journalEntry.update({
    where: { id: entryId },
    data: {
      status: 'POSTED',
      postedAt: new Date(),
      approvedAt: new Date(),
      createdByEmail: entry.createdByEmail ?? actorEmail,
    },
  })

  await prisma.approvalRequest.updateMany({
    where: { tenantId, entityType: 'JournalEntry', entityId: entryId, status: 'PENDING' },
    data: { status: 'APPROVED', approvedBy: actorEmail ?? 'system', resolvedAt: new Date() },
  })

  await prisma.auditEvent.create({
    data: {
      tenantId,
      actorEmail: actorEmail ?? 'system',
      eventType: 'MANUAL_JOURNAL_APPROVED',
      entityType: 'JournalEntry',
      entityId: entryId,
      afterJson: { entryNo: updated.entryNo },
    },
  })

  return getJournalEntry(tenantId, entryId)
}

export async function rejectPendingJournal(
  tenantId: string,
  entryId: string,
  actorEmail?: string,
  reason?: string,
) {
  await assertInitialized(tenantId)
  const entry = await prisma.journalEntry.findFirst({
    where: { id: entryId, tenantId, status: 'PENDING_APPROVAL' },
  })
  if (!entry) throw new AppError('Pending journal not found', 404)

  await prisma.journalEntry.update({
    where: { id: entryId },
    data: { status: 'DRAFT', memo: reason ? `Rejected: ${reason}` : `Rejected — ${entry.memo ?? ''}` },
  })

  await prisma.approvalRequest.updateMany({
    where: { tenantId, entityType: 'JournalEntry', entityId: entryId, status: 'PENDING' },
    data: { status: 'REJECTED', approvedBy: actorEmail ?? 'system', reason, resolvedAt: new Date() },
  })

  return getJournalEntry(tenantId, entryId)
}

export async function reverseManualJournalEntry(
  tenantId: string,
  entryId: string,
  actorEmail?: string,
  memo?: string,
) {
  await assertInitialized(tenantId)

  const original = await prisma.journalEntry.findFirst({
    where: { id: entryId, tenantId },
    include: { lines: { orderBy: { lineNo: 'asc' } } },
  })
  if (!original) throw new AppError('Journal entry not found', 404)
  if (original.status !== 'POSTED') throw new AppError('Only posted entries can be reversed', 400)
  if (original.sourceModule !== 'MANUAL') {
    throw new AppError('Only manual journal entries can be reversed from this screen. Use operational reversal flows for auto-journals.', 400)
  }

  const existingReversal = await prisma.journalEntry.findFirst({
    where: { tenantId, reversalOfId: original.id, status: 'POSTED' },
  })
  if (existingReversal) throw new AppError('This entry has already been reversed', 400)

  const reversalLines: JournalDraftLine[] = original.lines.map(l => ({
    accountId: l.accountId,
    debit: round2(Number(l.credit)),
    credit: round2(Number(l.debit)),
    description: `Reversal: ${l.description ?? ''}`.trim(),
    taxCodeId: l.taxCodeId ?? undefined,
    customerId: l.customerId ?? undefined,
    supplierId: l.supplierId ?? undefined,
  }))

  const reversalId = randomUUID()
  const je = await createPostedJournalEntry({
    tenantId,
    branchId: original.branchId,
    entryDate: original.entryDate,
    sourceModule: 'MANUAL',
    sourceRefType: 'ManualJournal',
    sourceRefId: reversalId,
    sourceEvent: 'MANUAL_REVERSED',
    memo: memo ?? `Reversal of ${original.entryNo}`,
    createdByEmail: actorEmail,
    reversalOfId: original.id,
    lines: reversalLines,
  })

  await prisma.auditEvent.create({
    data: {
      tenantId,
      actorEmail: actorEmail ?? 'system',
      eventType: 'MANUAL_JOURNAL_REVERSED',
      entityType: 'JournalEntry',
      entityId: je.id,
      afterJson: { reversesEntryNo: original.entryNo, entryNo: je.entryNo },
    },
  })

  return getJournalEntry(tenantId, je.id)
}
