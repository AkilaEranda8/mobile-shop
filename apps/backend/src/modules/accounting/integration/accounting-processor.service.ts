import { prisma } from '../../../config/database'
import { AppError } from '../../../middleware/error.middleware'
import {
  postDailyClosingVarianceJournal,
  postExpenseJournal,
  postOpeningCustomerArJournal,
  postOpeningSupplierApJournal,
  postPurchaseJournal,
  postRepairCogsJournal,
  postRepairJournal,
  postSaleCogsJournal,
  postSaleJournal,
  postSaleReturnCogsJournal,
  postSaleReturnJournal,
} from './auto-journal.engine'
import {
  postApPaymentFromTransaction,
  postArPaymentFromTransaction,
} from '../subledgers/ar-ap-payment.service'

async function markFailed(id: string, err: unknown) {
  const msg = err instanceof Error ? err.message : 'Unknown error'
  await prisma.accountingOutbox.update({
    where: { id },
    data: {
      status: 'FAILED',
      attempts: { increment: 1 },
      lastError: msg.slice(0, 500),
      processedAt: new Date(),
    },
  })
}

async function resetStaleProcessing(tenantId: string) {
  await prisma.accountingOutbox.updateMany({
    where: { tenantId, status: 'PROCESSING' },
    data: { status: 'PENDING' },
  })
}

async function alreadyLinked(tenantId: string, sourceType: string, sourceId: string, eventType: string) {
  const link = await prisma.integrationLink.findUnique({
    where: {
      tenantId_sourceType_sourceId_eventType: { tenantId, sourceType, sourceId, eventType },
    },
  })
  return !!link
}

export async function processAccountingOutbox(tenantId: string, limit = 50, actorEmail?: string) {
  const settings = await prisma.accountingSettings.findUnique({ where: { tenantId } })
  if (settings && !settings.autoPostEnabled) {
    return { processed: 0, failed: 0, scanned: 0, skipped: true, reason: 'autoPostEnabled is off' }
  }

  await resetStaleProcessing(tenantId)

  const items = await prisma.accountingOutbox.findMany({
    where: { tenantId, status: { in: ['PENDING', 'FAILED'] } },
    orderBy: { createdAt: 'asc' },
    take: Math.min(500, Math.max(1, limit)),
  })

  const eventPriority: Record<string, number> = {
    SALE_CREATED: 10,
    REPAIR_DELIVERED: 10,
    PURCHASE_RECEIVED: 10,
    EXPENSE_CREATED: 10,
    SALE_RETURN_CREATED: 10,
    OPENING_SUPPLIER_AP: 5,
    OPENING_CUSTOMER_AR: 5,
    AR_PAYMENT_RECEIVED: 10,
    AP_PAYMENT_MADE: 10,
    DAILY_CLOSING_VARIANCE: 15,
    SALE_COGS: 20,
    REPAIR_COGS: 20,
    SALE_RETURN_COGS: 20,
  }
  items.sort((a, b) => {
    const pa = eventPriority[a.eventType] ?? 50
    const pb = eventPriority[b.eventType] ?? 50
    if (pa !== pb) return pa - pb
    return a.createdAt.getTime() - b.createdAt.getTime()
  })

  let processed = 0
  let failed = 0

  for (const item of items) {
    try {
      const claimed = await prisma.accountingOutbox.updateMany({
        where: { id: item.id, status: { in: ['PENDING', 'FAILED'] } },
        data: { status: 'PROCESSING', attempts: { increment: 1 }, processedAt: new Date() },
      })
      if (claimed.count === 0) continue

      if (await alreadyLinked(tenantId, item.sourceType, item.sourceId, item.eventType)) {
        await prisma.accountingOutbox.update({
          where: { id: item.id },
          data: { status: 'COMPLETED', processedAt: new Date() },
        })
        processed += 1
        continue
      }

      if (item.eventType === 'SALE_CREATED' && item.sourceType === 'Sale') {
        await postSaleJournal(tenantId, item.sourceId, actorEmail)
      } else if (item.eventType === 'SALE_COGS' && item.sourceType === 'Sale') {
        await postSaleCogsJournal(tenantId, item.sourceId, actorEmail)
      } else if (item.eventType === 'EXPENSE_CREATED' && item.sourceType === 'Transaction') {
        await postExpenseJournal(tenantId, item.sourceId, actorEmail)
      } else if (item.eventType === 'REPAIR_DELIVERED' && item.sourceType === 'RepairTicket') {
        await postRepairJournal(tenantId, item.sourceId, actorEmail)
      } else if (item.eventType === 'REPAIR_COGS' && item.sourceType === 'RepairTicket') {
        await postRepairCogsJournal(tenantId, item.sourceId, actorEmail)
      } else if (item.eventType === 'OPENING_SUPPLIER_AP' && item.sourceType === 'PurchaseOrder') {
        await postOpeningSupplierApJournal(tenantId, item.sourceId, actorEmail)
      } else if (item.eventType === 'OPENING_CUSTOMER_AR' && item.sourceType === 'Sale') {
        await postOpeningCustomerArJournal(tenantId, item.sourceId, actorEmail)
      } else if (item.eventType === 'PURCHASE_RECEIVED' && item.sourceType === 'PurchaseOrder') {
        await postPurchaseJournal(tenantId, item.sourceId, actorEmail)
      } else if (item.eventType === 'DAILY_CLOSING_VARIANCE' && item.sourceType === 'DailyClosing') {
        await postDailyClosingVarianceJournal(tenantId, item.sourceId, actorEmail)
      } else if (item.eventType === 'SALE_RETURN_CREATED' && item.sourceType === 'SaleReturn') {
        await postSaleReturnJournal(tenantId, item.sourceId, actorEmail)
      } else if (item.eventType === 'SALE_RETURN_COGS' && item.sourceType === 'SaleReturn') {
        await postSaleReturnCogsJournal(tenantId, item.sourceId, actorEmail)
      } else if (item.eventType === 'AR_PAYMENT_RECEIVED' && item.sourceType === 'Transaction') {
        await postArPaymentFromTransaction(tenantId, item.sourceId, actorEmail)
      } else if (item.eventType === 'AP_PAYMENT_MADE' && item.sourceType === 'Transaction') {
        const payload = item.payload as {
          allocations?: Array<{ purchaseOrderId?: string; amount: number }>
        } | null
        await postApPaymentFromTransaction(tenantId, item.sourceId, actorEmail, payload?.allocations)
      } else {
        throw new AppError(`Unsupported outbox item: ${item.sourceType} ${item.eventType}`, 400)
      }

      await prisma.accountingOutbox.update({
        where: { id: item.id },
        data: { status: 'COMPLETED', processedAt: new Date() },
      })
      processed += 1
    } catch (e) {
      failed += 1
      await markFailed(item.id, e)
    }
  }

  return { processed, failed, scanned: items.length }
}
