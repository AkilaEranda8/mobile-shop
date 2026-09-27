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

/** GL account "<Label> Clearing" for one payment method (created on first use, reused by name). */
export async function ensureMethodClearingAccount(tenantId: string, label: string): Promise<string> {
  const legacy = [...await legacyBulkClearingIds(tenantId)]
  let name = `${label.trim().slice(0, 40) || 'Payment'} Clearing`
  const clash = await prisma.glAccount.findFirst({ where: { tenantId, name, id: { in: legacy } }, select: { id: true } })
  if (clash) name = `${label.trim().slice(0, 40)} Payment Clearing`
  const existing = await prisma.glAccount.findFirst({
    where: { tenantId, name, type: 'ASSET', id: { notIn: legacy } },
    select: { id: true, isActive: true },
  })
  if (existing) {
    if (!existing.isActive) await prisma.glAccount.update({ where: { id: existing.id }, data: { isActive: true } })
    return existing.id
  }
  for (let n = 1131; n < 1200; n++) {
    const code = String(n)
    const taken = await prisma.glAccount.findUnique({ where: { tenantId_code: { tenantId, code } }, select: { id: true } })
    if (taken) continue
    const created = await prisma.glAccount.create({
      data: { tenantId, code, name, type: 'ASSET', subtype: 'BANK', isSystem: false, description: 'Payment method clearing (pending settlement)' },
    })
    return created.id
  }
  throw new AppError('No free GL code for the clearing account (1131–1199)', 500)
}

/**
 * Give every clearance-enabled method its own clearing account. Returns the settings with
 * `clearance.glAccountId` filled in. No-op (unchanged settings) when accounting is not initialized.
 */
export async function withMethodClearingAccounts<T extends { methods: Array<{ key: string; label: string; clearance?: { required: boolean; glAccountId?: string } }> }>(
  tenantId: string,
  settings: T,
): Promise<{ settings: T; changed: boolean }> {
  const acc = await prisma.accountingSettings.findUnique({ where: { tenantId }, select: { initializedAt: true } })
  if (!acc?.initializedAt) return { settings, changed: false }
  let changed = false
  const methods = []
  for (const m of settings.methods) {
    if (m.key !== 'CASH' && m.clearance?.required && !m.clearance.glAccountId) {
      methods.push({ ...m, clearance: { ...m.clearance, glAccountId: await ensureMethodClearingAccount(tenantId, m.label) } })
      changed = true
    } else {
      methods.push(m)
    }
  }
  return { settings: { ...settings, methods }, changed }
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
  const moved = await prisma.integrationLink.findUnique({
    where: { tenantId_sourceType_sourceId_eventType: { tenantId, sourceType: 'SalePayment', sourceId: salePaymentId, eventType: 'CLEARING_RECLASSED' } },
    select: { journalEntryId: true },
  })
  if (moved) {
    const line = await prisma.journalLine.findFirst({
      where: { entryId: moved.journalEntryId, tenantId, debit: { gt: 0 } },
      select: { accountId: true },
    })
    if (line) return line.accountId
  }
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

/**
 * Pending payments that were posted to the shared "Pending Payment Clearance" account (because the
 * method had no own account yet) are moved once to the method's clearing account:
 * Dr method clearing / Cr pending clearance (sale amount + customer fee). Idempotent per payment.
 */
export async function moveDefaultPendingToMethodAccounts(
  tenantId: string,
  methods: Array<{ id: string; clearance?: { required: boolean; glAccountId?: string } }>,
  actorEmail?: string,
): Promise<number> {
  const settings = await prisma.accountingSettings.findUnique({ where: { tenantId }, select: { defaultAccounts: true, initializedAt: true } })
  const defaultGl = ((settings?.defaultAccounts ?? {}) as Record<string, unknown>).paymentClearing
  if (!settings?.initializedAt || typeof defaultGl !== 'string') return 0

  const targetByConfig = new Map<string, string>()
  for (const m of methods) {
    const gl = m.clearance?.required ? m.clearance.glAccountId : undefined
    if (gl && gl !== defaultGl) targetByConfig.set(m.id, gl)
  }
  if (!targetByConfig.size) return 0

  const pending = await prisma.salePayment.findMany({
    where: { clearanceStatus: 'PENDING', methodConfigId: { in: [...targetByConfig.keys()] }, sale: { tenantId } },
    select: {
      id: true, amount: true, customerFeeAmount: true, methodConfigId: true, methodLabel: true, method: true,
      sale: { select: { id: true, branchId: true, invoiceNumber: true } },
    },
  })

  let moved = 0
  for (const p of pending) {
    const target = targetByConfig.get(p.methodConfigId!)!
    const already = await prisma.integrationLink.findUnique({
      where: { tenantId_sourceType_sourceId_eventType: { tenantId, sourceType: 'SalePayment', sourceId: p.id, eventType: 'CLEARING_RECLASSED' } },
      select: { id: true },
    })
    if (already) continue
    const posted = await postedClearingAccountForPayment(tenantId, p.sale.id, p.id)
    if (posted !== defaultGl) continue
    const fee = round2(Number(p.customerFeeAmount ?? 0))
    if (fee > 0) {
      const feeLink = await prisma.integrationLink.findUnique({
        where: { tenantId_sourceType_sourceId_eventType: { tenantId, sourceType: 'Sale', sourceId: p.sale.id, eventType: 'PAYMENT_FEE_COLLECTED' } },
        select: { id: true },
      })
      if (!feeLink) continue
    }
    const gross = round2(Number(p.amount) + fee)
    if (gross <= 0) continue
    const label = p.methodLabel ?? p.method
    const meta = { saleId: p.sale.id, salePaymentId: p.id, invoiceNumber: p.sale.invoiceNumber }
    const previous = await prisma.salePayment.findUnique({ where: { id: p.id }, select: { clearanceGlAccountId: true } })
    const claim = await prisma.salePayment.updateMany({
      where: {
        id: p.id,
        clearanceStatus: 'PENDING',
        OR: [{ clearanceGlAccountId: null }, { clearanceGlAccountId: { not: target } }],
      },
      data: { clearanceGlAccountId: target },
    })
    if (claim.count === 0) continue
    try {
      const je = await createPostedJournalEntry({
        tenantId,
        branchId: p.sale.branchId,
        entryDate: new Date(),
        sourceModule: 'CASH_BANK',
        sourceRefType: 'SalePayment',
        sourceRefId: p.id,
        sourceEvent: 'CLEARING_RECLASSED',
        memo: `Move ${label} ${p.sale.invoiceNumber} to ${label} clearing`,
        createdByEmail: actorEmail ?? 'system',
        lines: [
          { accountId: target, debit: gross, credit: 0, description: `${label} clearing ${p.sale.invoiceNumber}`, metadata: meta },
          { accountId: defaultGl, debit: 0, credit: gross, description: `Pending clearance ${p.sale.invoiceNumber}`, metadata: meta },
        ],
      })
      await prisma.integrationLink.create({
        data: { tenantId, sourceType: 'SalePayment', sourceId: p.id, eventType: 'CLEARING_RECLASSED', journalEntryId: je.id },
      })
      moved++
    } catch (e) {
      await prisma.salePayment.update({ where: { id: p.id }, data: { clearanceGlAccountId: previous?.clearanceGlAccountId ?? null } }).catch(() => {})
      console.warn(`[payment-clearance] could not move ${p.id} to method clearing:`, e instanceof Error ? e.message : e)
    }
  }
  return moved
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
