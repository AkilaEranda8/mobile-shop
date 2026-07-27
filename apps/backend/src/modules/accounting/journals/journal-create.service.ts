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

  // Retry on entryNo unique collisions (Redis lag vs DB after support inserts / redis flush).
  let lastErr: unknown
  for (let attempt = 0; attempt < 5; attempt++) {
    const entryNo = await generateJournalEntryNo(opts.tenantId)
    try {
      return await prisma.journalEntry.create({
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
    } catch (e: any) {
      lastErr = e
      const isEntryNoClash =
        e?.code === 'P2002' &&
        (Array.isArray(e?.meta?.target)
          ? e.meta.target.includes('entryNo') || e.meta.target.includes('tenantId_entryNo')
          : String(e?.meta?.target ?? '').includes('entryNo'))
      if (!isEntryNoClash) throw e
    }
  }
  throw lastErr
}

