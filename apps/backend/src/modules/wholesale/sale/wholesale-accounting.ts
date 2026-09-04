/**
 * Wholesale invoice / credit-note / receipt accounting emit → outbox → WHOLESALE journals.
 */
import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database'
import { emitAccountingEvents } from '../../accounting/integration/accounting-events.service'

export type WholesaleAccountingEmitInput = {
  tenantId: string
  branchId: string
  invoiceId: string
  invoiceNumber: string
  total: number
  paidAmount: number
  dueAmount: number
  channel: string
  actorEmail?: string
}

export type WholesaleCreditNoteAccountingInput = {
  tenantId: string
  branchId: string | null
  creditNoteId: string
  creditNoteNumber: string
  total: number
  actorEmail?: string
}

export type WholesaleReceiptAccountingInput = {
  tenantId: string
  branchId: string | null
  paymentId: string
  receiptNumber: string
  amount: number
  method: string
  dealerId: string
  actorEmail?: string
}

async function auditBestEffort(data: {
  tenantId: string
  branchId?: string | null
  actorEmail?: string
  eventType: string
  entityType: string
  entityId: string
  afterJson: Record<string, unknown>
}) {
  try {
    await prisma.auditEvent.create({
      data: {
        tenantId: data.tenantId,
        branchId: data.branchId || null,
        actorEmail: data.actorEmail || 'system',
        eventType: data.eventType,
        entityType: data.entityType,
        entityId: data.entityId,
        afterJson: data.afterJson as Prisma.InputJsonValue,
      },
    })
  } catch {
    // best-effort
  }
}

export async function emitWholesaleInvoiceAccounting(input: WholesaleAccountingEmitInput) {
  const result = await emitAccountingEvents(
    [
      {
        tenantId: input.tenantId,
        branchId: input.branchId,
        sourceType: 'WholesaleInvoice',
        sourceId: input.invoiceId,
        eventType: 'WHOLESALE_INVOICE_CREATED',
        payload: {
          invoiceNumber: input.invoiceNumber,
          total: input.total,
          paidAmount: input.paidAmount,
          dueAmount: input.dueAmount,
          channel: input.channel,
          journalSourceHint: 'WHOLESALE',
        },
      },
      {
        tenantId: input.tenantId,
        branchId: input.branchId,
        sourceType: 'WholesaleInvoice',
        sourceId: input.invoiceId,
        eventType: 'WHOLESALE_INVOICE_COGS',
        payload: {
          invoiceNumber: input.invoiceNumber,
          channel: input.channel,
          journalSourceHint: 'WHOLESALE',
        },
      },
    ],
    input.actorEmail,
  )

  if (result.skipped || result.error || result.failed) {
    console.info(
      '[wholesale-accounting]',
      input.invoiceNumber,
      result.reason || result.error || `failed=${result.failed}`,
    )
    await auditBestEffort({
      tenantId: input.tenantId,
      branchId: input.branchId,
      actorEmail: input.actorEmail,
      eventType: 'WHOLESALE_ACCOUNTING_EMIT',
      entityType: 'WholesaleInvoice',
      entityId: input.invoiceId,
      afterJson: {
        invoiceNumber: input.invoiceNumber,
        total: input.total,
        channel: input.channel,
        accounting: result,
      },
    })
  }

  return result
}

export async function emitWholesaleCreditNoteAccounting(input: WholesaleCreditNoteAccountingInput) {
  const result = await emitAccountingEvents(
    [
      {
        tenantId: input.tenantId,
        branchId: input.branchId,
        sourceType: 'WholesaleCreditNote',
        sourceId: input.creditNoteId,
        eventType: 'WHOLESALE_CREDIT_NOTE_CREATED',
        payload: {
          creditNoteNumber: input.creditNoteNumber,
          total: input.total,
          journalSourceHint: 'WHOLESALE',
        },
      },
    ],
    input.actorEmail,
  )

  if (result.skipped || result.error || result.failed) {
    console.info(
      '[wholesale-accounting]',
      input.creditNoteNumber,
      result.reason || result.error || `failed=${result.failed}`,
    )
    await auditBestEffort({
      tenantId: input.tenantId,
      branchId: input.branchId,
      actorEmail: input.actorEmail,
      eventType: 'WHOLESALE_CREDIT_NOTE_ACCOUNTING_EMIT',
      entityType: 'WholesaleCreditNote',
      entityId: input.creditNoteId,
      afterJson: {
        creditNoteNumber: input.creditNoteNumber,
        total: input.total,
        accounting: result,
      },
    })
  }

  return result
}

export async function emitWholesaleReceiptAccounting(input: WholesaleReceiptAccountingInput) {
  if (!input.branchId) {
    await auditBestEffort({
      tenantId: input.tenantId,
      actorEmail: input.actorEmail,
      eventType: 'WHOLESALE_RECEIPT_SKIPPED',
      entityType: 'DealerPayment',
      entityId: input.paymentId,
      afterJson: { reason: 'missing_branchId', receiptNumber: input.receiptNumber },
    })
    return { skipped: true, reason: 'missing_branchId' }
  }

  const result = await emitAccountingEvents(
    [
      {
        tenantId: input.tenantId,
        branchId: input.branchId,
        sourceType: 'DealerPayment',
        sourceId: input.paymentId,
        eventType: 'WHOLESALE_RECEIPT',
        payload: {
          receiptNumber: input.receiptNumber,
          amount: input.amount,
          method: input.method,
          dealerId: input.dealerId,
          journalSourceHint: 'WHOLESALE',
        },
      },
    ],
    input.actorEmail,
  )

  if (result.skipped || result.error || result.failed) {
    await auditBestEffort({
      tenantId: input.tenantId,
      branchId: input.branchId,
      actorEmail: input.actorEmail,
      eventType: 'WHOLESALE_RECEIPT_ACCOUNTING_EMIT',
      entityType: 'DealerPayment',
      entityId: input.paymentId,
      afterJson: { receiptNumber: input.receiptNumber, amount: input.amount, accounting: result },
    })
  }

  return result
}
