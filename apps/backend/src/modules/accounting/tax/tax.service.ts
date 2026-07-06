import { randomUUID } from 'crypto'
import type { PaymentMethod } from '@prisma/client'
import { prisma } from '../../../config/database'
import { businessDateDb, normalizeBusinessDate } from '../../../utils/date-range'
import { AppError } from '../../../middleware/error.middleware'
import { createPostedJournalEntry } from '../journals/journal-create.service'
import type { JournalDraftLine } from '../journals/journal-validator.util'
import { round2 } from '../reports/gl-balances.util'
import { resolvePaymentGlAccountId } from '../subledgers/ar-ap-payment.service'

async function assertInitialized(tenantId: string) {
  const s = await prisma.accountingSettings.findUnique({ where: { tenantId } })
  if (!s?.initializedAt) throw new AppError('Accounting is not initialized', 400)
  return s
}

async function accountKey(tenantId: string, key: string) {
  const s = await assertInitialized(tenantId)
  const map = (s.defaultAccounts ?? {}) as Record<string, string>
  const id = map[key]
  if (!id) throw new AppError(`Missing account mapping: ${key}`, 400)
  return id
}

export async function listTaxCodes(tenantId: string) {
  await assertInitialized(tenantId)
  return prisma.taxCode.findMany({
    where: { tenantId },
    orderBy: { code: 'asc' },
    include: { glAccount: { select: { id: true, code: true, name: true } } },
  })
}

export async function getVatSummary(
  tenantId: string,
  opts: { fromKey: string; toKey: string; branchId?: string },
) {
  await assertInitialized(tenantId)
  const vatOutputId = await accountKey(tenantId, 'vatOutput')
  const vatInputId = await accountKey(tenantId, 'vatInput')

  const entryDate = {
    gte: businessDateDb(normalizeBusinessDate(opts.fromKey)),
    lte: businessDateDb(normalizeBusinessDate(opts.toKey)),
  }

  const lineFilter = (accountId: string) => ({
    tenantId,
    accountId,
    ...(opts.branchId ? { OR: [{ branchId: null }, { branchId: opts.branchId }] } : {}),
    entry: {
      status: 'POSTED' as const,
      entryDate,
      ...(opts.branchId ? { OR: [{ branchId: null }, { branchId: opts.branchId }] } : {}),
    },
  })

  const [outputAgg, inputAgg] = await Promise.all([
    prisma.journalLine.aggregate({
      where: lineFilter(vatOutputId),
      _sum: { debit: true, credit: true },
    }),
    prisma.journalLine.aggregate({
      where: lineFilter(vatInputId),
      _sum: { debit: true, credit: true },
    }),
  ])

  const outputVat = round2(Number(outputAgg._sum.credit ?? 0) - Number(outputAgg._sum.debit ?? 0))
  const inputVat = round2(Number(inputAgg._sum.debit ?? 0) - Number(inputAgg._sum.credit ?? 0))
  const netPayable = round2(outputVat - inputVat)

  return {
    from: opts.fromKey,
    to: opts.toKey,
    outputVat,
    inputVat,
    netPayable,
  }
}

export async function postVatPayment(
  tenantId: string,
  body: {
    branchId: string
    entryDate: string
    amount: number
    paymentMethod: PaymentMethod
    reference?: string
    memo?: string
    from?: string
    to?: string
  },
  actorEmail?: string,
) {
  await assertInitialized(tenantId)
  const amount = round2(Math.max(0, Number(body.amount)))
  if (amount <= 0) throw new AppError('VAT payment amount must be greater than zero', 400)

  const vatOutputId = await accountKey(tenantId, 'vatOutput')
  const vatInputId = await accountKey(tenantId, 'vatInput')
  const bankGlId = await resolvePaymentGlAccountId(tenantId, body.branchId, body.paymentMethod)
  const refId = randomUUID()

  let inputCredit = 0
  let outputDebit = amount
  if (body.from && body.to) {
    const summary = await getVatSummary(tenantId, {
      fromKey: body.from,
      toKey: body.to,
      branchId: body.branchId,
    })
    inputCredit = round2(Math.min(summary.inputVat, Math.max(0, summary.outputVat - amount)))
    outputDebit = round2(amount + inputCredit)
  }

  const lines: JournalDraftLine[] = [
    { accountId: vatOutputId, debit: outputDebit, credit: 0, description: 'VAT remittance — output' },
  ]
  if (inputCredit > 0) {
    lines.push({ accountId: vatInputId, debit: 0, credit: inputCredit, description: 'VAT remittance — input offset' })
  }
  lines.push({ accountId: bankGlId, debit: 0, credit: amount, description: `VAT payment — ${body.paymentMethod}` })

  const je = await createPostedJournalEntry({
    tenantId,
    branchId: body.branchId,
    entryDate: businessDateDb(normalizeBusinessDate(body.entryDate)),
    sourceModule: 'TAX',
    sourceRefType: 'VatPayment',
    sourceRefId: refId,
    sourceEvent: 'VAT_PAID',
    memo: body.memo ?? 'VAT payment to authority',
    createdByEmail: actorEmail,
    lines,
  })

  return je
}
