import { prisma } from '../../../config/database'
import { enqueueOutboxItem } from './accounting-outbox.service'
import { processAccountingOutbox } from './accounting-processor.service'

type EventPayload = {
  tenantId: string
  branchId?: string | null
  sourceType: string
  sourceId: string
  eventType: string
}

async function accountingReady(tenantId: string) {
  const settings = await prisma.accountingSettings.findUnique({ where: { tenantId } })
  return settings?.initializedAt ? settings : null
}

/** Enqueue GL events and auto-post when enabled (non-blocking for callers). */
export async function emitAccountingEvents(
  events: EventPayload[],
  actorEmail?: string,
) {
  if (!events.length) return
  try {
    const settings = await accountingReady(events[0].tenantId)
    if (!settings) return

    for (const e of events) {
      await enqueueOutboxItem({
        tenantId: e.tenantId,
        branchId: e.branchId,
        sourceType: e.sourceType,
        sourceId: e.sourceId,
        eventType: e.eventType,
      })
    }

    if (settings.autoPostEnabled) {
      await processAccountingOutbox(events[0].tenantId, 50, actorEmail)
    }
  } catch (err) {
    console.error('[accounting] emitAccountingEvents failed:', err)
  }
}

export function emitSaleAccounting(tenantId: string, saleId: string, branchId: string | null, actorEmail?: string) {
  return emitAccountingEvents([
    { tenantId, branchId, sourceType: 'Sale', sourceId: saleId, eventType: 'SALE_CREATED' },
    { tenantId, branchId, sourceType: 'Sale', sourceId: saleId, eventType: 'SALE_COGS' },
  ], actorEmail)
}

export function emitSaleReturnAccounting(tenantId: string, returnId: string, branchId: string | null, actorEmail?: string) {
  return emitAccountingEvents([
    { tenantId, branchId, sourceType: 'SaleReturn', sourceId: returnId, eventType: 'SALE_RETURN_CREATED' },
    { tenantId, branchId, sourceType: 'SaleReturn', sourceId: returnId, eventType: 'SALE_RETURN_COGS' },
  ], actorEmail)
}

export function emitRepairAccounting(tenantId: string, repairId: string, branchId: string | null, actorEmail?: string) {
  return emitAccountingEvents([
    { tenantId, branchId, sourceType: 'RepairTicket', sourceId: repairId, eventType: 'REPAIR_DELIVERED' },
    { tenantId, branchId, sourceType: 'RepairTicket', sourceId: repairId, eventType: 'REPAIR_COGS' },
  ], actorEmail)
}

export function emitPurchaseAccounting(tenantId: string, poId: string, branchId: string | null, actorEmail?: string) {
  return emitAccountingEvents([
    { tenantId, branchId, sourceType: 'PurchaseOrder', sourceId: poId, eventType: 'PURCHASE_RECEIVED' },
  ], actorEmail)
}

export function emitExpenseAccounting(tenantId: string, txId: string, branchId: string | null, actorEmail?: string) {
  return emitAccountingEvents([
    { tenantId, branchId, sourceType: 'Transaction', sourceId: txId, eventType: 'EXPENSE_CREATED' },
  ], actorEmail)
}

export function emitApPaymentAccounting(tenantId: string, txId: string, branchId: string | null, actorEmail?: string) {
  return emitAccountingEvents([
    { tenantId, branchId, sourceType: 'Transaction', sourceId: txId, eventType: 'AP_PAYMENT_MADE' },
  ], actorEmail)
}

export function emitDailyClosingAccounting(tenantId: string, closingId: string, branchId: string | null, actorEmail?: string) {
  return emitAccountingEvents([
    { tenantId, branchId, sourceType: 'DailyClosing', sourceId: closingId, eventType: 'DAILY_CLOSING_VARIANCE' },
  ], actorEmail)
}
