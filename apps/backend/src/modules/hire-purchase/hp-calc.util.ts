import type { HpInterestType } from '@prisma/client'

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export type HpCalculationInput = {
  cashPrice: number
  downPayment: number
  interestType: HpInterestType
  interestRate: number
  processingFee?: number
  insuranceFee?: number
  documentFee?: number
  otherCharges?: number
  installmentMonths: number
  firstDueDate: Date | string
}

export type HpScheduleLine = {
  sequence: number
  dueDate: Date
  principal: number
  interest: number
  fees: number
  totalDue: number
  outstanding: number
}

export type HpCalculation = {
  cashPrice: number
  downPayment: number
  fees: number
  financeAmount: number
  interestAmount: number
  totalPayable: number
  monthlyInstallment: number
  schedule: HpScheduleLine[]
}

function money(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? round2(Math.max(0, n)) : 0
}

function addMonths(date: Date, months: number): Date {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
  const maxDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(date.getUTCDate(), maxDay))
  return target
}

export function calculateHirePurchase(input: HpCalculationInput): HpCalculation {
  const cashPrice = money(input.cashPrice)
  const downPayment = money(input.downPayment)
  const months = Math.max(1, Math.min(120, Math.trunc(Number(input.installmentMonths) || 0)))
  const annualRate = money(input.interestRate)
  const fees = round2(
    money(input.processingFee) +
    money(input.insuranceFee) +
    money(input.documentFee) +
    money(input.otherCharges),
  )
  if (cashPrice <= 0) throw new Error('Cash price must be greater than zero')
  if (downPayment > cashPrice + fees) throw new Error('Down payment cannot exceed cash price and charges')

  const financeAmount = round2(cashPrice - downPayment + fees)
  let interestAmount = 0
  let payment = financeAmount / months

  if (input.interestType === 'FLAT') {
    interestAmount = round2(financeAmount * (annualRate / 100) * (months / 12))
    payment = (financeAmount + interestAmount) / months
  } else if (input.interestType === 'REDUCING' && annualRate > 0) {
    const r = annualRate / 1200
    payment = financeAmount * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1)
    interestAmount = round2(payment * months - financeAmount)
  }

  const totalPayable = round2(financeAmount + interestAmount)
  const monthlyInstallment = round2(payment)
  const firstDueDate = new Date(input.firstDueDate)
  if (Number.isNaN(firstDueDate.getTime())) throw new Error('First due date is invalid')

  let principalBalance = financeAmount
  let payableBalance = totalPayable
  const schedule: HpScheduleLine[] = []
  const monthlyRate = annualRate / 1200

  for (let i = 1; i <= months; i += 1) {
    let interest = 0
    if (input.interestType === 'FLAT') {
      interest = i === months
        ? round2(interestAmount - schedule.reduce((sum, line) => sum + line.interest, 0))
        : round2(interestAmount / months)
    } else if (input.interestType === 'REDUCING') {
      interest = round2(principalBalance * monthlyRate)
    }

    const installment = i === months ? payableBalance : Math.min(monthlyInstallment, payableBalance)
    const principal = i === months ? principalBalance : round2(Math.min(principalBalance, installment - interest))
    const totalDue = round2(principal + interest)
    principalBalance = round2(Math.max(0, principalBalance - principal))
    payableBalance = round2(Math.max(0, payableBalance - totalDue))
    schedule.push({
      sequence: i,
      dueDate: addMonths(firstDueDate, i - 1),
      principal,
      interest,
      fees: 0,
      totalDue,
      outstanding: totalDue,
    })
  }

  const generatedTotal = round2(schedule.reduce((sum, line) => sum + line.totalDue, 0))
  const delta = round2(totalPayable - generatedTotal)
  if (delta !== 0 && schedule.length) {
    const last = schedule[schedule.length - 1]
    last.principal = round2(last.principal + delta)
    last.totalDue = round2(last.totalDue + delta)
    last.outstanding = last.totalDue
  }

  return { cashPrice, downPayment, fees, financeAmount, interestAmount, totalPayable, monthlyInstallment, schedule }
}

export function calculateEarlySettlement(
  principalOutstanding: number,
  accruedInterest: number,
  interestType: HpInterestType,
): number {
  const principal = money(principalOutstanding)
  // Flat-rate contracts receive an unearned-interest rebate; reducing contracts already accrue per balance.
  const interest = interestType === 'FLAT' ? 0 : money(accruedInterest)
  return round2(principal + interest)
}

