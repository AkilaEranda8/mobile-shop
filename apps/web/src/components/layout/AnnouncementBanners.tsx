'use client'

import { useCallback, useEffect, useState } from 'react'
import { X, Info, AlertTriangle, Wrench, Loader2 } from 'lucide-react'
import { platformApi, type PlatformAnnouncement } from '@/lib/api'

const TYPE_STYLES: Record<string, { bg: string; border: string; icon: typeof Info; accent: string }> = {
  INFO: {
    bg: 'rgba(59,130,246,0.10)',
    border: 'rgba(59,130,246,0.30)',
    icon: Info,
    accent: 'text-blue-500',
  },
  WARNING: {
    bg: 'rgba(245,158,11,0.10)',
    border: 'rgba(245,158,11,0.30)',
    icon: AlertTriangle,
    accent: 'text-amber-500',
  },
  MAINTENANCE: {
    bg: 'rgba(239,68,68,0.10)',
    border: 'rgba(239,68,68,0.30)',
    icon: Wrench,
    accent: 'text-red-500',
  },
}

export function AnnouncementBanners() {
  const [items, setItems] = useState<PlatformAnnouncement[]>([])
  const [dismissingId, setDismissingId] = useState<string | null>(null)

  const load = useCallback(() => {
    platformApi.listAnnouncements()
      .then((r: any) => setItems(r.data ?? r ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const id = window.setInterval(load, 60_000)
    const onFocus = () => { if (document.visibilityState === 'visible') load() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [load])

  const dismiss = async (id: string) => {
    setDismissingId(id)
    setItems(prev => prev.filter(a => a.id !== id))
    try {
      await platformApi.dismissAnnouncement(id)
    } catch {
      load()
    } finally {
      setDismissingId(null)
    }
  }

  if (!items.length) return null

  return (
    <div className="flex flex-col border-b" style={{ borderColor: 'var(--border-subtle)' }}>
      {items.map(a => {
        const style = TYPE_STYLES[a.type] ?? TYPE_STYLES.INFO
        const Icon = style.icon
        const busy = dismissingId === a.id
        return (
          <div
            key={a.id}
            className="flex items-start gap-3 px-4 py-3 border-b last:border-b-0"
            style={{ background: style.bg, borderColor: style.border }}
            role="status"
          >
            <Icon size={16} className={`${style.accent} flex-shrink-0 mt-0.5`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{a.title}</p>
              <p className="text-xs mt-0.5 whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{a.body}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(a.id)}
              disabled={busy}
              className="p-1.5 rounded-lg flex-shrink-0 transition-colors hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
              style={{ color: 'var(--text-muted)' }}
              title="Hide announcement"
              aria-label="Hide announcement"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
            </button>
          </div>
        )
      })}
    </div>
  )
}
