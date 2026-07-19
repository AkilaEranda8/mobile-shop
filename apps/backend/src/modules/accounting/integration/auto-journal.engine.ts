import { prisma } from '../../../config/database'
import { AppError } from '../../../middleware/error.middleware'
import { isReloadSaleItem } from '../../finance/reload-item.util'
import { createPostedJournalEntry } from '../journals/journal-create.service'
import type { JournalDraftLine } from '../journals/journal-validator.util'
import { readSaleForAccounting } from './source-readers/sale.reader'
import { readExpenseTransaction } from './source-readers/expense.reader'
import { readRepairForAccounting } from './source-readers/repair.reader'
import { readPurchaseForAccounting } from './source-readers/purchase.reader'
import { readDailyClosingForAccounting } from './source-readers/daily-closing.reader'
import { readSaleReturnForAccounting } from './source-readers/sale-return.reader'
import {
  buildPurchaseInventoryLines,
  buildRepairCogsLines,
  buildSaleCogsLines,
  isMobileProduct,
  round2,
} from './inventory-cogs.util'
import { requireAccountingInitialized } from '../accounting-init.service'

async function getSettingsOrThrow(tenantId: string) {
  return requireAccountingInitialized(tenantId)
}

async function resolveAccountIdByKey(tenantId: string, key: string) {
  const settings = await getSettingsOrThrow(tenantId)
  const map = (settings.defaultAccounts ?? {}) as Record<string, unknown>
  const val = map[key]
  if (typeof val === 'string' && val) return val
  throw new AppError(`Missing accounting account mapping: ${key}`, 400)
}

async function resolveBranchCashGlAccountId(tenantId: string, branchId: string) {
  const cash = await prisma.cashAccount.findFirst({
    where: { tenantId, branchId, name: 'Main Cash', isActive: true },
    select: { glAccountId: true },
  })
  if (!cash) throw new AppError('Branch cash account not configured. Initialize Accounting first.', 400)
  return cash.glAccountId
}

function sumCogsItems(items: { totalCost: number }[]) {
  return round2(items.reduce((s, i) => s + i.totalCost, 0))
}

function cogsMetadata(items: ReturnType<typeof buildSaleCogsLines>['mobile'], saleId: string, invoiceNumber: string) {
  return {
    saleId,
    invoiceNumber,
    items: items.map(i => ({
      productId: i.productId,
      productName: i.productName,
      sku: i.sku,
      imei: i.imei,
      quantity: i.quantity,
      unitCost: i.unitCost,
      totalCost: i.totalCost,
    })),
  }
}

export async function postSaleJournal(tenantId: string, saleId: string, actorEmail?: string) {
  const sale = await readSaleForAccounting(tenantId, saleId)
  if (!sale) throw new AppError('Sale not found', 404)
  if (!sale.branchId) throw new AppError('Sale branchId is required for accounting', 400)

  const revenue = round2(Math.max(0, Number(sale.subtotal) - Number(sale.discount ?? 0)))
  const vat = round2(Math.max(0, Number(sale.tax ?? 0)))

  // Debit: payment splits + AR (CREDIT rows and dueAmount must not both debit AR)
  const lines: JournalDraftLine[] = []
  for (const p of sale.payments) {
    const amt = round2(Math.max(0, Number(p.amount ?? 0)))
    if (amt <= 0 || p.method === 'CREDIT') continue
    let accountId: string
    if (p.method === 'CASH') accountId = await resolveBranchCashGlAccountId(tenantId, sale.branchId)
    else if (p.method === 'CARD') accountId = await resolveAccountIdByKey(tenantId, 'cardClearing')
    else if (p.method === 'UPI' || p.method === 'WALLET') accountId = await resolveAccountIdByKey(tenantId, 'upiClearing')
    else if (p.method === 'BANK_TRANSFER') accountId = await resolveAccountIdByKey(tenantId, 'bank')
    else accountId = await resolveBranchCashGlAccountId(tenantId, sale.branchId)
    lines.push({
      accountId,
      debit: amt,
      credit: 0,
      description: `Receipt ${p.method}`,
      metadata: { paymentMethod: p.method, saleId: sale.id, invoiceNumber: sale.invoiceNumber, reference: p.reference ?? null },
    })
  }
  const creditArAmount = round2(
    sale.payments
      .filter(p => p.method === 'CREDIT')
      .reduce((s, p) => s + Math.max(0, Number(p.amount ?? 0)), 0),
  )
  const due = round2(Math.max(0, Number(sale.dueAmount ?? 0)))
  const arDebit = creditArAmount > 0 ? creditArAmount : due
  if (arDebit > 0) {
    lines.push({
      accountId: await resolveAccountIdByKey(tenantId, 'ar'),
      debit: arDebit,
      credit: 0,
      description: 'Accounts Receivable',
      customerId: sale.customerId ?? undefined,
      metadata: { saleId: sale.id, invoiceNumber: sale.invoiceNumber },
    })
  }

  // Credit: revenue split by item type (mobile/accessory/service/reload)
  let mobileRev = 0
  let accessoryRev = 0
  let serviceRev = 0
  let reloadRev = 0
  for (const item of sale.items) {
    const amt = round2(Math.max(0, Number(item.total ?? 0)))
    if (amt <= 0) continue
    if (isReloadSaleItem(item)) {
      reloadRev += amt
      continue
    }
    if (!item.productId) serviceRev += amt
    else if (isMobileProduct(item.product)) mobileRev += amt
    else accessoryRev += amt
  }
  mobileRev = round2(mobileRev)
  accessoryRev = round2(accessoryRev)
  serviceRev = round2(serviceRev)
  reloadRev = round2(reloadRev)

  if (mobileRev + accessoryRev + serviceRev + reloadRev > 0) {
    if (mobileRev > 0) lines.push({ accountId: await resolveAccountIdByKey(tenantId, 'salesMobile'), debit: 0, credit: mobileRev, description: 'Sales Revenue — Mobile' })
    if (accessoryRev > 0) lines.push({ accountId: await resolveAccountIdByKey(tenantId, 'salesAccessory'), debit: 0, credit: accessoryRev, description: 'Sales Revenue — Accessories' })
    if (serviceRev > 0) lines.push({ accountId: await resolveAccountIdByKey(tenantId, 'serviceIncome'), debit: 0, credit: serviceRev, description: 'Service Income' })
    if (reloadRev > 0) lines.push({ accountId: await resolveAccountIdByKey(tenantId, 'reloadCommission'), debit: 0, credit: reloadRev, description: 'Reload Commission' })
  } else if (revenue > 0) {
    lines.push({ accountId: await resolveAccountIdByKey(tenantId, 'salesMobile'), debit: 0, credit: revenue, description: 'Sales Revenue' })
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
    branchId: sale.branchId,
    entryDate: sale.createdAt,
    sourceModule: 'SALES',
    sourceRefType: 'Sale',
    sourceRefId: sale.id,
    sourceEvent: 'SALE_CREATED',
    memo: `POS Sale ${sale.invoiceNumber}`,
    createdByEmail: actorEmail ?? sale.cashierName,
    lines,
  })

  await prisma.integrationLink.create({
    data: { tenantId, sourceType: 'Sale', sourceId: sale.id, eventType: 'SALE_CREATED', journalEntryId: je.id },
  })

  return je
}

export async function postSaleCogsJournal(tenantId: string, saleId: string, actorEmail?: string) {
  const sale = await readSaleForAccounting(tenantId, saleId)
  if (!sale) throw new AppError('Sale not found', 404)
  if (!sale.branchId) throw new AppError('Sale branchId is required for accounting', 400)

  const { mobile, accessory } = buildSaleCogsLines(sale.items)
  const mobileCost = sumCogsItems(mobile)
  const accessoryCost = sumCogsItems(accessory)
  const totalCogs = round2(mobileCost + accessoryCost)
  if (totalCogs <= 0) {
    const revLink = await prisma.integrationLink.findUnique({
      where: {
        tenantId_sourceType_sourceId_eventType: {
          tenantId,
          sourceType: 'Sale',
          sourceId: sale.id,
          eventType: 'SALE_CREATED',
        },
      },
    })
    if (!revLink) throw new AppError('Revenue journal not posted yet', 409)
    await prisma.integrationLink.upsert({
      where: {
        tenantId_sourceType_sourceId_eventType: {
          tenantId,
          sourceType: 'Sale',
          sourceId: sale.id,
          eventType: 'SALE_COGS',
        },
      },
      create: {
        tenantId,
        sourceType: 'Sale',
        sourceId: sale.id,
        eventType: 'SALE_COGS',
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
      description: 'COGS — Mobile',
      metadata: cogsMetadata(mobile, sale.id, sale.invoiceNumber),
    })
    lines.push({
      accountId: await resolveAccountIdByKey(tenantId, 'inventoryMobile'),
      debit: 0,
      credit: mobileCost,
      description: 'Inventory — Mobile',
      metadata: cogsMetadata(mobile, sale.id, sale.invoiceNumber),
    })
  }
  if (accessoryCost > 0) {
    lines.push({
      accountId: await resolveAccountIdByKey(tenantId, 'cogsAccessory'),
      debit: accessoryCost,
      credit: 0,
      description: 'COGS — Accessories',
      metadata: cogsMetadata(accessory, sale.id, sale.invoiceNumber),
    })
    lines.push({
      accountId: await resolveAccountIdByKey(tenantId, 'inventoryAccessory'),
      debit: 0,
      credit: accessoryCost,
      description: 'Inventory — Accessories',
      metadata: cogsMetadata(accessory, sale.id, sale.invoiceNumber),
    })
  }

  const je = await createPostedJournalEntry({
    tenantId,
    branchId: sale.branchId,
    entryDate: sale.createdAt,
    sourceModule: 'SALES',
    sourceRefType: 'Sale',
    sourceRefId: sale.id,
    sourceEvent: 'SALE_COGS',
    memo: `COGS — Sale ${sale.invoiceNumber}`,
    createdByEmail: actorEmail ?? sale.cashierName,
    lines,
  })

  await prisma.integrationLink.create({
    data: { tenantId, sourceType: 'Sale', sourceId: sale.id, eventType: 'SALE_COGS', journalEntryId: je.id },
  })

  return je
}

export async function postPurchaseJournal(tenantId: string, purchaseOrderId: string, actorEmail?: string) {
  const po = await readPurchaseForAccounting(tenantId, purchaseOrderId)
  if (!po) throw new AppError('Purchase order not found', 404)
  if (!['RECEIVED', 'CLOSED'].includes(po.status)) {
    throw new AppError('Purchase order is not received', 400)
  }

  const { mobile, accessory, parts } = buildPurchaseInventoryLines(po.items)
  const mobileVal = sumCogsItems(mobile)
  const accessoryVal = sumCogsItems(accessory)
  const partsVal = sumCogsItems(parts)
  const inventoryTotal = round2(mobileVal + accessoryVal + partsVal)
  const tax = round2(Math.max(0, Number(po.tax ?? 0)))
  const paid = round2(Math.max(0, Number(po.paidAmount ?? 0)))
  const total = round2(inventoryTotal + tax)
  const creditDue = round2(Math.max(0, total - paid))

  if (total <= 0) throw new AppError('Purchase has no value to post', 400)

  const order = po
  const imeiByProduct = new Map<string, string[]>()
  for (const rec of order.imeiRecords) {
    const list = imeiByProduct.get(rec.productId) ?? []
    list.push(rec.imei)
    imeiByProduct.set(rec.productId, list)
  }

  function purchaseMetadata(items: typeof mobile) {
    return {
      purchaseOrderId: order.id,
      poNumber: order.poNumber,
      supplierId: order.supplierId,
      supplierName: order.supplierName,
      items: items.map(i => ({
        productId: i.productId,
        productName: i.productName,
        sku: i.sku,
        quantity: i.quantity,
        unitCost: i.unitCost,
        totalCost: i.totalCost,
        imeis: imeiByProduct.get(i.productId) ?? [],
      })),
    }
  }

  const lines: JournalDraftLine[] = []
  if (mobileVal > 0) {
    lines.push({
      accountId: await resolveAccountIdByKey(tenantId, 'inventoryMobile'),
      debit: mobileVal,
      credit: 0,
      description: 'Inventory — Mobile',
      metadata: purchaseMetadata(mobile),
    })
  }
  if (accessoryVal > 0) {
    lines.push({
      accountId: await resolveAccountIdByKey(tenantId, 'inventoryAccessory'),
      debit: accessoryVal,
      credit: 0,
      description: 'Inventory — Accessories',
      metadata: purchaseMetadata(accessory),
    })
  }
  if (partsVal > 0) {
    lines.push({
      accountId: await resolveAccountIdByKey(tenantId, 'inventoryParts'),
      debit: partsVal,
      credit: 0,
      description: 'Inventory — Spare Parts',
      metadata: purchaseMetadata(parts),
    })
  }
  if (tax > 0) {
    lines.push({
      accountId: await resolveAccountIdByKey(tenantId, 'vatInput'),
      debit: tax,
      credit: 0,
      description: 'VAT Input',
      metadata: { purchaseOrderId: order.id, poNumber: order.poNumber },
    })
  }

  if (creditDue > 0) {
    lines.push({
      accountId: await resolveAccountIdByKey(tenantId, 'ap'),
      debit: 0,
      credit: creditDue,
      description: 'Accounts Payable',
      supplierId: order.supplierId,
      metadata: { poNumber: order.poNumber },
    })
  }
  if (paid > 0) {
    lines.push({
      accountId: await resolveBranchCashGlAccountId(tenantId, order.branchId),
      debit: 0,
      credit: paid,
      description: 'Cash payment',
      metadata: { poNumber: order.poNumber },
    })
  }

  const je = await createPostedJournalEntry({
    tenantId,
    branchId: order.branchId,
    entryDate: order.receivedAt ?? order.updatedAt,
    sourceModule: 'PURCHASE',
    sourceRefType: 'PurchaseOrder',
    sourceRefId: order.id,
    sourceEvent: 'PURCHASE_RECEIVED',
    memo: `PO Received ${order.poNumber}`,
    createdByEmail: actorEmail,
    lines,
  })

  await prisma.integrationLink.create({
    data: {
      tenantId,
      sourceType: 'PurchaseOrder',
      sourceId: order.id,
      eventType: 'PURCHASE_RECEIVED',
      journalEntryId: je.id,
    },
  })

  return je
}

export async function postRepairCogsJournal(tenantId: string, repairId: string, actorEmail?: string) {
  const r = await readRepairForAccounting(tenantId, repairId)
  if (!r) throw new AppError('Repair ticket not found', 404)
  if (r.status !== 'DELIVERED') throw new AppError('Repair is not delivered', 400)

  const partRows = buildRepairCogsLines(r.spareParts)
  const totalCogs = sumCogsItems(partRows)
  if (totalCogs <= 0) {
    const revLink = await prisma.integrationLink.findUnique({
      where: {
        tenantId_sourceType_sourceId_eventType: {
          tenantId,
          sourceType: 'RepairTicket',
          sourceId: r.id,
          eventType: 'REPAIR_DELIVERED',
        },
      },
    })
    if (!revLink) throw new AppError('Repair revenue journal not posted yet', 409)
    await prisma.integrationLink.upsert({
        where: {
          tenantId_sourceType_sourceId_eventType: {
            tenantId,
            sourceType: 'RepairTicket',
            sourceId: r.id,
            eventType: 'REPAIR_COGS',
          },
        },
        create: {
          tenantId,
          sourceType: 'RepairTicket',
          sourceId: r.id,
          eventType: 'REPAIR_COGS',
          journalEntryId: revLink.journalEntryId,
        },
        update: {},
      })
    return null
  }

  const metadata = {
    repairId: r.id,
    ticketNumber: r.ticketNumber,
    items: partRows.map(i => ({
      productId: i.productId,
      productName: i.productName,
      quantity: i.quantity,
      unitCost: i.unitCost,
      totalCost: i.totalCost,
    })),
  }

  const je = await createPostedJournalEntry({
    tenantId,
    branchId: r.branchId,
    entryDate: r.completedAt ?? r.updatedAt,
    sourceModule: 'REPAIR',
    sourceRefType: 'RepairTicket',
    sourceRefId: r.id,
    sourceEvent: 'REPAIR_COGS',
    memo: `Repair parts COGS ${r.ticketNumber}`,
    createdByEmail: actorEmail,
    lines: [
      {
        accountId: await resolveAccountIdByKey(tenantId, 'repairCogs'),
        debit: totalCogs,
        credit: 0,
        description: 'Repair parts COGS',
        metadata,
      },
      {
        accountId: await resolveAccountIdByKey(tenantId, 'inventoryParts'),
        debit: 0,
        credit: totalCogs,
        description: 'Inventory — Spare Parts',
        metadata,
      },
    ],
  })

  await prisma.integrationLink.create({
    data: {
      tenantId,
      sourceType: 'RepairTicket',
      sourceId: r.id,
      eventType: 'REPAIR_COGS',
      journalEntryId: je.id,
    },
  })

  return je
}

export async function postExpenseJournal(tenantId: string, txId: string, actorEmail?: string) {
  const tx = await readExpenseTransaction(tenantId, txId)
  if (!tx) throw new AppError('Expense transaction not found', 404)
  // Supplier payments settle AP — never post as operating expense.
  // Reload provider pay settles customer float — also not operating expense.
  if (tx.category === 'Supplier Payment') {
    throw new AppError('Supplier payments must be journaled as AP_PAYMENT_MADE, not EXPENSE_CREATED', 400)
  }
  if (tx.category === 'Reload Provider') {
    throw new AppError('Reload provider payments are cash settlements, not operating expenses', 400)
  }

  const settings = await getSettingsOrThrow(tenantId)
  const expenseMap = (settings.expenseCategoryMap ?? {}) as Record<string, unknown>
  const mapped = expenseMap[tx.category ?? '']
  const expenseAccountId = typeof mapped === 'string' && mapped
    ? mapped
    : await resolveAccountIdByKey(tenantId, 'opex')

  const amount = round2(Math.max(0, Number(tx.amount ?? 0)))
  if (amount <= 0) throw new AppError('Expense amount must be greater than zero', 400)

  const creditAccountId = tx.paymentMethod === 'CASH'
    ? await resolveBranchCashGlAccountId(tenantId, tx.branchId)
    : tx.paymentMethod === 'CARD'
      ? await resolveAccountIdByKey(tenantId, 'cardClearing')
      : (tx.paymentMethod === 'UPI' || tx.paymentMethod === 'WALLET')
        ? await resolveAccountIdByKey(tenantId, 'upiClearing')
        : await resolveAccountIdByKey(tenantId, 'bank')

  const je = await createPostedJournalEntry({
    tenantId,
    branchId: tx.branchId,
    entryDate: tx.createdAt,
    sourceModule: 'EXPENSE',
    sourceRefType: 'Transaction',
    sourceRefId: tx.id,
    sourceEvent: 'EXPENSE_CREATED',
    memo: tx.description,
    createdByEmail: actorEmail ?? tx.performedBy,
    lines: [
      { accountId: expenseAccountId, debit: amount, credit: 0, description: tx.category ?? 'Expense' },
      { accountId: creditAccountId, debit: 0, credit: amount, description: `Payment ${tx.paymentMethod}`, metadata: { paymentMethod: tx.paymentMethod, reference: tx.reference ?? null } },
    ],
  })

  await prisma.integrationLink.create({
    data: { tenantId, sourceType: 'Transaction', sourceId: tx.id, eventType: 'EXPENSE_CREATED', journalEntryId: je.id },
  })

  return je
}

export async function postRepairJournal(tenantId: string, repairId: string, actorEmail?: string) {
  const r = await readRepairForAccounting(tenantId, repairId)
  if (!r) throw new AppError('Repair ticket not found', 404)
  if (r.status !== 'DELIVERED') throw new AppError('Repair is not delivered', 400)

  const total = round2(Math.max(0, Number(r.actualCost ?? r.estimatedCost ?? 0)))
  const paid = round2(Math.max(0, Number(r.paidAmount ?? 0)))
  const due = round2(Math.max(0, Number(r.dueAmount ?? 0)))
  const settings = await getSettingsOrThrow(tenantId)
  const vat = settings.vatEnabled ? round2(total * 18 / 118) : 0
  const netIncome = round2(total - vat)

  const lines: JournalDraftLine[] = []

  if (paid > 0) {
    const cashAccount = await resolveBranchCashGlAccountId(tenantId, r.branchId)
    lines.push({ accountId: cashAccount, debit: paid, credit: 0, description: 'Repair receipt', metadata: { ticketNumber: r.ticketNumber } })
  }
  if (due > 0) {
    lines.push({ accountId: await resolveAccountIdByKey(tenantId, 'ar'), debit: due, credit: 0, description: 'Repair receivable', customerId: r.customerId, metadata: { ticketNumber: r.ticketNumber } })
  }
  lines.push({
    accountId: await resolveAccountIdByKey(tenantId, 'repairIncome'),
    debit: 0,
    credit: netIncome,
    description: vat > 0 ? 'Repair income (net)' : 'Repair income',
    metadata: { ticketNumber: r.ticketNumber },
  })
  if (vat > 0) {
    lines.push({ accountId: await resolveAccountIdByKey(tenantId, 'vatOutput'), debit: 0, credit: vat, description: 'VAT on repair', metadata: { ticketNumber: r.ticketNumber } })
  }

  const je = await createPostedJournalEntry({
    tenantId,
    branchId: r.branchId,
    entryDate: r.completedAt ?? r.updatedAt,
    sourceModule: 'REPAIR',
    sourceRefType: 'RepairTicket',
    sourceRefId: r.id,
    sourceEvent: 'REPAIR_DELIVERED',
    memo: `Repair ${r.ticketNumber}`,
    createdByEmail: actorEmail,
    lines,
  })

  await prisma.integrationLink.create({
    data: { tenantId, sourceType: 'RepairTicket', sourceId: r.id, eventType: 'REPAIR_DELIVERED', journalEntryId: je.id },
  })

  return je
}

/**
 * Posts cash over/short from a closed business day.
 * variance = expectedCash - actualCash (positive = short, negative = over)
 */
export async function postDailyClosingVarianceJournal(
  tenantId: string,
  closingId: string,
  actorEmail?: string,
) {
  const closing = await readDailyClosingForAccounting(tenantId, closingId)
  if (!closing) throw new AppError('Daily closing not found', 404)
  if (closing.status !== 'CLOSED') throw new AppError('Daily closing is not closed', 400)

  const variance = round2(Number(closing.cashVariance ?? 0))
  if (Math.abs(variance) < 0.01) return null

  const amount = round2(Math.abs(variance))
  const cashAccountId = await resolveBranchCashGlAccountId(tenantId, closing.branchId)
  const varianceAccountId = await resolveAccountIdByKey(tenantId, 'cashVariance')

  const metadata = {
    closingId: closing.id,
    date: closing.dateKey,
    branchName: closing.branch?.name ?? null,
    expectedCash: round2(Number(closing.expectedCash ?? 0)),
    actualCash: round2(Number(closing.actualCash ?? 0)),
    cashVariance: variance,
    type: variance > 0 ? 'SHORT' : 'OVER',
    closedByName: closing.closedByName ?? null,
  }

  const lines: JournalDraftLine[] = variance > 0
    ? [
        { accountId: varianceAccountId, debit: amount, credit: 0, description: 'Cash shortage', metadata },
        { accountId: cashAccountId, debit: 0, credit: amount, description: 'Cash on hand adjustment', metadata },
      ]
    : [
        { accountId: cashAccountId, debit: amount, credit: 0, description: 'Cash on hand adjustment', metadata },
        { accountId: varianceAccountId, debit: 0, credit: amount, description: 'Cash overage', metadata },
      ]

  const entryDate = closing.closedAt ?? closing.date

  const je = await createPostedJournalEntry({
    tenantId,
    branchId: closing.branchId,
    entryDate,
    sourceModule: 'DAILY_CLOSING',
    sourceRefType: 'DailyClosing',
    sourceRefId: closing.id,
    sourceEvent: 'DAILY_CLOSING_VARIANCE',
    memo: `Cash ${variance > 0 ? 'short' : 'over'} — ${closing.dateKey}`,
    createdByEmail: actorEmail ?? closing.closedByName ?? undefined,
    lines,
  })

  await prisma.integrationLink.create({
    data: {
      tenantId,
      sourceType: 'DailyClosing',
      sourceId: closing.id,
      eventType: 'DAILY_CLOSING_VARIANCE',
      journalEntryId: je.id,
    },
  })

  return je
}

export async function postSaleReturnJournal(tenantId: string, returnId: string, actorEmail?: string) {
  const ret = await readSaleReturnForAccounting(tenantId, returnId)
  if (!ret) throw new AppError('Sale return not found', 404)

  const branchId = ret.branchId ?? ret.sale.branchId
  if (!branchId) throw new AppError('Return branchId is required for accounting', 400)

  const refund = round2(Math.max(0, Number(ret.refundAmount ?? 0)))
  if (refund <= 0) throw new AppError('Return refund amount must be greater than zero', 400)

  let mobileRev = 0
  let accessoryRev = 0
  let serviceRev = 0
  for (const item of ret.items) {
    const amt = round2(Math.max(0, Number(item.total ?? 0)))
    if (amt <= 0) continue
    if (!item.productId) serviceRev += amt
    else if (isMobileProduct(item.product)) mobileRev += amt
    else accessoryRev += amt
  }
  mobileRev = round2(mobileRev)
  accessoryRev = round2(accessoryRev)
  serviceRev = round2(serviceRev)
  const itemTotal = round2(mobileRev + accessoryRev + serviceRev)
  const returnTotal = itemTotal > 0 ? itemTotal : refund

  const saleTax = round2(Math.max(0, Number(ret.sale.tax ?? 0)))
  const saleTotal = round2(Math.max(0, Number(ret.sale.total ?? 0)))
  const vatReversal = saleTotal > 0 && saleTax > 0 ? round2(saleTax * (returnTotal / saleTotal)) : 0
  const netReturn = round2(returnTotal - vatReversal)

  const lines: JournalDraftLine[] = []

  if (mobileRev > 0) {
    const mobileNet = itemTotal > 0 ? round2(mobileRev * (netReturn / returnTotal)) : mobileRev
    if (mobileNet > 0) lines.push({ accountId: await resolveAccountIdByKey(tenantId, 'salesReturns'), debit: mobileNet, credit: 0, description: 'Sales return — Mobile' })
  }
  if (accessoryRev > 0) {
    const accessoryNet = itemTotal > 0 ? round2(accessoryRev * (netReturn / returnTotal)) : accessoryRev
    if (accessoryNet > 0) lines.push({ accountId: await resolveAccountIdByKey(tenantId, 'salesReturns'), debit: accessoryNet, credit: 0, description: 'Sales return — Accessories' })
  }
  if (serviceRev > 0) {
    const serviceNet = itemTotal > 0 ? round2(serviceRev * (netReturn / returnTotal)) : serviceRev
    if (serviceNet > 0) lines.push({ accountId: await resolveAccountIdByKey(tenantId, 'salesReturns'), debit: serviceNet, credit: 0, description: 'Sales return — Service' })
  }
  if (itemTotal <= 0 && netReturn > 0) {
    lines.push({ accountId: await resolveAccountIdByKey(tenantId, 'salesReturns'), debit: netReturn, credit: 0, description: 'Sales return' })
  }
  if (vatReversal > 0) {
    lines.push({ accountId: await resolveAccountIdByKey(tenantId, 'vatOutput'), debit: vatReversal, credit: 0, description: 'VAT reversal on return' })
  }

  let creditAccountId: string
  const method = ret.refundMethod
  if (method === 'CASH') creditAccountId = await resolveBranchCashGlAccountId(tenantId, branchId)
  else if (method === 'CARD') creditAccountId = await resolveAccountIdByKey(tenantId, 'cardClearing')
  else if (method === 'UPI' || method === 'WALLET') creditAccountId = await resolveAccountIdByKey(tenantId, 'upiClearing')
  else if (method === 'BANK_TRANSFER') creditAccountId = await resolveAccountIdByKey(tenantId, 'bank')
  else if (method === 'CREDIT') creditAccountId = await resolveAccountIdByKey(tenantId, 'ar')
  else creditAccountId = await resolveBranchCashGlAccountId(tenantId, branchId)

  lines.push({
    accountId: creditAccountId,
    debit: 0,
    credit: returnTotal,
    description: `Refund ${method}`,
    metadata: {
      returnNumber: ret.returnNumber,
      saleId: ret.saleId,
      invoiceNumber: ret.sale.invoiceNumber,
      refundMethod: method,
    },
  })

  const je = await createPostedJournalEntry({
    tenantId,
    branchId,
    entryDate: ret.createdAt,
    sourceModule: 'SALES',
    sourceRefType: 'SaleReturn',
    sourceRefId: ret.id,
    sourceEvent: 'SALE_RETURN_CREATED',
    memo: `Sale Return ${ret.returnNumber}`,
    createdByEmail: actorEmail,
    lines,
  })

  await prisma.integrationLink.create({
    data: {
      tenantId,
      sourceType: 'SaleReturn',
      sourceId: ret.id,
      eventType: 'SALE_RETURN_CREATED',
      journalEntryId: je.id,
    },
  })

  return je
}

export async function postSaleReturnCogsJournal(tenantId: string, returnId: string, actorEmail?: string) {
  const ret = await readSaleReturnForAccounting(tenantId, returnId)
  if (!ret) throw new AppError('Sale return not found', 404)

  const branchId = ret.branchId ?? ret.sale.branchId
  if (!branchId) throw new AppError('Return branchId is required for accounting', 400)

  const imeiByProduct = new Map(
    ret.sale.items.filter(i => i.productId && i.imei).map(i => [i.productId!, i.imei]),
  )

  const { mobile, accessory } = buildSaleCogsLines(
    ret.items.map(item => ({
      productId: item.productId,
      productName: item.productName,
      sku: '',
      imei: item.productId ? (imeiByProduct.get(item.productId) ?? null) : null,
      quantity: item.quantity,
      product: item.product,
    })),
  )

  const mobileCost = sumCogsItems(mobile)
  const accessoryCost = sumCogsItems(accessory)
  const totalCogs = round2(mobileCost + accessoryCost)

  if (totalCogs <= 0) {
    const revLink = await prisma.integrationLink.findUnique({
      where: {
        tenantId_sourceType_sourceId_eventType: {
          tenantId,
          sourceType: 'SaleReturn',
          sourceId: ret.id,
          eventType: 'SALE_RETURN_CREATED',
        },
      },
    })
    if (!revLink) throw new AppError('Return revenue journal not posted yet', 409)
    await prisma.integrationLink.upsert({
      where: {
        tenantId_sourceType_sourceId_eventType: {
          tenantId,
          sourceType: 'SaleReturn',
          sourceId: ret.id,
          eventType: 'SALE_RETURN_COGS',
        },
      },
      create: {
        tenantId,
        sourceType: 'SaleReturn',
        sourceId: ret.id,
        eventType: 'SALE_RETURN_COGS',
        journalEntryId: revLink.journalEntryId,
      },
      update: {},
    })
    return null
  }

  const metadata = {
    returnNumber: ret.returnNumber,
    saleId: ret.saleId,
    invoiceNumber: ret.sale.invoiceNumber,
    items: [...mobile, ...accessory].map(i => ({
      productId: i.productId,
      productName: i.productName,
      imei: i.imei,
      quantity: i.quantity,
      unitCost: i.unitCost,
      totalCost: i.totalCost,
    })),
  }

  const lines: JournalDraftLine[] = []
  if (mobileCost > 0) {
    lines.push({
      accountId: await resolveAccountIdByKey(tenantId, 'inventoryMobile'),
      debit: mobileCost,
      credit: 0,
      description: 'Inventory — Mobile (return)',
      metadata,
    })
    lines.push({
      accountId: await resolveAccountIdByKey(tenantId, 'cogsMobile'),
      debit: 0,
      credit: mobileCost,
      description: 'COGS reversal — Mobile',
      metadata,
    })
  }
  if (accessoryCost > 0) {
    lines.push({
      accountId: await resolveAccountIdByKey(tenantId, 'inventoryAccessory'),
      debit: accessoryCost,
      credit: 0,
      description: 'Inventory — Accessories (return)',
      metadata,
    })
    lines.push({
      accountId: await resolveAccountIdByKey(tenantId, 'cogsAccessory'),
      debit: 0,
      credit: accessoryCost,
      description: 'COGS reversal — Accessories',
      metadata,
    })
  }

  const je = await createPostedJournalEntry({
    tenantId,
    branchId,
    entryDate: ret.createdAt,
    sourceModule: 'SALES',
    sourceRefType: 'SaleReturn',
    sourceRefId: ret.id,
    sourceEvent: 'SALE_RETURN_COGS',
    memo: `COGS reversal — Return ${ret.returnNumber}`,
    createdByEmail: actorEmail,
    lines,
  })

  await prisma.integrationLink.create({
    data: {
      tenantId,
      sourceType: 'SaleReturn',
      sourceId: ret.id,
      eventType: 'SALE_RETURN_COGS',
      journalEntryId: je.id,
    },
  })

  return je
}

