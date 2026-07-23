'use client'

import { useCallback, useEffect, useState } from 'react'
import { Sparkles, Trash2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { tenantApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'

type DemoStatus = {
  installed: boolean
  canRemove: boolean
  clearedAt?: string | null
  itemCounts?: Record<string, number> | null
}

function dismissKey(tenantId?: string | null) {
  return tenantId ? `hx_demo_data_dismissed:${tenantId}` : null
}

/** Banner + remove button — hidden permanently after demo data is cleared. */
export function DemoDataBanner() {
  const user = authStorage.getUser()
  const role = user?.role
  const tenantId = user?.tenantId
  const canClear = role === 'OWNER' || role === 'PLATFORM_ADMIN'

  const [status, setStatus] = useState<DemoStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [dismissed, setDismissed] = useState(() => {
    try {
      const key = dismissKey(tenantId)
      return key ? sessionStorage.getItem(key) === '1' : false
    } catch {
      return false
    }
  })

  const markDismissed = useCallback(() => {
    setDismissed(true)
    setStatus(null)
    try {
      const key = dismissKey(tenantId)
      if (key) sessionStorage.setItem(key, '1')
    } catch { /* noop */ }
  }, [tenantId])

  const load = useCallback(async () => {
    try {
      const res: any = await tenantApi.demoDataStatus()
      const data = (res?.data ?? res) as DemoStatus
      // Already cleared on server → never show banner again
      if (!data?.installed || data?.clearedAt || !data?.canRemove) {
        markDismissed()
        return
      }
      // Fresh install — allow banner again
      try {
        const key = dismissKey(tenantId)
        if (key) sessionStorage.removeItem(key)
      } catch { /* noop */ }
      setDismissed(false)
      setStatus(data)
    } catch {
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [markDismissed, tenantId])

  useEffect(() => {
    void load()
  }, [load])

  const clear = async () => {
    if (!canClear) return
    if (!confirm('Remove all demo data from every module? Your real data stays. This cannot be undone.')) return
    setClearing(true)
    try {
      await tenantApi.clearDemoData()
      toast.success('Demo data removed')
      markDismissed()
      window.dispatchEvent(new CustomEvent('demo-data-cleared'))
    } catch (e: unknown) {
      toast.error((e as { message?: string })?.message ?? 'Could not remove demo data')
    } finally {
      setClearing(false)
    }
  }

  // Hide while loading, after clear, or when nothing to remove
  if (dismissed || loading || !status?.installed || !status.canRemove) return null

  const counts = status.itemCounts
  const summary = counts
    ? [
        counts.products ? `${counts.products} products` : null,
        counts.sales ? `${counts.sales} sales` : null,
        counts.repairs ? `${counts.repairs} repairs` : null,
        counts.customers ? `${counts.customers} customers` : null,
      ].filter(Boolean).join(' · ') || 'Sample data across modules'
    : 'Sample catalog for exploring the system'

  return (
    <div
      className="rounded-2xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
      style={{
        borderColor: 'rgba(124, 58, 237, 0.28)',
        background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(14,165,233,0.06))',
      }}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-violet-500/15 text-violet-600 dark:text-violet-300">
          <Sparkles size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Demo data is loaded
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {summary}. Remove when you are ready to use your own shop data — this banner will disappear after clearing.
          </p>
        </div>
      </div>
      {canClear && (
        <button
          type="button"
          onClick={clear}
          disabled={clearing}
          className="btn-secondary text-sm flex items-center gap-2 flex-shrink-0 text-red-600 dark:text-red-400"
        >
          {clearing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          Remove demo data
        </button>
      )}
    </div>
  )
}
