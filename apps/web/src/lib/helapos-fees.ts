/**
 * Mirror of backend helapos-fees for transparent UI (server remains authoritative on create).
 * Formula: when net > feeFreeMax, customerPayable = ceil2(net / (1 - feeRate))
 */

export const HELAPOS_FEE_FREE_MAX = 5000
export const HELAPOS_FEE_RATE = 0.01

export type HelaposFeeBreakdown = {
  subscriptionAmount: number
  feeApplies: boolean
  feeRate: number
  customerPayableAmount: number
  processingFee: number
  expectedSettlementAmount: number
}

export function roundUpMoney(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.ceil(value * 100 - 1e-9) / 100
}

export function calculateHelaposCustomerPayable(
  subscriptionAmount: number,
  opts?: { feeFreeMax?: number; feeRate?: number },
): HelaposFeeBreakdown {
  const net = Math.round(Math.max(0, subscriptionAmount) * 100) / 100
  const feeFreeMax = opts?.feeFreeMax ?? HELAPOS_FEE_FREE_MAX
  const feeRate = opts?.feeRate ?? HELAPOS_FEE_RATE

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

  const customerPayableAmount = roundUpMoney(net / (1 - feeRate))
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
