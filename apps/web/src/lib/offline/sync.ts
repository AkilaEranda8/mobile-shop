import { salesApi } from '@/lib/api'
import { getQueueItems, removeQueueItem } from './db'

export function isBrowserOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine
}

export function isNetworkError(err: unknown): boolean {
  if (!isBrowserOnline()) return true
  if (err instanceof TypeError) return true
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    return msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')
  }
  const status = (err as { status?: number })?.status
  return status === undefined
}

export async function syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
  if (!isBrowserOnline()) return { synced: 0, failed: 0 }

  const items = await getQueueItems()
  let synced = 0
  let failed = 0

  for (const item of items) {
    try {
      if (item.type === 'SALE_CREATE') {
        await salesApi.create(item.payload)
        await removeQueueItem(item.id)
        synced++
      }
    } catch {
      failed++
    }
  }

  return { synced, failed }
}
