import type { GlAccountType } from '@prisma/client'

export function round2(n: number) {
  return Math.round(n * 100) / 100
}

export type AccountBalanceRow = {
  accountId: string
  code: string
  name: string
  type: GlAccountType
  subtype: string
  totalDebit: number
  totalCredit: number
  balance: number
}

/** Normal balance: positive = natural side for the account type */
export function normalBalance(type: GlAccountType, totalDebit: number, totalCredit: number) {
  const dr = round2(totalDebit)
  const cr = round2(totalCredit)
  if (type === 'ASSET' || type === 'EXPENSE') return round2(dr - cr)
  return round2(cr - dr)
}

/** Trial balance presentation columns (debit / credit side) */
export function trialBalanceColumns(type: GlAccountType, balance: number) {
  const b = round2(Math.abs(balance))
  if (balance === 0) return { debit: 0, credit: 0 }
  if (type === 'ASSET' || type === 'EXPENSE') {
    return balance > 0 ? { debit: b, credit: 0 } : { debit: 0, credit: b }
  }
  return balance > 0 ? { debit: 0, credit: b } : { debit: b, credit: 0 }
}

export function sumBalances(rows: AccountBalanceRow[]) {
  return round2(rows.reduce((s, r) => s + r.balance, 0))
}
