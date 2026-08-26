/**
 * Run: npx tsx src/modules/hr-engine/hr-engine.compensation.test.ts
 */
import {
  calculateCompensationResult,
  calculateCommissionPreview,
  resolveComponentAmount,
} from './hr-engine.compensation'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

assert(resolveComponentAmount(100_000, { code: 'TA', label: 'TA', kind: 'EARNING', calcType: 'FIXED', amount: 5000 }) === 5000, 'fixed')
assert(resolveComponentAmount(100_000, { code: 'ALL', label: 'All', kind: 'EARNING', calcType: 'PERCENT_OF_BASIC', amount: 10 }) === 10_000, 'percent')

const pkg = calculateCompensationResult({
  basicSalary: 100_000,
  components: [
    { code: 'TA', label: 'Transport', kind: 'EARNING', calcType: 'FIXED', amount: 5000 },
    { code: 'EPF', label: 'EPF EE', kind: 'DEDUCTION', calcType: 'PERCENT_OF_BASIC', amount: 8 },
  ],
  commissionAmount: 2500,
  advanceRecovery: 1000,
})
assert(pkg.gross === 107_500, `gross got ${pkg.gross}`)
assert(pkg.deductions === 9000, `deductions got ${pkg.deductions}`)
assert(pkg.net === 98_500, `net got ${pkg.net}`)
assert(!!pkg.deterministicHash, 'hash set')

const comm = calculateCommissionPreview(
  [
    { source: 'SALES', amount: 100_000 },
    { source: 'SALES', amount: 50_000 },
    { source: 'REPAIRS', amount: 20_000 },
  ],
  [
    { source: 'SALES', ratePercent: 1, flatPerUnit: 0 },
    { source: 'REPAIRS', ratePercent: 5, flatPerUnit: 100 },
  ],
)
assert(comm.bySource.SALES === 1500, `sales comm ${comm.bySource.SALES}`)
assert(comm.bySource.REPAIRS === 1100, `repair comm ${comm.bySource.REPAIRS}`)
assert(comm.total === 2600, `total ${comm.total}`)

console.log('hr-engine.compensation.test.ts: all checks passed')
