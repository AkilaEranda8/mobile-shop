'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { ArrowLeft, Lock, X } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

export const VIOLET_ACCENT = {
  color: '#7c3aed',
  bg: 'rgba(124,58,237,0.08)',
  border: 'rgba(124,58,237,0.22)',
}

export const GREEN_ACCENT = {
  color: '#16a34a',
  bg: 'rgba(21,128,61,0.08)',
  border: 'rgba(21,128,61,0.20)',
}

export const AMBER_ACCENT = {
  color: '#d97706',
  bg: 'rgba(217,119,6,0.08)',
  border: 'rgba(217,119,6,0.22)',
}

export const RED_ACCENT = {
  color: '#dc2626',
  bg: 'rgba(220,38,38,0.08)',
  border: 'rgba(220,38,38,0.22)',
}

export const CYAN_ACCENT = {
  color: '#0e7490',
  bg: 'rgba(14,116,144,0.08)',
  border: 'rgba(14,116,144,0.20)',
}

export function AccountingPageShell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`space-y-6 w-full max-w-none ${className}`}>{children}</div>
}

export function AccountingFeatureGate() {
  return (
    <EmptyState
      icon={Lock}
      title="Accounting module disabled"
      description="Enable Accounting (GL) in Settings → Features, or ask your platform admin to enable it for your shop."
      actions={[{ label: 'Go to Settings', href: '/settings', primary: true }]}
      accentColor="violet"
    />
  )
}

export function AccountingPageHeader({
  title,
  subtitle,
  icon: Icon,
  backHref = '/dashboard/accounting',
  actions,
}: {
  title: string
  subtitle?: string
  icon?: LucideIcon
  backHref?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex items-start gap-3 min-w-0">
        {backHref && (
          <Link
            href={backHref}
            className="mt-1 p-1.5 rounded-lg transition-colors shrink-0"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </Link>
        )}
        <div className="min-w-0">
          <h1 className="page-title flex items-center gap-2">
            {Icon && <Icon size={22} className="text-violet-400 shrink-0" />}
            {title}
          </h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2 sm:ml-auto">{actions}</div>}
    </div>
  )
}

export function AccountingKpiCard({
  label,
  value,
  sub,
  icon,
  accent = VIOLET_ACCENT,
}: {
  label: string
  value: string | number
  sub?: string
  icon?: React.ReactNode
  accent?: { color: string; bg: string; border: string }
}) {
  return (
    <div className="card p-4 sm:p-5" style={{ borderColor: accent.border, background: accent.bg }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: accent.color }}>
          {label}
        </span>
        {icon && (
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: accent.bg, border: `1px solid ${accent.border}`, color: accent.color }}
          >
            {icon}
          </div>
        )}
      </div>
      <p className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  )
}

export function CashFlowRegisterCard({
  name,
  balance,
  kind,
  branchName,
  onFill,
  onSettle,
}: {
  name: string
  balance: number
  kind: 'CASH' | 'BANK' | 'CLEARING'
  branchName?: string | null
  onFill?: () => void
  onSettle?: () => void
}) {
  const WatermarkIcon = kind === 'BANK' ? LandmarkWatermark : kind === 'CLEARING' ? CardWatermark : CashWatermark

  return (
    <div
      className="relative overflow-hidden rounded-xl border p-4 min-h-[130px] flex flex-col"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
    >
      <WatermarkIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-20 h-20 opacity-[0.07] pointer-events-none" style={{ color: 'var(--text-primary)' }} />

      <div className="relative z-10 flex-1">
        <p className="text-sm font-medium truncate pr-16" style={{ color: 'var(--text-primary)' }}>{name}</p>
        {branchName && (
          <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{branchName}</p>
        )}
        <p className="text-2xl sm:text-3xl font-bold mt-2 tabular-nums tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {typeof balance === 'number' ? balance.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : balance}
        </p>
      </div>

      <div className="relative z-10 flex justify-end gap-2 mt-3">
        {onFill && (
          <button
            type="button"
            onClick={onFill}
            className="px-3 py-1 rounded-md text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-sm"
          >
            Fill
          </button>
        )}
        {onSettle && (
          <button
            type="button"
            onClick={onSettle}
            className="px-3 py-1 rounded-md text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors shadow-sm"
          >
            Settle
          </button>
        )}
      </div>
    </div>
  )
}

function CashWatermark({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 64 64" fill="currentColor" aria-hidden>
      <rect x="4" y="16" width="56" height="32" rx="4" opacity="0.9" />
      <circle cx="32" cy="32" r="10" fill="none" stroke="currentColor" strokeWidth="3" />
    </svg>
  )
}

function LandmarkWatermark({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 64 64" fill="currentColor" aria-hidden>
      <path d="M8 52h48v4H8zm4-6h8V28h8v18h8V20h8v26h8V32l8 14v6H12z" />
      <rect x="28" y="8" width="8" height="12" />
    </svg>
  )
}

function CardWatermark({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 64 64" fill="currentColor" aria-hidden>
      <rect x="6" y="18" width="52" height="34" rx="5" />
      <rect x="6" y="26" width="52" height="8" fill="var(--bg-card)" opacity="0.35" />
      <rect x="12" y="40" width="20" height="4" rx="1" fill="var(--bg-card)" opacity="0.5" />
    </svg>
  )
}

export function AccountingPanel({
  title,
  icon: Icon,
  actions,
  children,
  className = '',
}: {
  title?: string
  icon?: LucideIcon
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`card overflow-hidden ${className}`}>
      {title && (
        <div
          className="px-4 py-3 flex items-center gap-2 flex-wrap"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          {Icon && <Icon size={15} style={{ color: 'var(--text-muted)' }} />}
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={title ? '' : ''}>{children}</div>
    </div>
  )
}

export function AccountingModal({
  title,
  icon: Icon,
  onClose,
  children,
  wide,
}: {
  title: string
  icon?: LucideIcon
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`w-full ${wide ? 'max-w-3xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl`}
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="sticky top-0 flex items-center justify-between px-5 py-4 z-10"
          style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon && (
              <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
                <Icon size={14} className="text-violet-400" />
              </div>
            )}
            <h3 className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors shrink-0"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={15} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function AccountingTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ id: T; label: string }>
  value: T
  onChange: (id: T) => void
}) {
  return (
    <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
      {tabs.map(t => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className="px-4 py-2.5 text-sm font-medium transition-colors -mb-px"
          style={{
            borderBottom: `2px solid ${value === t.id ? '#7c3aed' : 'transparent'}`,
            color: value === t.id ? '#a78bfa' : 'var(--text-muted)',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function AccountingQuickLink({
  href,
  icon: Icon,
  label,
  description,
}: {
  href: string
  icon: LucideIcon
  label: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="card p-4 flex items-center gap-3 hover:border-violet-500/30 transition-colors group"
    >
      <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
        <Icon size={18} className="text-violet-400" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold group-hover:text-violet-300 transition-colors" style={{ color: 'var(--text-primary)' }}>
          {label}
        </p>
        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{description}</p>
      </div>
    </Link>
  )
}

export function AccountingStatusBadge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'violet'
}) {
  const styles = {
    success: 'bg-green-500/10 border-green-500/20 text-green-400',
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    danger: 'bg-red-500/10 border-red-500/20 text-red-400',
    violet: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
    neutral: 'bg-white/5 border-white/10 text-slate-400',
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] font-medium ${styles[tone]}`}>
      {children}
    </span>
  )
}

export function AccountingTable({
  children,
  stickyHeader,
}: {
  children: React.ReactNode
  stickyHeader?: boolean
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        {children}
      </table>
    </div>
  )
}

export function AccountingTh({ children, className = '', align = 'left' }: { children?: React.ReactNode; className?: string; align?: 'left' | 'right' }) {
  return (
    <th
      className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide border-b ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}
      style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}
    >
      {children}
    </th>
  )
}

export function AccountingTd({ children, className = '', align = 'left', mono, style }: { children: React.ReactNode; className?: string; align?: 'left' | 'right'; mono?: boolean; style?: React.CSSProperties }) {
  return (
    <td
      className={`px-4 py-2.5 border-t ${align === 'right' ? 'text-right' : 'text-left'} ${mono ? 'font-mono' : ''} ${className}`}
      style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)', ...style }}
    >
      {children}
    </td>
  )
}
