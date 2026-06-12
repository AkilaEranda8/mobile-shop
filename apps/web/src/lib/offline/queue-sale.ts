import { addQueueItem } from './db'
import { notifyOfflineQueueUpdated } from './use-online-status'

export async function queueOfflineSale(
  payload: Record<string, unknown>,
  invoiceNumber: string,
): Promise<{ id: string; invoiceNumber: string }> {
  const id = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  await addQueueItem({
    id,
    type: 'SALE_CREATE',
    payload,
    createdAt: new Date().toISOString(),
    label: invoiceNumber,
  })
  notifyOfflineQueueUpdated()
  return { id, invoiceNumber }
}

export function buildOfflineInvoiceNumber(): string {
  const stamp = Date.now().toString().slice(-8)
  return `OFF-${stamp}`
}
