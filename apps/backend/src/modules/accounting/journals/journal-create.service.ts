import { prisma } from '../../../config/database'
import { businessDateDb, businessDateFromInstant } from '../../../utils/date-range'
import type { JournalSourceModule } from '@prisma/client'
import { assertBalanced, type JournalDraftLine } from './journal-validator.util'
import { generateJournalEntryNo } from './journal-number.util'
import { resolveOpenPeriodForDate } from './journal-period.util'

export async function createPostedJournalEntry(opts: {
  tenantId: string
  branchId?: string | null
  entryDate?: Date
  sourceModule: JournalSourceModule
  sourceRefType: string
  sourceRefId: string
  sourceEvent: string
  memo?: string
  createdByEmail?: string
  reversalOfId?: string
  skipPeriodStatusCheck?: boolean
  lines: JournalDraftLine[]
}) {
  const entryDate = opts.entryDate ?? businessDateDb(businessDateFromInstant())
  const { totalDebit, totalCredit } = assertBalanced(opts.lines)
  const period = await resolveOpenPeriodForDate(opts.tenantId, entryDate, opts.skipPeriodStatusCheck)
  const entryNo = await generateJournalEntryNo(opts.tenantId)

  return prisma.journalEntry.create({
    data: {
      tenantId: opts.tenantId,
      branchId: opts.branchId ?? undefined,
      periodId: period.id,
      entryNo,
      entryDate,
      sourceModule: opts.sourceModule,
      sourceRefType: opts.sourceRefType,
      sourceRefId: opts.sourceRefId,
      sourceEvent: opts.sourceEvent,
      memo: opts.memo,
      status: 'POSTED',
      totalDebit,
      totalCredit,
      reversalOfId: opts.reversalOfId,
      createdByEmail: opts.createdByEmail,
      postedAt: new Date(),
      lines: {
        create: opts.lines.map((l, idx) => ({
          tenantId: opts.tenantId,
          branchId: opts.branchId ?? undefined,
          lineNo: idx + 1,
          account: { connect: { id: l.accountId } },
          description: l.description,
          debit: l.debit,
          credit: l.credit,
          ...(l.taxCodeId ? { taxCode: { connect: { id: l.taxCodeId } } } : {}),
          customerId: l.customerId,
          supplierId: l.supplierId,
          metadata: (l.metadata ?? undefined) as any,
        })),
      },
    },
    include: { lines: true },
  })
}

