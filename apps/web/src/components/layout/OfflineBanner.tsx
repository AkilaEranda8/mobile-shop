'use client'

import { WifiOff, CloudOff, RefreshCw } from 'lucide-react'
import { useOnlineStatus } from '@/lib/offline/use-online-status'
import toast from 'react-hot-toast'

export function OfflineBanner() {
  const { isOnline, pendingCount, syncing, runSync } = useOnlineStatus()

  if (isOnline && pendingCount === 0) return null

  const handleSync = async () => {
    const result = await runSync()
    if (result.synced > 0) {
      toast.success(`${result.synced} offline sale${result.synced > 1 ? 's' : ''} synced`, { icon: '☁️' })
    } else if (result.failed > 0) {
      toast.error('Some offline sales could not sync yet')
    } else if (!isOnline) {
      toast.error('Still offline — connect to the internet to sync')
    }
  }

  return (
    <div
      className={`px-4 py-2 text-sm flex items-center justify-center gap-3 border-b ${
        isOnline ? 'bg-amber-500/10 border-amber-500/20 text-amber-200' : 'bg-red-500/10 border-red-500/20 text-red-200'
      }`}
    >
      {isOnline ? (
        <CloudOff size={16} className="flex-shrink-0" />
      ) : (
        <WifiOff size={16} className="flex-shrink-0" />
      )}
      <span className="text-center">
        {isOnline
          ? `Offline mode — ${pendingCount} sale${pendingCount !== 1 ? 's' : ''} waiting to sync`
          : 'You are offline — POS sales will be saved locally and synced when connected'}
      </span>
      {(pendingCount > 0 || !isOnline) && (
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing || !isOnline}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 disabled:opacity-50"
        >
          <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
          Sync now
        </button>
      )}
    </div>
  )
}
