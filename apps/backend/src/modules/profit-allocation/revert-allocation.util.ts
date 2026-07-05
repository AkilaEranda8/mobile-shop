import { prisma } from '../../config/database'
import { businessDateDb, normalizeBusinessDate } from '../../utils/date-range'

/** Reverse a saved profit allocation for a branch/day (fund balances + ledger rows). */
export async function revertSavedProfitAllocation(tenantId: string, branchId: string, dateStr: string) {
  const date = businessDateDb(normalizeBusinessDate(dateStr))
  const existing = await prisma.profitAllocation.findUnique({
    where: { tenantId_branchId_date: { tenantId, branchId, date } },
    include: { lines: true },
  })
  if (!existing) return false

  await prisma.$transaction(async tx => {
    for (const line of existing.lines) {
      if (line.todayAllocation > 0) {
        await tx.profitFund.update({
          where: { id: line.fundId },
          data: { balance: { decrement: line.todayAllocation } },
        })
      }
    }
    await tx.profitTransaction.deleteMany({
      where: { tenantId, branchId, date, type: 'ALLOCATION' },
    })
    await tx.profitAllocationLine.deleteMany({ where: { allocationId: existing.id } })
    await tx.profitAllocation.delete({ where: { id: existing.id } })
  })
  return true
}
