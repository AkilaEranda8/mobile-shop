import { addQueueItem } from './db'

function newId() {
  return `off_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export async function queueOfflineVanSale(payload: Record<string, unknown>, label?: string) {
  await addQueueItem({
    id: newId(),
    type: 'VAN_SALE_CREATE',
    payload,
    createdAt: new Date().toISOString(),
    label: label || 'Van sale',
  })
}

export async function queueOfflineVanPayment(payload: Record<string, unknown>, label?: string) {
  await addQueueItem({
    id: newId(),
    type: 'VAN_PAYMENT',
    payload,
    createdAt: new Date().toISOString(),
    label: label || 'Dealer payment',
  })
}

export async function queueOfflineVanVisit(payload: Record<string, unknown>, label?: string) {
  await addQueueItem({
    id: newId(),
    type: 'VAN_VISIT_UPSERT',
    payload,
    createdAt: new Date().toISOString(),
    label: label || 'Dealer visit',
  })
}
