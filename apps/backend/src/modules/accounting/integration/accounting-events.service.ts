import { prisma } from '../../../config/database'
import { enqueueOutboxItem } from './accounting-outbox.service'
import { processAccountingOutbox } from './accounting-processor.service'

type EventPayload = {
  tenantId: string
  branchId?: string | null
  sourceType: string
  sourceId: string
  eventType: string
  payload?: Record<string, unknown>
}

export type EmitAccountingResult = {
  skipped?: boolean
  reason?: string
  processed?: number
  failed?: number
  scanned?: number
  error?: string
}

async function accountingReady(tenantId: string) {
  const settings = await prisma.accountingSettings.findUnique({ where: { tenantId } })
  return settings?.initializedAt ? settings : null
}

/** Enqueue GL events and auto-post when enabled. Returns status for callers to surface warnings. */
export async function emitAccountingEvents(
  events: EventPayload[],
  actorEmail?: string,
): Promise<EmitAccountingResult> {
  if (!events.length) return { skipped: true, reason: 'no events' }
  try {
    const settings = await accountingReady(events[0].tenantId)
    if (!settings) return { skipped: true, reason: 'accounting not initialized' }

    for (const e of events) {
      await enqueueOutboxItem({
        tenantId: e.tenantId,
        branchId: e.branchId,
        sourceType: e.sourceType,
        sourceId: e.sourceId,
        eventType: e.eventType,
        payload: e.payload,
      })
    }

    if (settings.autoPostEnabled) {
      const result = await processAccountingOutbox(events[0].tenantId, 50, actorEmail)
      if (result.failed > 0) {
        return { ...result, error: 'One or more accounting entries failed to post' }
      }
      return result
    }
    return { skipped: true, reason: 'autoPost disabled' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[accounting] emitAccountingEvents failed:', err)
    return { failed: 1, error: msg }
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

export function emitOpeningSupplierApAccounting(
  tenantId: string,
  poId: string,
  branchId: string | null,
  actorEmail?: string,
) {
  return emitAccountingEvents([
    { tenantId, branchId, sourceType: 'PurchaseOrder', sourceId: poId, eventType: 'OPENING_SUPPLIER_AP' },
  ], actorEmail)
}

export function emitOpeningCustomerArAccounting(
  tenantId: string,
  saleId: string,
  branchId: string | null,
  actorEmail?: string,
) {
  return emitAccountingEvents([
    { tenantId, branchId, sourceType: 'Sale', sourceId: saleId, eventType: 'OPENING_CUSTOMER_AR' },
  ], actorEmail)
}

export function emitExpenseAccounting(tenantId: string, txId: string, branchId: string | null, actorEmail?: string) {
  return emitAccountingEvents([
    { tenantId, branchId, sourceType: 'Transaction', sourceId: txId, eventType: 'EXPENSE_CREATED' },
  ], actorEmail)
}

export function emitApPaymentAccounting(
  tenantId: string,
  txId: string,
  branchId: string | null,
  actorEmail?: string,
  payload?: Record<string, unknown>,
) {
  return emitAccountingEvents([
    {
      tenantId,
      branchId,
      sourceType: 'Transaction',
      sourceId: txId,
      eventType: 'AP_PAYMENT_MADE',
      payload,
    },
  ], actorEmail)
}

export function emitDailyClosingAccounting(tenantId: string, closingId: string, branchId: string | null, actorEmail?: string) {
  return emitAccountingEvents([
    { tenantId, branchId, sourceType: 'DailyClosing', sourceId: closingId, eventType: 'DAILY_CLOSING_VARIANCE' },
  ], actorEmail)
}
