import { prisma } from '../../config/database'

function round2(n: number) {
  return Math.round(n * 100) / 100
}

/** Fund balance immediately before `at` (uses ProfitTransaction.balanceAfter ledger). */
export async function getFundBalanceAtInstant(fundId: string, at: Date): Promise<number> {
  const lastTx = await prisma.profitTransaction.findFirst({
    where: { fundId, createdAt: { lte: at } },
    orderBy: { createdAt: 'desc' },
  })
  return lastTx ? round2(lastTx.balanceAfter) : 0
}

/** Balance at start of a business day (before any activity that day). */
export async function getFundBalanceBeforeDay(
  fundId: string,
  dateStr: string,
  allocationDbDate: (d: string) => Date,
): Promise<number> {
  const dayStart = allocationDbDate(dateStr)
  return getFundBalanceAtInstant(fundId, new Date(dayStart.getTime() - 1))
}
