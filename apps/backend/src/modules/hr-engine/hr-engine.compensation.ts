/**
 * Pure compensation / package rules (HR Phase 4).
 */
import { createHash } from 'crypto'
import type { PayrollCalcLine, PayrollCalcResult } from './hr-engine.types'

export type CompComponentInput = {
  code: string
  label: string
  kind: 'EARNING' | 'DEDUCTION' | 'EMPLOYER'
  calcType: 'FIXED' | 'PERCENT_OF_BASIC'
  amount: number
}

export type CompensationInput = {
  basicSalary: number
  components: CompComponentInput[]
  /** Staff commission preview amount for period */
  commissionAmount?: number
  /** Advance recovery this period */
  advanceRecovery?: number
  /** Loan installment recovery this period */
  loanRecovery?: number
  /** Optional EPF employee rate (e.g. 0.08) — applied on basic if > 0 */
  epfEmployeeRate?: number
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

export function resolveComponentAmount(basic: number, c: CompComponentInput): number {
  if (c.calcType === 'PERCENT_OF_BASIC') return round2(basic * (c.amount / 100))
  return round2(c.amount)
}

/** Build package lines from basic + components (employer lines excluded from net). */
export function calculateCompensationResult(input: CompensationInput): PayrollCalcResult {
  const lines: PayrollCalcLine[] = [
    { code: 'BASIC', label: 'Basic salary', amount: round2(input.basicSalary), kind: 'EARNING' },
  ]

  for (const c of input.components) {
    const amount = resolveComponentAmount(input.basicSalary, c)
    if (amount === 0) continue
    lines.push({ code: c.code, label: c.label, amount, kind: c.kind })
  }

  const commission = round2(input.commissionAmount ?? 0)
  if (commission > 0) {
    lines.push({ code: 'COMMISSION', label: 'Staff commission', amount: commission, kind: 'EARNING' })
  }

  const epfRate = input.epfEmployeeRate ?? 0
  if (epfRate > 0) {
    lines.push({
      code: 'EPF_EE',
      label: 'EPF (employee)',
      amount: round2(input.basicSalary * epfRate),
      kind: 'DEDUCTION',
    })
  }

  const adv = round2(input.advanceRecovery ?? 0)
  if (adv > 0) {
    lines.push({ code: 'ADV_REC', label: 'Advance recovery', amount: adv, kind: 'DEDUCTION' })
  }

  const loan = round2(input.loanRecovery ?? 0)
  if (loan > 0) {
    lines.push({ code: 'LOAN_REC', label: 'Loan installment', amount: loan, kind: 'DEDUCTION' })
  }

  return summarizePayrollLines(lines)
}

export function summarizePayrollLines(lines: PayrollCalcLine[]): PayrollCalcResult {
  const gross = round2(lines.filter(l => l.kind === 'EARNING').reduce((s, l) => s + l.amount, 0))
  const deductions = round2(lines.filter(l => l.kind === 'DEDUCTION').reduce((s, l) => s + l.amount, 0))
  const net = round2(gross - deductions)
  const deterministicHash = createHash('sha256')
    .update(JSON.stringify(lines.map(l => [l.code, l.kind, l.amount])))
    .digest('hex')
    .slice(0, 16)
  return { gross, deductions, net, lines, deterministicHash }
}

export type CommissionDoc = {
  source: 'SALES' | 'REPAIRS' | 'HIRE_PURCHASE' | 'WHOLESALE_VAN'
  amount: number
  count?: number
}

export type CommissionRuleInput = {
  source: 'SALES' | 'REPAIRS' | 'HIRE_PURCHASE' | 'WHOLESALE_VAN'
  ratePercent: number
  flatPerUnit: number
}

/** Pure commission from attributed revenue docs + rules. */
export function calculateCommissionPreview(
  docs: CommissionDoc[],
  rules: CommissionRuleInput[],
): { total: number; bySource: Record<string, number>; lines: Array<{ source: string; base: number; amount: number }> } {
  const bySource: Record<string, number> = { SALES: 0, REPAIRS: 0, HIRE_PURCHASE: 0, WHOLESALE_VAN: 0 }
  const lines: Array<{ source: string; base: number; amount: number }> = []

  for (const rule of rules) {
    const matching = docs.filter(d => d.source === rule.source)
    const base = round2(matching.reduce((s, d) => s + d.amount, 0))
    const units = matching.reduce((s, d) => s + (d.count ?? 1), 0)
    const amount = round2(base * (rule.ratePercent / 100) + units * rule.flatPerUnit)
    if (amount <= 0 && base <= 0) continue
    bySource[rule.source] = round2((bySource[rule.source] ?? 0) + amount)
    lines.push({ source: rule.source, base, amount })
  }

  const total = round2(Object.values(bySource).reduce((s, n) => s + n, 0))
  return { total, bySource, lines }
}

/** Alias used by payroll engine. */
export function calculatePayrollResult(input: CompensationInput): PayrollCalcResult {
  return calculateCompensationResult(input)
}
