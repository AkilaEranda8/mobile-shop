import { computeRunningBalances } from './fund-balance.util'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

// Day 1 example from business spec
{
  const d1 = computeRunningBalances({
    yesterdayBalance: 100_000,
    todayAllocation: 15_000,
    withdrawn: 10_000,
    deposits: 0,
    adjustments: 0,
  })
  assert(d1.totalBalance === 115_000, `d1 total expected 115000 got ${d1.totalBalance}`)
  assert(d1.remainingBalance === 105_000, `d1 remaining expected 105000 got ${d1.remainingBalance}`)
}

// Day 2 carries Day 1 remaining
{
  const d2 = computeRunningBalances({
    yesterdayBalance: 105_000,
    todayAllocation: 20_000,
    withdrawn: 5_000,
    deposits: 0,
    adjustments: 0,
  })
  assert(d2.totalBalance === 125_000, `d2 total expected 125000 got ${d2.totalBalance}`)
  assert(d2.remainingBalance === 120_000, `d2 remaining expected 120000 got ${d2.remainingBalance}`)
}

// Deposits and adjustments included in Remaining
{
  const x = computeRunningBalances({
    yesterdayBalance: 100_000,
    todayAllocation: 10_000,
    withdrawn: 5_000,
    deposits: 2_000,
    adjustments: -500,
  })
  assert(x.totalBalance === 110_000, `total expected 110000 got ${x.totalBalance}`)
  assert(x.remainingBalance === 106_500, `remaining expected 106500 got ${x.remainingBalance}`)
}

console.log('fund-balance.util running-balance tests OK')
