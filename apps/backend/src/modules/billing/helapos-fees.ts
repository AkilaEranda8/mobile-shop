/**
 * HelaPOS LankaQR merchant fee → customer gross amount.
 *
 * Rules (HelaPOS):
 * - Net amounts up to and including FEE_FREE_MAX have 0% fee.
 * - Above FEE_FREE_MAX, a FEE_RATE fee is deducted from the customer payment before settlement.
 *
 * To receive `netAmount` after the fee:
 *   customerPayable = netAmount / (1 - FEE_RATE)
 * Always round UP to 2 decimal places so net never falls short.
 *
 * Do NOT use netAmount * (1 + FEE_RATE) — that under-recovers.
 */

/** Inclusive max net LKR with 0% HelaPOS fee */
export const HELAPOS_FEE_FREE_MAX = 5000

/** Fee rate applied when net (subscription) amount is above HELAPOS_FEE_FREE_MAX */
export const HELAPOS_FEE_RATE = 0.01

export type HelaposFeeBreakdown = {
  /** Original subscription / invoice amount we want to receive net */
  subscriptionAmount: number
  /** Whether the 1% fee applies */
  feeApplies: boolean
  feeRate: number
  /** Customer pays this via QR (gross) */
  customerPayableAmount: number
  /** Processing fee portion (customerPayable − subscription), 0 when fee does not apply */
  processingFee: number
  /** Expected settlement after HelaPOS fee ≈ subscriptionAmount */
  expectedSettlementAmount: number
}

/** Round UP to 2 decimal places (cents). Never round down for fee recovery. */
export function roundUpMoney(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value <= 0) return 0
  // Avoid float noise: work in integer cents with ceiling
  return Math.ceil(value * 100 - 1e-9) / 100
}

function normalizeMoney(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Amount must be a finite non-negative number')
  }
  // Normalize to 2dp for threshold comparison (5000.001 → treat carefully)
  return Math.round(value * 100) / 100
}

/**
 * Given the subscription net we want to keep, compute what the customer must pay via HelaPOS QR.
 */
export function calculateHelaposCustomerPayable(
  subscriptionAmount: number,
  opts?: { feeFreeMax?: number; feeRate?: number },
): HelaposFeeBreakdown {
  const net = normalizeMoney(subscriptionAmount)
  const feeFreeMax = opts?.feeFreeMax ?? HELAPOS_FEE_FREE_MAX
  const feeRate = opts?.feeRate ?? HELAPOS_FEE_RATE

  if (feeRate < 0 || feeRate >= 1) {
    throw new Error('feeRate must be in [0, 1)')
  }

  // Exactly at or below threshold → 0% fee
  if (net <= feeFreeMax) {
    return {
      subscriptionAmount: net,
      feeApplies: false,
      feeRate: 0,
      customerPayableAmount: net,
      processingFee: 0,
      expectedSettlementAmount: net,
    }
  }

  const divisor = 1 - feeRate
  const rawGross = net / divisor
  const customerPayableAmount = roundUpMoney(rawGross)
  const processingFee = Math.round((customerPayableAmount - net) * 100) / 100

  return {
    subscriptionAmount: net,
    feeApplies: true,
    feeRate,
    customerPayableAmount,
    processingFee,
    expectedSettlementAmount: net,
  }
}

/** Public fee policy for API/config (no secrets). */
export function getHelaposFeePolicy() {
  return {
    feeFreeMaxAmount: HELAPOS_FEE_FREE_MAX,
    feeRateAbove: HELAPOS_FEE_RATE,
    currency: 'LKR',
  }
}
