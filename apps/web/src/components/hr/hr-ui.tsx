'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Loader2, Briefcase, AlertTriangle, X } from 'lucide-react'
import { useFeatureFlag } from '@/lib/hooks'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function HrFeatureGate({ children }: { children: React.ReactNode }) {
  const enabled = useFeatureFlag('HR_PAYROLL')
  if (!enabled) {
    return (
      <div className="max-w-lg mx-auto mt-16 p-6 rounded-2xl text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center bg-violet-500/10 border border-violet-500/25">
          <Briefcase size={22} className="text-violet-400" />
        </div>
        <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>HR & Payroll is not enabled</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          Ask your shop owner to enable the HR & Payroll module in Settings → Features.
        </p>
        <Link href="/dashboard/settings" className="text-sm font-medium text-violet-400 hover:underline">
          Go to Settings
        </Link>
      </div>
    )
  }
  return <>{children}</>
}

export function HrPageShell({
  title,
  subtitle,
  icon: Icon,
  actions,
  children,
}: {
  title: string
  subtitle?: string
  icon?: LucideIcon
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/25 flex items-center justify-center">
              <Icon size={18} className="text-violet-400" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h1>
            {subtitle && <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
          </div>
        </div>
        {actions}
      </div>
      {children}
    </div>
  )
}

export function HrKpiCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{value}</p>
      {hint && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
  )
}

export function HrQuickLink({ href, icon: Icon, label, description }: { href: string; icon: LucideIcon; label: string; description: string }) {
  return (
    <Link
      href={href}
      className="block rounded-xl p-4 transition-colors hover:bg-white/5"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
          <Icon size={16} className="text-violet-400" />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</p>
        </div>
      </div>
    </Link>
  )
}

export function HrLoading() {
  return (
    <div className="flex items-center justify-center py-20 text-sm gap-2" style={{ color: 'var(--text-muted)' }}>
      <Loader2 size={16} className="animate-spin" /> Loading…
    </div>
  )
}

export function HrError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 p-4 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
      <AlertTriangle size={16} /> {message}
    </div>
  )
}

export const EMPLOYMENT_STATUS_LABELS: Record<string, string> = {
  CANDIDATE: 'Candidate',
  ACTIVE: 'Active',
  ON_LEAVE: 'On Leave',
  SUSPENDED: 'Suspended',
  RESIGNED: 'Resigned',
  TERMINATED: 'Terminated',
}

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: 'Full Time',
  PART_TIME: 'Part Time',
  CONTRACT: 'Contract',
  CASUAL: 'Casual',
}

export const EMPLOYMENT_STATUS_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  CANDIDATE: { bg: 'bg-sky-500/10', text: 'text-sky-300', border: 'border-sky-500/30' },
  ACTIVE: { bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  ON_LEAVE: { bg: 'bg-amber-500/10', text: 'text-amber-300', border: 'border-amber-500/30' },
  SUSPENDED: { bg: 'bg-orange-500/10', text: 'text-orange-300', border: 'border-orange-500/30' },
  RESIGNED: { bg: 'bg-slate-500/10', text: 'text-slate-300', border: 'border-slate-500/30' },
  TERMINATED: { bg: 'bg-red-500/10', text: 'text-red-300', border: 'border-red-500/30' },
}

export function HrModal({
  title,
  subtitle,
  icon: Icon,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string
  subtitle?: string
  icon?: LucideIcon
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  wide?: boolean
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={cn(
          'w-full max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden',
          wide ? 'max-w-3xl' : 'max-w-lg',
        )}
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="shrink-0 flex items-start justify-between gap-3 px-5 py-4"
          style={{ borderBottom: '1px solid var(--border-subtle)', background: 'linear-gradient(180deg, rgba(139,92,246,0.08), transparent)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
                <Icon size={18} className="text-violet-400" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{title}</h3>
              {subtitle && (
                <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors shrink-0 hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div
            className="shrink-0 px-5 py-4 flex flex-wrap items-center justify-end gap-2"
            style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export function HrField({
  label,
  hint,
  required,
  children,
  className,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
        {label}{required ? ' *' : ''}
      </label>
      {children}
      {hint && <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
  )
}

export function HrSection({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string
  description?: string
  icon?: LucideIcon
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-2.5">
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <Icon size={13} className="text-violet-400" />
          </div>
        )}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>{title}</h4>
          {description && <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</p>}
        </div>
      </div>
      <div className="pl-0 sm:pl-9 space-y-3">{children}</div>
    </section>
  )
}

export function HrChoicePills({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string; tone?: { bg: string; text: string; border: string } }>
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const active = opt.value === value
        const tone = opt.tone
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all',
              active
                ? tone
                  ? `${tone.bg} ${tone.text} ${tone.border}`
                  : 'bg-violet-500/15 text-violet-300 border-violet-500/35'
                : 'border-transparent hover:bg-white/5',
            )}
            style={!active ? { color: 'var(--text-muted)', borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' } : undefined}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function HrAvatarBadge({ name, code }: { name: string; code?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('') || '?'
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600/40 to-violet-900/40 border border-violet-500/30 flex items-center justify-center text-sm font-bold text-violet-100 shrink-0">
        {initials}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{name || 'New employee'}</p>
        <p className="text-xs font-mono truncate" style={{ color: 'var(--text-muted)' }}>{code || 'Code auto-generated on save'}</p>
      </div>
    </div>
  )
}
