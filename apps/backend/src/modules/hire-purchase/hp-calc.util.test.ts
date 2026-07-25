import assert from 'node:assert/strict'
import { calculateEarlySettlement, calculateHirePurchase } from './hp-calc.util'

const none = calculateHirePurchase({
  cashPrice: 120_000,
  downPayment: 20_000,
  interestType: 'NONE',
  interestRate: 0,
  installmentMonths: 10,
  firstDueDate: '2026-08-31',
})
assert.equal(none.financeAmount, 100_000)
assert.equal(none.totalPayable, 100_000)
assert.equal(none.monthlyInstallment, 10_000)
assert.equal(none.schedule.length, 10)
assert.equal(none.schedule.reduce((sum, row) => sum + row.totalDue, 0), none.totalPayable)
assert.equal(none.schedule[1].dueDate.toISOString().slice(0, 10), '2026-09-30')

const flat = calculateHirePurchase({
  cashPrice: 100_000,
  downPayment: 10_000,
  interestType: 'FLAT',
  interestRate: 12,
  processingFee: 2_000,
  installmentMonths: 12,
  firstDueDate: '2026-08-01',
})
assert.equal(flat.financeAmount, 92_000)
assert.equal(flat.interestAmount, 11_040)
assert.equal(flat.totalPayable, 103_040)
assert.equal(flat.schedule.reduce((sum, row) => Math.round((sum + row.totalDue) * 100) / 100, 0), flat.totalPayable)

const reducing = calculateHirePurchase({
  cashPrice: 100_000,
  downPayment: 20_000,
  interestType: 'REDUCING',
  interestRate: 18,
  installmentMonths: 12,
  firstDueDate: '2026-08-01',
})
assert.ok(reducing.interestAmount > 0)
assert.ok(reducing.schedule[0].interest > reducing.schedule[11].interest)
assert.equal(reducing.schedule.reduce((sum, row) => Math.round((sum + row.totalDue) * 100) / 100, 0), reducing.totalPayable)
assert.equal(calculateEarlySettlement(50_000, 3_000, 'FLAT'), 50_000)
assert.equal(calculateEarlySettlement(50_000, 3_000, 'REDUCING'), 53_000)

console.log('Hire purchase calculation tests passed')
