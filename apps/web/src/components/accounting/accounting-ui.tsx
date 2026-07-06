'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { ArrowLeft, Lock, X, Wallet, Landmark, CreditCard } from 'lucide-react'
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

const REGISTER_THEMES = {
  CASH: {
    accent: '#16a34a',
    bg: 'linear-gradient(135deg, rgba(22,163,74,0.12) 0%, rgba(22,163,74,0.02) 55%, transparent 100%)',
    border: 'rgba(22,163,74,0.28)',
    icon: Wallet,
  },
  BANK: {
    accent: '#6366f1',
    bg: 'linear-gradient(135deg, rgba(99,102,241,0.14) 0%, rgba(99,102,241,0.03) 55%, transparent 100%)',
    border: 'rgba(99,102,241,0.28)',
    icon: Landmark,
  },
  CLEARING: {
    accent: '#0891b2',
    bg: 'linear-gradient(135deg, rgba(8,145,178,0.14) 0%, rgba(8,145,178,0.03) 55%, transparent 100%)',
    border: 'rgba(8,145,178,0.28)',
    icon: CreditCard,
  },
} as const

const CASH_BANK_SUMMARY_ITEMS = [
  { key: 'cash' as const, label: 'Cash', icon: Wallet, color: '#16a34a' },
  { key: 'bank' as const, label: 'Bank', icon: Landmark, color: '#6366f1' },
  { key: 'clearing' as const, label: 'Clearing', icon: CreditCard, color: '#0891b2' },
]

function fmtCashBankAmount(n: number) {
  return n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function CashBankSummaryStrip({
  cash,
  bank,
  clearing,
}: {
  cash: number
  bank: number
  clearing: number
}) {
  const total = cash + bank + clearing
  const values = { cash, bank, clearing }

  return (
    <div className="grid grid-cols-2 gap-3">
      {CASH_BANK_SUMMARY_ITEMS.map(item => {
        const Icon = item.icon
        return (
          <div
            key={item.key}
            className="rounded-xl border p-4 flex items-center gap-3 transition-colors"
            style={{ background: `${item.color}14`, borderColor: `${item.color}33` }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${item.color}18`, color: item.color }}
            >
              <Icon size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
              <p className="text-lg font-bold tabular-nums truncate" style={{ color: 'var(--text-primary)' }}>{fmtCashBankAmount(values[item.key])}</p>
            </div>
          </div>
        )
      })}
      <div
        className="rounded-xl border p-4 flex items-center gap-3 col-span-2"
        style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.18) 0%, rgba(124,58,237,0.04) 100%)',
          borderColor: 'rgba(124,58,237,0.35)',
        }}
      >
        <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0 text-violet-400">
          <Wallet size={18} />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400">Total liquidity</p>
          <p className="text-lg font-bold tabular-nums text-violet-300">{fmtCashBankAmount(total)}</p>
        </div>
      </div>
    </div>
  )
}

export function CashBankSidebar({
  cash,
  bank,
  clearing,
  counts,
  onAddBank,
  onReconcile,
  onRefresh,
  loading,
}: {
  cash: number
  bank: number
  clearing: number
  counts: { cash: number; bank: number; clearing: number }
  onAddBank: () => void
  onReconcile: () => void
  onRefresh: () => void
  loading?: boolean
}) {
  const total = cash + bank + clearing
  const values = { cash, bank, clearing }
  const sectionLinks = [
    { id: 'cash-section', label: 'Cash registers', key: 'cash' as const, icon: Wallet, color: '#16a34a' },
    { id: 'bank-section', label: 'Bank accounts', key: 'bank' as const, icon: Landmark, color: '#6366f1' },
    { id: 'clearing-section', label: 'Clearing', key: 'clearing' as const, icon: CreditCard, color: '#0891b2' },
  ].filter(link => counts[link.key] > 0)

  return (
    <aside
      className="rounded-2xl border overflow-hidden sticky top-4"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}
    >
      <div
        className="px-4 py-5 border-b"
        style={{
          borderColor: 'var(--border-subtle)',
          background: 'linear-gradient(135deg, rgba(124,58,237,0.16) 0%, rgba(124,58,237,0.03) 100%)',
        }}
      >
        <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400">Total liquidity</p>
        <p className="text-2xl font-extrabold tabular-nums text-violet-300 mt-1">{fmtCashBankAmount(total)}</p>
        <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>Cash + Bank + Clearing</p>
      </div>

      <div className="p-3 space-y-1.5">
        {CASH_BANK_SUMMARY_ITEMS.map(item => {
          const Icon = item.icon
          return (
            <div
              key={item.key}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={{ background: `${item.color}0c` }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${item.color}18`, color: item.color }}
              >
                <Icon size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                <p className="text-sm font-bold tabular-nums truncate" style={{ color: 'var(--text-primary)' }}>
                  {fmtCashBankAmount(values[item.key])}
                </p>
              </div>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums shrink-0"
                style={{ background: `${item.color}18`, color: item.color }}
              >
                {counts[item.key]}
              </span>
            </div>
          )
        })}
      </div>

      {sectionLinks.length > 0 && (
        <div className="px-3 pb-3">
          <p className="text-[10px] font-bold uppercase tracking-wider px-1 mb-2" style={{ color: 'var(--text-muted)' }}>
            Jump to
          </p>
          <nav className="space-y-1">
            {sectionLinks.map(link => {
              const Icon = link.icon
              return (
                <a
                  key={link.id}
                  href={`#${link.id}`}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors hover:bg-white/5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <Icon size={14} style={{ color: link.color }} />
                  <span className="flex-1 truncate">{link.label}</span>
                  <span className="text-[10px] tabular-nums opacity-70">{counts[link.key]}</span>
                </a>
              )
            })}
          </nav>
        </div>
      )}

      <div className="p-3 pt-0 space-y-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <button type="button" onClick={onAddBank} className="btn-primary w-full flex items-center justify-center gap-2 text-sm">
          Add bank
        </button>
        <button type="button" onClick={onReconcile} className="btn-secondary w-full flex items-center justify-center gap-2 text-sm">
          Reconcile
        </button>
        <button
          type="button"
          onClick={onRefresh}
          className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh balances'}
        </button>
      </div>
    </aside>
  )
}

export function CashBankSection({
  id,
  title,
  kind,
  count,
  children,
  compact,
}: {
  id?: string
  title: string
  kind: 'CASH' | 'BANK' | 'CLEARING'
  count: number
  children: React.ReactNode
  compact?: boolean
}) {
  const theme = REGISTER_THEMES[kind]
  const Icon = theme.icon
  return (
    <section
      id={id}
      className="rounded-2xl border overflow-hidden scroll-mt-4"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}
    >
      <div
        className="px-4 py-3 flex items-center gap-3 border-b"
        style={{
          borderColor: 'var(--border-subtle)',
          background: theme.bg,
        }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${theme.accent}20`, color: theme.accent }}
        >
          <Icon size={16} />
        </div>
        <h2 className="text-sm font-bold flex-1" style={{ color: 'var(--text-primary)' }}>{title}</h2>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums"
          style={{ background: `${theme.accent}18`, color: theme.accent }}
        >
          {count}
        </span>
      </div>
      <div className={`p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 ${compact ? 'xl:grid-cols-3' : 'lg:grid-cols-3 xl:grid-cols-4'}`}>
        {children}
      </div>
    </section>
  )
}

export function CashFlowRegisterCard({
  name,
  balance,
  kind,
  subtitle,
  onFill,
  onSettle,
}: {
  name: string
  balance: number
  kind: 'CASH' | 'BANK' | 'CLEARING'
  subtitle?: string | null
  onFill?: () => void
  onSettle?: () => void
}) {
  const theme = REGISTER_THEMES[kind]
  const WatermarkIcon = kind === 'BANK' ? LandmarkWatermark : kind === 'CLEARING' ? CardWatermark : CashWatermark
  const KindIcon = theme.icon
  const isNegative = balance < 0
  const isZero = Math.abs(balance) < 0.005

  return (
    <div
      className="group relative overflow-hidden rounded-xl border min-h-[160px] flex flex-col transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
      style={{
        background: theme.bg,
        borderColor: theme.border,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ background: theme.accent }} />

      <WatermarkIcon
        className="absolute -right-2 bottom-2 w-24 h-24 opacity-[0.07] pointer-events-none transition-transform duration-300 group-hover:scale-105"
        style={{ color: theme.accent }}
      />

      <div className="relative z-10 flex-1 p-4 pb-2 pl-5 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-snug truncate" style={{ color: 'var(--text-primary)' }}>
              {name}
            </p>
            {subtitle && (
              <p className="text-[11px] mt-1 truncate font-medium opacity-80" style={{ color: 'var(--text-muted)' }}>
                {subtitle}
              </p>
            )}
          </div>
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 opacity-90"
            style={{ background: `${theme.accent}22`, color: theme.accent }}
          >
            <KindIcon size={14} />
          </div>
        </div>

        <div className="mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>
            Balance
          </p>
          <p
            className={`text-2xl font-extrabold tabular-nums tracking-tight leading-none ${
              isNegative ? 'text-rose-500' : isZero ? 'opacity-50' : ''
            }`}
            style={!isNegative && !isZero ? { color: 'var(--text-primary)' } : undefined}
          >
            <span className="text-sm font-semibold mr-1 opacity-60">LKR</span>
            {balance.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="relative z-10 flex gap-2 px-4 pb-4 pl-5 mt-auto">
        {onFill && (
          <button
            type="button"
            onClick={onFill}
            className="flex-1 py-2 rounded-lg text-xs font-bold text-white transition-all active:scale-[0.98] shadow-sm hover:shadow"
            style={{ background: 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)' }}
          >
            Fill
          </button>
        )}
        {onSettle && (
          <button
            type="button"
            onClick={onSettle}
            className="flex-1 py-2 rounded-lg text-xs font-bold text-white transition-all active:scale-[0.98] shadow-sm hover:shadow"
            style={{ background: 'linear-gradient(180deg, #f87171 0%, #e11d48 100%)' }}
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
