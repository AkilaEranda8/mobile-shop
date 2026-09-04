/**
 * HelaPOS fee calculation tests.
 * Run: npx tsx src/modules/billing/helapos-fees.test.ts
 */
import {
  HELAPOS_FEE_FREE_MAX,
  HELAPOS_FEE_RATE,
  calculateHelaposCustomerPayable,
  roundUpMoney,
} from './helapos-fees'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

function almostEqual(a: number, b: number, eps = 0.001) {
  return Math.abs(a - b) <= eps
}

// ── Rounding ────────────────────────────────────────────────────────────────
assert(roundUpMoney(5050.505) === 5050.51, 'round up 5050.505 → 5050.51')
assert(roundUpMoney(5050.501) === 5050.51, 'round up 5050.501 → 5050.51')
assert(roundUpMoney(5050.5) === 5050.5, 'exact half-cent stays 5050.50')
assert(roundUpMoney(10000 / 0.99) === 10101.02, '10000/0.99 round up')

// ── 0% fee at / below threshold ──────────────────────────────────────────────
{
  const r = calculateHelaposCustomerPayable(5000)
  assert(r.feeApplies === false, '5000: feeApplies false')
  assert(r.processingFee === 0, '5000: fee 0')
  assert(r.customerPayableAmount === 5000, '5000: payable = net')
  assert(r.expectedSettlementAmount === 5000, '5000: settlement = net')
}
{
  const r = calculateHelaposCustomerPayable(4999.99)
  assert(r.feeApplies === false, '4999.99: no fee')
  assert(r.customerPayableAmount === 4999.99, '4999.99: payable exact')
}
{
  const r = calculateHelaposCustomerPayable(0)
  assert(r.customerPayableAmount === 0 && r.processingFee === 0, 'zero amount')
}

// ── 1% fee above threshold ───────────────────────────────────────────────────
{
  const r = calculateHelaposCustomerPayable(5000.01)
  assert(r.feeApplies === true, '5000.01: fee applies')
  assert(r.feeRate === HELAPOS_FEE_RATE, 'fee rate 1%')
  assert(r.customerPayableAmount > 5000.01, 'gross > net')
}
{
  // Spec example: 5000 is free; use 5000 only for 0%. For 1% demo use net that needs fee.
  // User's worked example treats 5000 as if fee applied — product rule is <=5000 free.
  // Verify formula for any net > 5000, and separately verify 5000/0.99 math helpers.
  const raw = 5000 / (1 - 0.01)
  assert(almostEqual(raw, 5050.5050505), 'raw 5000/0.99')
  assert(roundUpMoney(raw) === 5050.51, 'spec gross 5050.51')

  // Incorrect method must NOT match
  const wrong = Math.round((5000 + 5000 * 0.01) * 100) / 100
  assert(wrong === 5050, 'incorrect additive method = 5050')
  assert(wrong !== 5050.51, 'additive ≠ correct gross')
}

{
  // Realistic case above threshold: subscription 10000
  const r = calculateHelaposCustomerPayable(10000)
  assert(r.feeApplies === true, '10000 fee applies')
  assert(r.subscriptionAmount === 10000, 'subscription stays 10000')
  assert(r.customerPayableAmount === roundUpMoney(10000 / 0.99), 'gross = net/0.99 ceil')
  assert(r.processingFee === Math.round((r.customerPayableAmount - 10000) * 100) / 100, 'fee = gross-net')
  assert(r.expectedSettlementAmount === 10000, 'revenue stays net')
  // After 1% deduction from customer pay, settlement >= net (because we rounded up)
  const afterFee = r.customerPayableAmount * (1 - HELAPOS_FEE_RATE)
  assert(afterFee + 1e-9 >= 10000, 'net after fee >= subscription')
}

{
  // Just above free threshold
  const r = calculateHelaposCustomerPayable(HELAPOS_FEE_FREE_MAX + 0.01)
  assert(r.feeApplies === true, 'just above threshold')
  assert(r.customerPayableAmount === roundUpMoney(r.subscriptionAmount / 0.99), 'formula')
}

// ── Custom opts (reusable) ──────────────────────────────────────────────────
{
  const r = calculateHelaposCustomerPayable(1000, { feeFreeMax: 100, feeRate: 0.01 })
  assert(r.feeApplies === true, 'custom threshold')
  assert(r.customerPayableAmount === roundUpMoney(1000 / 0.99), 'custom gross')
}

// ── Idempotent webhook decision helpers ─────────────────────────────────────
function webhookOutcome(opts: {
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  success: boolean
  expectedAmount: number
  gotAmount: number | null
}): { ok: boolean; alreadyApproved?: boolean; reason?: string } {
  if (opts.status === 'APPROVED') return { ok: true, alreadyApproved: true }
  if (opts.status === 'REJECTED') return { ok: false, reason: 'payment_rejected' }
  if (!opts.success) return { ok: true, reason: 'not_success' }
  if (opts.gotAmount != null && Math.abs(opts.gotAmount - opts.expectedAmount) > 0.5) {
    return { ok: false, reason: 'amount_mismatch' }
  }
  return { ok: true }
}

assert(webhookOutcome({ status: 'APPROVED', success: true, expectedAmount: 5050.51, gotAmount: 5050.51 }).alreadyApproved === true, 'duplicate webhook idempotent')
assert(webhookOutcome({ status: 'REJECTED', success: true, expectedAmount: 5050.51, gotAmount: 5050.51 }).reason === 'payment_rejected', 'rejected blocked')
assert(webhookOutcome({ status: 'PENDING', success: false, expectedAmount: 5050.51, gotAmount: null }).ok === true, 'failed payment soft-ok')
assert(webhookOutcome({ status: 'PENDING', success: true, expectedAmount: 5050.51, gotAmount: 4000 }).reason === 'amount_mismatch', 'amount mismatch')
assert(webhookOutcome({ status: 'PENDING', success: true, expectedAmount: 5050.51, gotAmount: 5050.51 }).ok === true, 'success match')

console.log('helapos-fees.test.ts: all checks passed')
