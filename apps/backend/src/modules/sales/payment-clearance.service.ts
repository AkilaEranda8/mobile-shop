import { randomUUID } from 'crypto'
import type { Request } from 'express'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { assertBranchRecordAccess } from '../../utils/active-branch'
import { verifyTenantAdminPassword } from '../../utils/admin-password.util'
import {
  listLegacyBulkClearingIds,
  paymentAccountingActive,
  postedClearingAccountForPayment,
  postPaymentClearanceJournal,
  resolveClearanceDestinationGl,
  resolveSalePaymentDebitAccount,
  reversePaymentClearanceJournal,
} from '../accounting/integration/payment-fee-journals'

function round2(n: number) {
  return Math.round(n * 100) / 100
}

async function loadPayment(tenantId: string, saleId: string, paymentId: string, req: Request) {
  const payment = await prisma.salePayment.findFirst({
    where: { id: paymentId, saleId, sale: { tenantId } },
    include: { sale: { select: { id: true, branchId: true, invoiceNumber: true, status: true } } },
  })
  if (!payment) throw new AppError('Payment not found', 404)
  assertBranchRecordAccess(req, payment.sale.branchId)
  return payment
}

async function saleJournalPosted(tenantId: string, saleId: string, eventType = 'SALE_CREATED') {
  const link = await prisma.integrationLink.findUnique({
    where: { tenantId_sourceType_sourceId_eventType: { tenantId, sourceType: 'Sale', sourceId: saleId, eventType } },
    select: { id: true },
  })
  return !!link
}

export async function getPaymentClearanceOptions(tenantId: string, branchId: string | null) {
  const accountingActive = await paymentAccountingActive(tenantId, branchId)
  const [cashAccounts, bankAccounts] = await Promise.all([
    prisma.cashAccount.findMany({
      where: { tenantId, isActive: true, ...(branchId ? { branchId } : {}) },
      select: { id: true, name: true, branchId: true, glAccountId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.bankAccount.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, bankName: true, accountNo: true, glAccountId: true },
      orderBy: { name: 'asc' },
    }),
  ])
  const registerGl = new Set([...cashAccounts, ...bankAccounts].map(a => a.glAccountId))
  if (accountingActive) for (const id of await listLegacyBulkClearingIds(tenantId)) registerGl.add(id)
  const clearingAccounts = accountingActive
    ? (await prisma.glAccount.findMany({
        where: { tenantId, isActive: true, type: 'ASSET', subtype: { in: ['BANK', 'OTHER'] } },
        select: { id: true, code: true, name: true },
        orderBy: { code: 'asc' },
      })).filter(a => !registerGl.has(a.id))
    : []
  return {
    accountingActive,
    clearingAccounts,
    cashAccounts: cashAccounts.map(({ glAccountId: _g, ...a }) => a),
    bankAccounts: bankAccounts.map(({ glAccountId: _g, ...a }) => a),
  }
}

export async function listSaleClearances(tenantId: string, saleId: string, req: Request) {
  const sale = await prisma.sale.findFirst({ where: { id: saleId, tenantId }, select: { branchId: true } })
  if (!sale) throw new AppError('Sale not found', 404)
  assertBranchRecordAccess(req, sale.branchId)
  const rows = await prisma.paymentClearance.findMany({ where: { tenantId, saleId }, orderBy: { createdAt: 'desc' } })
  const cashIds = rows.filter(r => r.destinationType === 'CASH').map(r => r.destinationId)
  const bankIds = rows.filter(r => r.destinationType === 'BANK').map(r => r.destinationId)
  const [cash, bank] = await Promise.all([
    cashIds.length ? prisma.cashAccount.findMany({ where: { tenantId, id: { in: cashIds } }, select: { id: true, name: true } }) : [],
    bankIds.length ? prisma.bankAccount.findMany({ where: { tenantId, id: { in: bankIds } }, select: { id: true, name: true } }) : [],
  ])
  const names = new Map([...cash, ...bank].map(a => [a.id, a.name]))
  return rows.map(r => ({ ...r, destinationName: names.get(r.destinationId) ?? (r.destinationType === 'CASH' ? 'Cash' : 'Bank') }))
}

export async function markPaymentCleared(input: {
  tenantId: string
  saleId: string
  paymentId: string
  providerDeduction: unknown
  destinationType: unknown
  destinationId: unknown
  clearedAt: unknown
  reference: unknown
  actorEmail: string
  req: Request
}) {
  // Returned/voided sales can still be cleared: the provider settles the money regardless.
  const payment = await loadPayment(input.tenantId, input.saleId, input.paymentId, input.req)
  if (payment.clearanceStatus !== 'PENDING') throw new AppError('This payment is not pending clearance', 400)

  const gross = round2(Number(payment.amount) + Number(payment.customerFeeAmount ?? 0))
  const deduction = round2(Number(input.providerDeduction ?? 0))
  if (!Number.isFinite(deduction) || deduction < 0) throw new AppError('Provider deduction must be zero or more', 400)
  if (deduction > gross) throw new AppError('Provider deduction cannot exceed the gross amount', 400)
  const net = round2(gross - deduction)

  const destinationType = String(input.destinationType ?? '').toUpperCase()
  if (destinationType !== 'CASH' && destinationType !== 'BANK') throw new AppError('Choose Cash or Bank as the destination', 400)
  const destinationId = typeof input.destinationId === 'string' ? input.destinationId.trim() : ''

  const clearedAt = input.clearedAt ? new Date(String(input.clearedAt)) : new Date()
  if (Number.isNaN(clearedAt.getTime())) throw new AppError('Invalid settlement date', 400)
  if (clearedAt.getTime() > Date.now() + 24 * 60 * 60 * 1000) throw new AppError('Settlement date cannot be in the future', 400)

  const reference = typeof input.reference === 'string' && input.reference.trim() ? input.reference.trim().slice(0, 120) : null
  const branchId = payment.sale.branchId
  const postJournal = !!branchId
    && await paymentAccountingActive(input.tenantId, branchId)
    && await saleJournalPosted(input.tenantId, payment.saleId)

  if (postJournal && Number(payment.customerFeeAmount ?? 0) > 0
    && !(await saleJournalPosted(input.tenantId, payment.saleId, 'PAYMENT_FEE_COLLECTED'))) {
    throw new AppError('The payment fee is still being posted to accounting. Try again in a minute.', 409)
  }

  let destinationGl: string | null = null
  if (postJournal) {
    if (!destinationId) throw new AppError('Choose the cash or bank account that received the money', 400)
    destinationGl = await resolveClearanceDestinationGl(input.tenantId, destinationType as 'CASH' | 'BANK', destinationId)
  } else if (destinationId) {
    const exists = destinationType === 'CASH'
      ? await prisma.cashAccount.findFirst({ where: { id: destinationId, tenantId: input.tenantId }, select: { id: true } })
      : await prisma.bankAccount.findFirst({ where: { id: destinationId, tenantId: input.tenantId }, select: { id: true } })
    if (!exists) throw new AppError('Destination account not found', 404)
  }

  const claimed = await prisma.salePayment.updateMany({
    where: { id: payment.id, clearanceStatus: 'PENDING' },
    data: { clearanceStatus: 'CLEARED' },
  })
  if (claimed.count === 0) throw new AppError('This payment was already cleared', 409)

  const clearanceId = randomUUID()
  const methodLabel = payment.methodLabel ?? payment.method.replace(/_/g, ' ')
  let journalEntryId: string | null = null
  try {
    if (postJournal && branchId && destinationGl) {
      const clearingGl = await postedClearingAccountForPayment(input.tenantId, payment.saleId, payment.id)
        ?? await resolveSalePaymentDebitAccount(input.tenantId, branchId, payment)
      if (clearingGl === destinationGl) throw new AppError('Destination uses the same account as the clearing account', 400)
      const je = await postPaymentClearanceJournal({
        tenantId: input.tenantId,
        branchId,
        clearanceId,
        clearingGlAccountId: clearingGl,
        destinationGlAccountId: destinationGl,
        grossAmount: gross,
        providerDeduction: deduction,
        netAmount: net,
        clearedAt,
        invoiceNumber: payment.sale.invoiceNumber,
        methodLabel,
        reference,
        actorEmail: input.actorEmail,
      })
      journalEntryId = je.id
    }
    return await prisma.paymentClearance.create({
      data: {
        id: clearanceId,
        tenantId: input.tenantId,
        branchId,
        saleId: payment.saleId,
        salePaymentId: payment.id,
        invoiceNumber: payment.sale.invoiceNumber,
        methodConfigId: payment.methodConfigId,
        methodLabel: payment.methodLabel,
        grossAmount: gross,
        providerDeduction: deduction,
        netAmount: net,
        destinationType,
        destinationId: destinationId || 'UNSPECIFIED',
        clearedAt,
        reference,
        journalEntryId,
        createdBy: input.actorEmail,
      },
    })
  } catch (err) {
    await prisma.salePayment.update({ where: { id: payment.id }, data: { clearanceStatus: 'PENDING' } }).catch(() => undefined)
    if (journalEntryId) {
      await reversePaymentClearanceJournal(input.tenantId, journalEntryId, clearanceId, input.actorEmail).catch(e => {
        console.error('[payment-clearance] rollback journal reversal failed', e)
      })
    }
    throw err
  }
}

export async function reversePaymentClearance(input: {
  tenantId: string
  saleId: string
  paymentId: string
  adminPassword: unknown
  actorEmail: string
  req: Request
}) {
  await verifyTenantAdminPassword(input.tenantId, input.adminPassword)
  const payment = await loadPayment(input.tenantId, input.saleId, input.paymentId, input.req)
  if (payment.clearanceStatus !== 'CLEARED') throw new AppError('This payment is not cleared', 400)
  const clearance = await prisma.paymentClearance.findFirst({
    where: { tenantId: input.tenantId, salePaymentId: payment.id, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  })
  if (!clearance) throw new AppError('Clearance record not found', 404)

  let reversalJournalId: string | null = null
  if (clearance.journalEntryId) {
    const rev = await reversePaymentClearanceJournal(input.tenantId, clearance.journalEntryId, clearance.id, input.actorEmail)
    reversalJournalId = rev?.id ?? null
  }
  await prisma.$transaction([
    prisma.paymentClearance.update({
      where: { id: clearance.id },
      data: { status: 'REVERSED', reversedAt: new Date(), reversedBy: input.actorEmail, reversalJournalId },
    }),
    prisma.salePayment.update({ where: { id: payment.id }, data: { clearanceStatus: 'PENDING' } }),
  ])
  return { ok: true }
}

export async function listPendingClearances(tenantId: string, branchId: string | null) {
  return prisma.salePayment.findMany({
    where: {
      clearanceStatus: 'PENDING',
      sale: { tenantId, ...(branchId ? { branchId } : {}) },
    },
    select: {
      id: true, method: true, methodLabel: true, amount: true, customerFeeAmount: true, reference: true,
      sale: { select: { id: true, invoiceNumber: true, customerName: true, createdAt: true, branchId: true } },
    },
    orderBy: { sale: { createdAt: 'asc' } },
    take: 1000,
  })
}

/** Guard for void / payment edits: cleared money must be reversed through clearance first. */
export async function assertNoClearedPayments(saleId: string) {
  const cleared = await prisma.salePayment.count({ where: { saleId, clearanceStatus: 'CLEARED' } })
  if (cleared > 0) {
    throw new AppError('This sale has payments marked as cleared. Reverse the clearance in Sale Details first.', 400)
  }
}
