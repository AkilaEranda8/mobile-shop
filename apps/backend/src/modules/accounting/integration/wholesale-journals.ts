import { prisma } from '../../../config/database'
import { AppError } from '../../../middleware/error.middleware'
import { createPostedJournalEntry } from '../journals/journal-create.service'
import type { JournalDraftLine } from '../journals/journal-validator.util'
import { resolvePaymentGlAccountId } from '../subledgers/ar-ap-payment.service'
import { requireAccountingInitialized } from '../accounting-init.service'
import { isMobileProduct, round2 } from './inventory-cogs.util'
import {
  readDealerPaymentForAccounting,
  readWholesaleCreditNoteForAccounting,
  readWholesaleInvoiceForAccounting,
} from './source-readers/wholesale-invoice.reader'

async function resolveAccountIdByKey(tenantId: string, key: string) {
  const settings = await requireAccountingInitialized(tenantId)
  const map = (settings.defaultAccounts ?? {}) as Record<string, unknown>
  const val = map[key]
  if (typeof val === 'string' && val) return val
  throw new AppError(`Missing accounting account mapping: ${key}`, 400)
}

export async function postWholesaleInvoiceJournal(tenantId: string, invoiceId: string, actorEmail?: string) {
  const inv = await readWholesaleInvoiceForAccounting(tenantId, invoiceId)
  if (!inv) throw new AppError('Wholesale invoice not found', 404)

  const revenue = round2(Math.max(0, Number(inv.subtotal) - Number(inv.discount ?? 0)))
  const vat = round2(Math.max(0, Number(inv.tax ?? 0)))
  const lines: JournalDraftLine[] = []

  for (const p of inv.payments) {
    const amt = round2(Math.max(0, Number(p.amount ?? 0)))
    if (amt <= 0 || p.method === 'CREDIT') continue
    const accountId = await resolvePaymentGlAccountId(tenantId, inv.fulfillmentBranchId, p.method)
    lines.push({
      accountId,
      debit: amt,
      credit: 0,
      description: `Wholesale receipt ${p.method}`,
      metadata: {
        paymentMethod: p.method,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        channel: inv.channel,
        reference: p.reference ?? null,
      },
    })
  }

  const creditAr = round2(
    inv.payments
      .filter((p) => p.method === 'CREDIT')
      .reduce((s, p) => s + Math.max(0, Number(p.amount ?? 0)), 0),
  )
  const due = round2(Math.max(0, Number(inv.dueAmount ?? 0)))
  const arDebit = creditAr > 0 ? creditAr : due
  if (arDebit > 0) {
    lines.push({
      accountId: await resolveAccountIdByKey(tenantId, 'ar'),
      debit: arDebit,
      credit: 0,
      description: 'Wholesale AR',
      metadata: {
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        dealerId: inv.dealerId,
        channel: inv.channel,
      },
    })
  }

  let mobileRev = 0
  let accessoryRev = 0
  for (const line of inv.lines) {
    const amt = round2(Math.max(0, Number(line.total ?? 0)))
    if (amt <= 0) continue
    if (line.product && isMobileProduct(line.product)) mobileRev += amt
    else accessoryRev += amt
  }
  const lineSum = round2(mobileRev + accessoryRev)
  if (lineSum > 0 && revenue > 0 && Math.abs(lineSum - revenue) > 0.01) {
    const scale = revenue / lineSum
    mobileRev = round2(mobileRev * scale)
    accessoryRev = round2(revenue - mobileRev)
  } else if (lineSum <= 0 && revenue > 0) {
    accessoryRev = revenue
  }

  if (mobileRev > 0) {
    lines.push({
      accountId: await resolveAccountIdByKey(tenantId, 'salesMobile'),
      debit: 0,
      credit: mobileRev,
      description: 'Wholesale revenue — Mobile',
    })
  }
  if (accessoryRev > 0) {
    lines.push({
      accountId: await resolveAccountIdByKey(tenantId, 'salesAccessory'),
      debit: 0,
      credit: accessoryRev,
      description: 'Wholesale revenue — Accessories',
    })
  }
  if (vat > 0) {
    lines.push({
      accountId: await resolveAccountIdByKey(tenantId, 'vatOutput'),
      debit: 0,
      credit: vat,
      description: 'VAT Output',
    })
  }

  const je = await createPostedJournalEntry({
    tenantId,
    branchId: inv.fulfillmentBranchId,
    entryDate: inv.postedAt ?? inv.createdAt,
    sourceModule: 'WHOLESALE',
    sourceRefType: 'WholesaleInvoice',
    sourceRefId: inv.id,
    sourceEvent: 'WHOLESALE_INVOICE_CREATED',
    memo: `Wholesale ${inv.channel} ${inv.invoiceNumber}`,
    createdByEmail: actorEmail,
    lines,
  })

  await prisma.integrationLink.create({
    data: {
      tenantId,
      sourceType: 'WholesaleInvoice',
      sourceId: inv.id,
      eventType: 'WHOLESALE_INVOICE_CREATED',
      journalEntryId: je.id,
    },
  })

  return je
}

export async function postWholesaleInvoiceCogsJournal(tenantId: string, invoiceId: string, actorEmail?: string) {
  const inv = await readWholesaleInvoiceForAccounting(tenantId, invoiceId)
  if (!inv) throw new AppError('Wholesale invoice not found', 404)

  let mobileCost = 0
  let accessoryCost = 0
  for (const line of inv.lines) {
    const qty = Number(line.stockQty ?? line.quantity ?? 0)
    const cost = round2(Math.max(0, Number(line.unitCost ?? 0) * qty))
    if (cost <= 0) continue
    if (line.product && isMobileProduct(line.product)) mobileCost = round2(mobileCost + cost)
    else accessoryCost = round2(accessoryCost + cost)
  }
  const totalCogs = round2(mobileCost + accessoryCost)

  if (totalCogs <= 0) {
    const revLink = await prisma.integrationLink.findUnique({
      where: {
        tenantId_sourceType_sourceId_eventType: {
          tenantId,
          sourceType: 'WholesaleInvoice',
          sourceId: inv.id,
          eventType: 'WHOLESALE_INVOICE_CREATED',
        },
      },
    })
    if (!revLink) throw new AppError('Wholesale revenue journal not posted yet', 409)
    await prisma.integrationLink.upsert({
      where: {
        tenantId_sourceType_sourceId_eventType: {
          tenantId,
          sourceType: 'WholesaleInvoice',
          sourceId: inv.id,
          eventType: 'WHOLESALE_INVOICE_COGS',
        },
      },
      create: {
        tenantId,
        sourceType: 'WholesaleInvoice',
        sourceId: inv.id,
        eventType: 'WHOLESALE_INVOICE_COGS',
        journalEntryId: revLink.journalEntryId,
      },
      update: {},
    })
    return null
  }

  const lines: JournalDraftLine[] = []
  if (mobileCost > 0) {
    lines.push({
      accountId: await resolveAccountIdByKey(tenantId, 'cogsMobile'),
      debit: mobileCost,
      credit: 0,
      description: 'Wholesale COGS — Mobile',
    })
    lines.push({
      accountId: await resolveAccountIdByKey(tenantId, 'inventoryMobile'),
      debit: 0,
      credit: mobileCost,
      description: 'Inventory — Mobile',
    })
  }
  if (accessoryCost > 0) {
    lines.push({
      accountId: await resolveAccountIdByKey(tenantId, 'cogsAccessory'),
      debit: accessoryCost,
      credit: 0,
      description: 'Wholesale COGS — Accessories',
    })
    lines.push({
      accountId: await resolveAccountIdByKey(tenantId, 'inventoryAccessory'),
      debit: 0,
      credit: accessoryCost,
      description: 'Inventory — Accessories',
    })
  }

  const je = await createPostedJournalEntry({
    tenantId,
    branchId: inv.fulfillmentBranchId,
    entryDate: inv.postedAt ?? inv.createdAt,
    sourceModule: 'WHOLESALE',
    sourceRefType: 'WholesaleInvoice',
    sourceRefId: inv.id,
    sourceEvent: 'WHOLESALE_INVOICE_COGS',
    memo: `Wholesale COGS ${inv.invoiceNumber}`,
    createdByEmail: actorEmail,
    lines,
  })

  await prisma.integrationLink.create({
    data: {
      tenantId,
      sourceType: 'WholesaleInvoice',
      sourceId: inv.id,
      eventType: 'WHOLESALE_INVOICE_COGS',
      journalEntryId: je.id,
    },
  })

  return je
}

export async function postWholesaleCreditNoteJournal(tenantId: string, creditNoteId: string, actorEmail?: string) {
  const cn = await readWholesaleCreditNoteForAccounting(tenantId, creditNoteId)
  if (!cn) throw new AppError('Wholesale credit note not found', 404)
  const total = round2(Math.max(0, Number(cn.total ?? 0)))
  if (total <= 0) throw new AppError('Credit note total must be positive', 400)

  const branchId = cn.branchId
  if (!branchId) throw new AppError('Credit note branchId required for accounting', 400)

  const lines: JournalDraftLine[] = [
    {
      accountId: await resolveAccountIdByKey(tenantId, 'salesAccessory'),
      debit: total,
      credit: 0,
      description: 'Wholesale credit note',
    },
    {
      accountId: await resolveAccountIdByKey(tenantId, 'ar'),
      debit: 0,
      credit: total,
      description: 'AR credit',
      metadata: { creditNoteId: cn.id, dealerId: cn.dealerId },
    },
  ]

  const je = await createPostedJournalEntry({
    tenantId,
    branchId,
    entryDate: cn.postedAt ?? cn.createdAt,
    sourceModule: 'WHOLESALE',
    sourceRefType: 'WholesaleCreditNote',
    sourceRefId: cn.id,
    sourceEvent: 'WHOLESALE_CREDIT_NOTE_CREATED',
    memo: `Wholesale CN ${cn.creditNoteNumber}`,
    createdByEmail: actorEmail,
    lines,
  })

  await prisma.integrationLink.create({
    data: {
      tenantId,
      sourceType: 'WholesaleCreditNote',
      sourceId: cn.id,
      eventType: 'WHOLESALE_CREDIT_NOTE_CREATED',
      journalEntryId: je.id,
    },
  })

  return je
}

export async function postWholesaleReceiptJournal(tenantId: string, paymentId: string, actorEmail?: string) {
  const payment = await readDealerPaymentForAccounting(tenantId, paymentId)
  if (!payment) throw new AppError('Dealer payment not found', 404)
  if (payment.method === 'CREDIT') throw new AppError('CREDIT is not a receipt', 400)

  const amount = round2(Math.max(0, Number(payment.amount)))
  if (amount <= 0) throw new AppError('Payment amount must be positive', 400)

  const branchId = payment.branchId
  if (!branchId) throw new AppError('Dealer payment branchId required for accounting', 400)

  const cashAccountId = await resolvePaymentGlAccountId(tenantId, branchId, payment.method)
  const arAccountId = await resolveAccountIdByKey(tenantId, 'ar')

  const lines: JournalDraftLine[] = [
    {
      accountId: cashAccountId,
      debit: amount,
      credit: 0,
      description: `Dealer receipt ${payment.method}`,
      metadata: { receiptNumber: payment.receiptNumber, dealerId: payment.dealerId },
    },
    {
      accountId: arAccountId,
      debit: 0,
      credit: amount,
      description: 'Wholesale AR payment',
      metadata: { receiptNumber: payment.receiptNumber, dealerId: payment.dealerId },
    },
  ]

  const je = await createPostedJournalEntry({
    tenantId,
    branchId,
    entryDate: payment.paidAt,
    sourceModule: 'WHOLESALE',
    sourceRefType: 'DealerPayment',
    sourceRefId: payment.id,
    sourceEvent: 'WHOLESALE_RECEIPT',
    memo: `Dealer receipt ${payment.receiptNumber}`,
    createdByEmail: actorEmail,
    lines,
  })

  await prisma.integrationLink.create({
    data: {
      tenantId,
      sourceType: 'DealerPayment',
      sourceId: payment.id,
      eventType: 'WHOLESALE_RECEIPT',
      journalEntryId: je.id,
    },
  })

  return je
}
