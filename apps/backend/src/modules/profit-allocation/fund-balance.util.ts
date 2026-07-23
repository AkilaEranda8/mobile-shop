import { prisma } from '../../config/database'

function round2(n: number) {
  return Math.round(n * 100) / 100
}

/**
 * Running-balance formula (Excel Daily Summary parity):
 *
 *   Yesterday Balance + Today's Allocation = Total Balance
 *   Total Balance − Withdrawn + Deposits ± Adjustments = Remaining Balance
 *
 * Remaining Balance becomes the next day's Yesterday Balance (via ledger).
 */
export function computeRunningBalances(input: {
  yesterdayBalance: number
  todayAllocation: number
  withdrawn: number
  deposits: number
  adjustments: number
}) {
  const yesterdayBalance = round2(input.yesterdayBalance)
  const todayAllocation = round2(input.todayAllocation)
  const totalBalance = round2(yesterdayBalance + todayAllocation)
  const withdrawn = round2(input.withdrawn)
  const deposits = round2(input.deposits)
  const adjustments = round2(input.adjustments)
  const remainingBalance = round2(totalBalance - withdrawn + deposits + adjustments)
  return {
    yesterdayBalance,
    todayAllocation,
    totalBalance,
    withdrawn,
    deposits,
    adjustments,
    remainingBalance,
  }
}

/** Fund balance immediately before `at` (uses ProfitTransaction.balanceAfter ledger). */
export async function getFundBalanceAtInstant(fundId: string, at: Date): Promise<number> {
  const lastTx = await prisma.profitTransaction.findFirst({
    where: { fundId, createdAt: { lte: at } },
    orderBy: { createdAt: 'desc' },
  })
  return lastTx ? round2(lastTx.balanceAfter) : 0
}

/**
 * Yesterday Balance = previous day's Remaining Balance.
 * Loaded from the ledger (source of truth): last balanceAfter before this business day starts.
 * Never manually recalculated; never reset when a new day starts.
 */
export async function getFundBalanceBeforeDay(
  fundId: string,
  dateStr: string,
  allocationDbDate: (d: string) => Date,
): Promise<number> {
  const dayStart = allocationDbDate(dateStr)
  return getFundBalanceAtInstant(fundId, new Date(dayStart.getTime() - 1))
}

/** Today's WITHDRAW / DEPOSIT / ADJUSTMENT totals from the ledger (ALLOCATION excluded). */
export async function getDayMovementTotals(
  fundId: string,
  dateStr: string,
  allocationDbDate: (d: string) => Date,
): Promise<{ withdrawn: number; deposits: number; adjustments: number }> {
  const date = allocationDbDate(dateStr)
  const rows = await prisma.profitTransaction.groupBy({
    by: ['type'],
    where: {
      fundId,
      date,
      type: { in: ['WITHDRAW', 'DEPOSIT', 'ADJUSTMENT'] },
    },
    _sum: { amount: true },
  })

  let withdrawn = 0
  let deposits = 0
  let adjustments = 0
  for (const row of rows) {
    const sum = row._sum.amount ?? 0
    if (row.type === 'WITHDRAW') withdrawn = round2(Math.abs(sum))
    else if (row.type === 'DEPOSIT') deposits = round2(Math.abs(sum))
    else if (row.type === 'ADJUSTMENT') adjustments = round2(sum)
  }
  return { withdrawn, deposits, adjustments }
}
