import { randomUUID } from 'crypto'
import type { PaymentMethod } from '@prisma/client'
import { prisma } from '../../../config/database'
import { businessDateDb, normalizeBusinessDate } from '../../../utils/date-range'
import { AppError } from '../../../middleware/error.middleware'
import { createPostedJournalEntry } from '../journals/journal-create.service'
import type { JournalDraftLine } from '../journals/journal-validator.util'
import { round2 } from '../reports/gl-balances.util'
import { resolvePaymentGlAccountId } from '../subledgers/ar-ap-payment.service'

type PayrollLine = { employeeName: string; userId?: string; amount: number }

async function getSettings(tenantId: string) {
  const s = await prisma.accountingSettings.findUnique({ where: { tenantId } })
  if (!s?.initializedAt) throw new AppError('Accounting is not initialized', 400)
  return s
}

async function accountKey(tenantId: string, key: string) {
  const map = ((await getSettings(tenantId)).defaultAccounts ?? {}) as Record<string, string>
  const id = map[key]
  if (!id) throw new AppError(`Missing account mapping: ${key}`, 400)
  return id
}

export async function listPayrollRuns(tenantId: string) {
  await getSettings(tenantId)
  const entries = await prisma.journalEntry.findMany({
    where: { tenantId, sourceModule: 'PAYROLL', sourceEvent: 'PAYROLL_ACCRUED', status: 'POSTED' },
    orderBy: { entryDate: 'desc' },
    take: 50,
    select: {
      id: true,
      entryNo: true,
      entryDate: true,
      memo: true,
      totalDebit: true,
      totalCredit: true,
      sourceRefId: true,
      postedAt: true,
      lines: { select: { description: true, credit: true, metadata: true } },
    },
  })

  const runs = await Promise.all(entries.map(async e => {
    const paid = await prisma.journalEntry.findFirst({
      where: { tenantId, sourceModule: 'PAYROLL', sourceEvent: 'PAYROLL_PAID', status: 'POSTED', memo: { contains: e.entryNo } },
      select: { id: true, entryNo: true },
    })
    return {
      id: e.sourceRefId ?? e.id,
      accrualEntryId: e.id,
      entryNo: e.entryNo,
      entryDate: e.entryDate.toISOString().slice(0, 10),
      memo: e.memo,
      totalAmount: e.totalDebit,
      employeeCount: e.lines.filter(l => Number(l.credit) > 0).length,
      status: paid ? 'PAID' as const : 'ACCRUED' as const,
      paymentEntryNo: paid?.entryNo ?? null,
    }
  }))

  return runs
}

export async function createPayrollAccrual(
  tenantId: string,
  body: {
    branchId?: string
    entryDate: string
    periodLabel: string
    lines: PayrollLine[]
    applyStatutory?: boolean
    epfEmployeeRate?: number
    epfEmployerRate?: number
    etfRate?: number
  },
  actorEmail?: string,
) {
  await getSettings(tenantId)
  const lines = body.lines?.filter(l => Number(l.amount) > 0) ?? []
  if (!lines.length) throw new AppError('At least one employee line is required', 400)

  const expenseGlId = await accountKey(tenantId, 'opex')
  const payableGlId = await accountKey(tenantId, 'salaryPayable')
  const runId = randomUUID()
  const applyStatutory = body.applyStatutory ?? false
  const epfEeRate = body.epfEmployeeRate ?? 0.08
  const epfErRate = body.epfEmployerRate ?? 0.12
  const etfRate = body.etfRate ?? 0.03

  let totalGross = 0
  let totalNet = 0
  let totalEpf = 0
  let totalEtf = 0
  const employeeCredits: JournalDraftLine[] = []

  for (const l of lines) {
    const gross = round2(Number(l.amount))
    totalGross += gross
    if (applyStatutory) {
      const epfEe = round2(gross * epfEeRate)
      const epfEr = round2(gross * epfErRate)
      const etf = round2(gross * etfRate)
      const net = round2(gross - epfEe)
      totalNet += net
      totalEpf += round2(epfEe + epfEr)
      totalEtf += etf
      employeeCredits.push({
        accountId: payableGlId,
        debit: 0,
        credit: net,
        description: `${l.employeeName} (net)`,
        metadata: { employeeName: l.employeeName, gross, epfEe, epfEr, etf, net },
      })
    } else {
      totalNet += gross
      employeeCredits.push({
        accountId: payableGlId,
        debit: 0,
        credit: gross,
        description: l.employeeName,
        metadata: { employeeName: l.employeeName, userId: l.userId ?? null },
      })
    }
  }

  totalGross = round2(totalGross)
  totalNet = round2(totalNet)
  totalEpf = round2(totalEpf)
  totalEtf = round2(totalEtf)

  const journalLines: JournalDraftLine[] = [
    {
      accountId: expenseGlId,
      debit: round2(totalNet + totalEpf + totalEtf),
      credit: 0,
      description: `Salaries — ${body.periodLabel}`,
      metadata: { periodLabel: body.periodLabel, applyStatutory, totalGross },
    },
    ...employeeCredits,
  ]

  if (applyStatutory && totalEpf > 0) {
    const epfGlId = await accountKey(tenantId, 'epfPayable')
    journalLines.push({ accountId: epfGlId, debit: 0, credit: totalEpf, description: 'EPF liability' })
  }
  if (applyStatutory && totalEtf > 0) {
    const etfGlId = await accountKey(tenantId, 'etfPayable')
    journalLines.push({ accountId: etfGlId, debit: 0, credit: totalEtf, description: 'ETF liability' })
  }

  return createPostedJournalEntry({
    tenantId,
    branchId: body.branchId,
    entryDate: businessDateDb(normalizeBusinessDate(body.entryDate)),
    sourceModule: 'PAYROLL',
    sourceRefType: 'PayrollRun',
    sourceRefId: runId,
    sourceEvent: 'PAYROLL_ACCRUED',
    memo: `Payroll accrual — ${body.periodLabel}`,
    createdByEmail: actorEmail,
    lines: journalLines,
  })
}

export async function payPayrollRun(
  tenantId: string,
  runId: string,
  body: { branchId: string; entryDate: string; paymentMethod: PaymentMethod; memo?: string },
  actorEmail?: string,
) {
  await getSettings(tenantId)

  const accrual = await prisma.journalEntry.findFirst({
    where: { tenantId, sourceRefId: runId, sourceEvent: 'PAYROLL_ACCRUED', status: 'POSTED' },
  })
  if (!accrual) throw new AppError('Payroll accrual not found', 404)

  const existingPay = await prisma.journalEntry.findFirst({
    where: { tenantId, sourceModule: 'PAYROLL', sourceEvent: 'PAYROLL_PAID', memo: { contains: accrual.entryNo } },
  })
  if (existingPay) throw new AppError('This payroll run has already been paid', 400)

  const payableGlId = await accountKey(tenantId, 'salaryPayable')
  const accrualLines = await prisma.journalLine.findMany({
    where: { entryId: accrual.id, accountId: payableGlId },
  })
  const amount = round2(accrualLines.reduce((s, l) => s + Number(l.credit), 0))
  if (amount <= 0) throw new AppError('No salary payable balance for this run', 400)

  const bankGlId = await resolvePaymentGlAccountId(tenantId, body.branchId, body.paymentMethod)
  const payRefId = randomUUID()

  const lines: JournalDraftLine[] = [
    { accountId: payableGlId, debit: amount, credit: 0, description: 'Salary payment' },
    { accountId: bankGlId, debit: 0, credit: amount, description: `Payroll — ${body.paymentMethod}` },
  ]

  return createPostedJournalEntry({
    tenantId,
    branchId: body.branchId,
    entryDate: businessDateDb(normalizeBusinessDate(body.entryDate)),
    sourceModule: 'PAYROLL',
    sourceRefType: 'PayrollRun',
    sourceRefId: payRefId,
    sourceEvent: 'PAYROLL_PAID',
    memo: body.memo ?? `Payroll payment for ${accrual.entryNo}`,
    createdByEmail: actorEmail,
    lines,
  })
}

export async function listPayrollEmployees(tenantId: string) {
  const users = await prisma.user.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' },
  })
  return users
}
