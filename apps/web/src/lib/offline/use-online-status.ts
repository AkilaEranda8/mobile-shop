'use client'

import { useCallback, useEffect, useState } from 'react'
import { getQueueCount } from './db'
import { syncOfflineQueue } from './sync'

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  const refreshPending = useCallback(async () => {
    try {
      setPendingCount(await getQueueCount())
    } catch {
      setPendingCount(0)
    }
  }, [])

  const runSync = useCallback(async () => {
    if (!navigator.onLine) return { synced: 0, failed: 0 }
    setSyncing(true)
    try {
      const result = await syncOfflineQueue()
      await refreshPending()
      return result
    } finally {
      setSyncing(false)
    }
  }, [refreshPending])

  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine)
    updateOnline()
    refreshPending()

    const onOnline = () => {
      updateOnline()
      runSync().catch(() => {})
    }
    const onOffline = () => updateOnline()

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('offline-queue-updated', refreshPending)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('offline-queue-updated', refreshPending)
    }
  }, [refreshPending, runSync])

  return { isOnline, pendingCount, syncing, refreshPending, runSync }
}

export function notifyOfflineQueueUpdated() {
  window.dispatchEvent(new Event('offline-queue-updated'))
}
