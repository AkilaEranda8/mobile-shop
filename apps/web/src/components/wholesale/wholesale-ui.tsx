'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useEffect } from 'react'
import { Lock, X } from 'lucide-react'
import { useFeatureFlag } from '@/lib/hooks'

export function WholesalePageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
      <div>
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      {action ? <div className="sm:ml-auto">{action}</div> : null}
    </div>
  )
}

export function WholesaleFeatureGate({
  feature = 'WHOLESALE',
  children,
  label = 'Wholesale',
}: {
  feature?: string
  children: ReactNode
  label?: string
}) {
  const enabled = useFeatureFlag(feature)
  if (!enabled) {
    return (
      <div className="mx-auto mt-20 max-w-md text-center">
        <Lock className="mx-auto text-sky-600" />
        <h1 className="mt-4 text-xl font-bold">{label} is not enabled</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Ask a platform administrator to enable the {feature} tenant feature.
        </p>
      </div>
    )
  }
  return <>{children}</>
}

export function WholesaleKpiCard({
  label,
  value,
  icon: Icon,
  tone = 'sky',
}: {
  label: string
  value: string | number
  icon: React.ComponentType<{ size?: number; className?: string }>
  tone?: 'sky' | 'emerald' | 'amber' | 'violet' | 'rose'
}) {
  const tones: Record<string, string> = {
    sky: 'bg-sky-500/10 border-sky-500/20 text-sky-600',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-600',
    violet: 'bg-violet-500/10 border-violet-500/20 text-violet-600',
    rose: 'bg-rose-500/10 border-rose-500/20 text-rose-600',
  }
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${tones[tone]}`}>
        <Icon size={15} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold truncate" style={{ color: 'var(--text-primary)' }}>
          {value}
        </p>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {label}
        </p>
      </div>
    </div>
  )
}

export function WholesaleEmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div
      className="rounded-xl border border-dashed px-6 py-16 text-center"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        {title}
      </p>
      <p className="mt-1 text-xs max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>
        {description}
      </p>
    </div>
  )
}

export function WholesaleModalShell({
  title,
  onClose,
  children,
  wide,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-2xl shadow-xl border overflow-hidden`}
        style={{
          background: 'var(--bg-elevated, var(--bg-card, #fff))',
          borderColor: 'var(--border-subtle)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-2 py-1 rounded-lg hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
          >
            Esc
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

/** Full detail overlay — matches sales / hire-purchase / inventory view modals. */
export function WholesaleDetailShell({
  title,
  subtitle,
  icon: Icon,
  badge,
  actions,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  icon?: React.ComponentType<{ size?: number; className?: string }>
  badge?: ReactNode
  actions?: ReactNode
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="rounded-xl w-full max-w-6xl shadow-2xl max-h-[92vh] overflow-y-auto border"
        style={{
          background: 'var(--bg-card)',
          color: 'var(--text-primary)',
          borderColor: 'var(--border-default, var(--border-subtle))',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-3 border-b sticky top-0 z-10 gap-3"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-start gap-2 min-w-0">
            {Icon ? <Icon size={16} className="text-sky-500 mt-0.5 flex-shrink-0" /> : null}
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {title}
              </p>
              {subtitle ? (
                <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            {badge}
            {actions}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  )
}

export function fieldClass() {
  return 'w-full rounded-xl px-3 py-2 text-sm outline-none'
}

export function fieldStyle(): CSSProperties {
  return {
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)',
  }
}
