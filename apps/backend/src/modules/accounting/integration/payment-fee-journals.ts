import { randomUUID } from 'crypto'
import type { PaymentMethod } from '@prisma/client'
import { prisma } from '../../../config/database'
import { AppError } from '../../../middleware/error.middleware'
import { isFeatureEnabledForBranch } from '../../../utils/tenant-feature.util'
import { createPostedJournalEntry } from '../journals/journal-create.service'
import type { JournalDraftLine } from '../journals/journal-validator.util'
import { round2 } from './inventory-cogs.util'
import { resolvePaymentGlAccountId } from '../subledgers/ar-ap-payment.service'

type PaymentGlKey = 'paymentFeeIncome' | 'paymentProviderFees' | 'paymentClearing'

const PAYMENT_GL_DEFS: Record<PaymentGlKey, { code: string; name: string; type: 'ASSET' | 'INCOME' | 'EXPENSE'; subtype: 'BANK' | 'REVENUE' | 'OPEX' }> = {
  paymentFeeIncome: { code: '4050', name: 'Payment Surcharge Income', type: 'INCOME', subtype: 'REVENUE' },
  paymentProviderFees: { code: '5150', name: 'Payment Provider Charges', type: 'EXPENSE', subtype: 'OPEX' },
  paymentClearing: { code: '1130', name: 'Pending Payment Clearance', type: 'ASSET', subtype: 'BANK' },
}

/** Legacy card/UPI clearing accounts are settled in bulk from Cash & Bank — never mix per-payment clearance into them. */
async function legacyBulkClearingIds(tenantId: string): Promise<Set<string>> {
  const settings = await prisma.accountingSettings.findUnique({ where: { tenantId } })
  const map = (settings?.defaultAccounts ?? {}) as Record<string, unknown>
  return new Set(['cardClearing', 'upiClearing'].map(k => map[k]).filter((v): v is string => typeof v === 'string' && !!v))
}

export async function listLegacyBulkClearingIds(tenantId: string) {
  return legacyBulkClearingIds(tenantId)
}

/** True when this tenant/branch posts GL journals (never initializes accounting implicitly). */
export async function paymentAccountingActive(tenantId: string, branchId: string | null | undefined) {
  const settings = await prisma.accountingSettings.findUnique({ where: { tenantId } })
  if (!settings?.initializedAt) return false
  return isFeatureEnabledForBranch(tenantId, branchId ?? null, 'ACCOUNTING')
}

/** Resolve (creating on first use) one of the payment-feature GL accounts. Accounting must be initialized. */
export async function ensurePaymentGlAccount(tenantId: string, key: PaymentGlKey): Promise<string> {
  const settings = await prisma.accountingSettings.findUnique({ where: { tenantId } })
  if (!settings?.initializedAt) throw new AppError('Accounting is not initialized', 400)
  const map = { ...((settings.defaultAccounts ?? {}) as Record<string, unknown>) }
  const mapped = typeof map[key] === 'string' ? (map[key] as string) : ''
  if (mapped) {
    const exists = await prisma.glAccount.findFirst({ where: { id: mapped, tenantId }, select: { id: true } })
    if (exists) return mapped
  }

  const def = PAYMENT_GL_DEFS[key]
  let accountId: string | null = null
  for (let i = 0; i < 20 && !accountId; i++) {
    const code = String(Number(def.code) + i)
    const existing = await prisma.glAccount.findUnique({ where: { tenantId_code: { tenantId, code } } })
    if (existing) {
      if (existing.name === def.name && existing.type === def.type) accountId = existing.id
      continue
    }
    const created = await prisma.glAccount.create({
      data: { tenantId, code, name: def.name, type: def.type, subtype: def.subtype, isSystem: true },
    })
    accountId = created.id
  }
  if (!accountId) throw new AppError(`Could not allocate GL account for ${def.name}`, 500)

  map[key] = accountId
  await prisma.accountingSettings.update({ where: { tenantId }, data: { defaultAccounts: map as any } })
  return accountId
}

/** Default clearing account when the method config does not pick one (dedicated, never 1110/1120). */
export async function defaultClearingGlAccountId(tenantId: string): Promise<string> {
  return ensurePaymentGlAccount(tenantId, 'paymentClearing')
}

type ClearingPayment = {
  id?: string
  method: PaymentMethod
  clearanceStatus?: string | null
  clearanceGlAccountId?: string | null
}

async function isUsableClearingAccount(tenantId: string, glAccountId: string) {
  const acc = await prisma.glAccount.findFirst({
    where: { id: glAccountId, tenantId, isActive: true, type: 'ASSET' },
    select: { id: true },
  })
  if (!acc) return false
  if ((await legacyBulkClearingIds(tenantId)).has(glAccountId)) return false
  const [cash, bank] = await Promise.all([
    prisma.cashAccount.findFirst({ where: { tenantId, glAccountId }, select: { id: true } }),
    prisma.bankAccount.findFirst({ where: { tenantId, glAccountId }, select: { id: true } }),
  ])
  return !cash && !bank
}

/**
 * GL account debited for a sale payment. Payments that need clearance are parked in their
 * snapshot clearing account (never Main Cash/Bank); everything else keeps the legacy mapping.
 */
export async function resolveSalePaymentDebitAccount(
  tenantId: string,
  branchId: string,
  payment: ClearingPayment,
): Promise<string> {
  if (payment.clearanceStatus && payment.clearanceStatus !== 'NOT_REQUIRED') {
    if (payment.clearanceGlAccountId && await isUsableClearingAccount(tenantId, payment.clearanceGlAccountId)) {
      return payment.clearanceGlAccountId
    }
    return defaultClearingGlAccountId(tenantId)
  }
  return resolvePaymentGlAccountId(tenantId, branchId, payment.method)
}

/**
 * The clearing account that actually holds this payment: read from the posted sale journal
 * (so later Settings changes can't redirect the credit). Null if the journal has no line for it.
 */
export async function postedClearingAccountForPayment(tenantId: string, saleId: string, salePaymentId: string): Promise<string | null> {
  const link = await prisma.integrationLink.findUnique({
    where: { tenantId_sourceType_sourceId_eventType: { tenantId, sourceType: 'Sale', sourceId: saleId, eventType: 'SALE_CREATED' } },
    select: { journalEntryId: true },
  })
  if (!link) return null
  const lines = await prisma.journalLine.findMany({
    where: { entryId: link.journalEntryId, tenantId, debit: { gt: 0 } },
    select: { accountId: true, metadata: true },
  })
  const hit = lines.find(l => (l.metadata as Record<string, unknown> | null)?.salePaymentId === salePaymentId)
  return hit?.accountId ?? null
}

/** Validate a clearing account chosen in Settings. */
export async function assertClearingAccountAllowed(tenantId: string, glAccountId: string) {
  if (!(await isUsableClearingAccount(tenantId, glAccountId))) {
    throw new AppError('Clearance account must be an active asset account that is not a Cash/Bank register or the Card/UPI bulk clearing account', 400)
  }
}

/** Customer fee income journal (only for sales with customerFeeTotal > 0). */
export async function postPaymentFeeJournal(tenantId: string, saleId: string, actorEmail?: string) {
  const sale = await prisma.sale.findFirst({ where: { id: saleId, tenantId }, include: { payments: true } })
  if (!sale) throw new AppError('Sale not found', 404)
  if (!sale.branchId) throw new AppError('Sale branchId is required for accounting', 400)

  const lines: JournalDraftLine[] = []
  let feeTotal = 0
  for (const p of sale.payments) {
    const fee = round2(Math.max(0, Number(p.customerFeeAmount ?? 0)))
    if (fee <= 0 || p.method === 'CREDIT' || p.method === 'STORE_CREDIT') continue
    // Fee must land in the same account the sale journal debited for this payment.
    const accountId = await postedClearingAccountForPayment(tenantId, sale.id, p.id)
      ?? await resolveSalePaymentDebitAccount(tenantId, sale.branchId, p)
    lines.push({
      accountId,
      debit: fee,
      credit: 0,
      description: `Payment fee ${p.methodLabel ?? p.method}`,
      metadata: { saleId: sale.id, salePaymentId: p.id, invoiceNumber: sale.invoiceNumber },
    })
    feeTotal = round2(feeTotal + fee)
  }
  if (feeTotal <= 0) return null
  lines.push({
    accountId: await ensurePaymentGlAccount(tenantId, 'paymentFeeIncome'),
    debit: 0,
    credit: feeTotal,
    description: 'Payment surcharge income',
    metadata: { saleId: sale.id, invoiceNumber: sale.invoiceNumber },
  })

  const je = await createPostedJournalEntry({
    tenantId,
    branchId: sale.branchId,
    entryDate: sale.createdAt,
    sourceModule: 'SALES',
    sourceRefType: 'Sale',
    sourceRefId: sale.id,
    sourceEvent: 'PAYMENT_FEE_COLLECTED',
    memo: `Payment fee ${sale.invoiceNumber}`,
    createdByEmail: actorEmail ?? sale.cashierName,
    lines,
  })
  await prisma.integrationLink.create({
    data: { tenantId, sourceType: 'Sale', sourceId: sale.id, eventType: 'PAYMENT_FEE_COLLECTED', journalEntryId: je.id },
  })
  return je
}

export async function resolveClearanceDestinationGl(
  tenantId: string,
  destinationType: 'CASH' | 'BANK',
  destinationId: string,
): Promise<string> {
  if (destinationType === 'CASH') {
    const cash = await prisma.cashAccount.findFirst({ where: { id: destinationId, tenantId, isActive: true } })
    if (!cash) throw new AppError('Cash account not found', 404)
    return cash.glAccountId
  }
  const bank = await prisma.bankAccount.findFirst({ where: { id: destinationId, tenantId, isActive: true } })
  if (!bank) throw new AppError('Bank account not found', 404)
  return bank.glAccountId
}

/** Dr destination (net) + Dr provider charges (deduction) / Cr clearing (gross). */
export async function postPaymentClearanceJournal(opts: {
  tenantId: string
  branchId: string | null
  clearanceId: string
  clearingGlAccountId: string
  destinationGlAccountId: string
  grossAmount: number
  providerDeduction: number
  netAmount: number
  clearedAt: Date
  invoiceNumber: string
  methodLabel: string
  reference?: string | null
  actorEmail?: string
}) {
  const lines: JournalDraftLine[] = []
  if (opts.netAmount > 0) {
    lines.push({ accountId: opts.destinationGlAccountId, debit: round2(opts.netAmount), credit: 0, description: `Settlement ${opts.methodLabel} ${opts.invoiceNumber}`, metadata: { reference: opts.reference ?? null } })
  }
  if (opts.providerDeduction > 0) {
    lines.push({ accountId: await ensurePaymentGlAccount(opts.tenantId, 'paymentProviderFees'), debit: round2(opts.providerDeduction), credit: 0, description: `Provider charges ${opts.methodLabel} ${opts.invoiceNumber}` })
  }
  lines.push({ accountId: opts.clearingGlAccountId, debit: 0, credit: round2(opts.grossAmount), description: `Clear ${opts.methodLabel} ${opts.invoiceNumber}` })

  return createPostedJournalEntry({
    tenantId: opts.tenantId,
    branchId: opts.branchId,
    entryDate: opts.clearedAt,
    sourceModule: 'CASH_BANK',
    sourceRefType: 'PaymentClearance',
    sourceRefId: opts.clearanceId,
    sourceEvent: 'CLEARED',
    memo: `Payment cleared ${opts.methodLabel} — ${opts.invoiceNumber}${opts.reference ? ` (${opts.reference})` : ''}`,
    createdByEmail: opts.actorEmail,
    lines,
  })
}

export async function reversePaymentClearanceJournal(tenantId: string, journalEntryId: string, clearanceId: string, actorEmail?: string) {
  const original = await prisma.journalEntry.findFirst({
    where: { id: journalEntryId, tenantId, status: 'POSTED' },
    include: { lines: { orderBy: { lineNo: 'asc' } } },
  })
  if (!original) return null
  const already = await prisma.journalEntry.findFirst({ where: { tenantId, reversalOfId: original.id, status: 'POSTED' }, select: { id: true } })
  if (already) return already
  return createPostedJournalEntry({
    tenantId,
    branchId: original.branchId,
    sourceModule: 'CASH_BANK',
    sourceRefType: 'PaymentClearance',
    sourceRefId: `${clearanceId}:${randomUUID().slice(0, 8)}`,
    sourceEvent: 'CLEARANCE_REVERSED',
    memo: `Reversal of ${original.entryNo} — payment clearance reversed`,
    createdByEmail: actorEmail,
    reversalOfId: original.id,
    lines: original.lines.map(l => ({
      accountId: l.accountId,
      debit: round2(Number(l.credit)),
      credit: round2(Number(l.debit)),
      description: `Reversal: ${l.description ?? ''}`.trim(),
    })),
  })
}
