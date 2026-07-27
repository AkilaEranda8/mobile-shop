'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  CreditCard,
  LayoutGrid,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Shield,
  Sparkles,
  Table2,
  Users,
  X,
  Zap,
} from 'lucide-react'
import type { Tenant } from '@/types'
import { formatCurrency } from '@/lib/utils'

export type BillingPlan = {
  key: string
  label: string
  price: string
  period: string
  color: string
  bg: string
  border: string
  features: string[]
  popular?: boolean
  mrr?: number | null
}

type Props = {
  tenant: Tenant | null
  plans: BillingPlan[]
  teamCount: number
  loading?: boolean
}

const FALLBACK_PLANS: BillingPlan[] = [
  {
    key: 'TRIAL',
    label: 'Trial',
    price: 'Free',
    period: '14 days',
    color: '#eab308',
    bg: 'rgba(234,179,8,0.08)',
    border: 'rgba(234,179,8,0.25)',
    features: ['1 Branch', '2 Users', 'POS & Billing', 'Inventory + IMEI', 'Repairs', 'Basic Reports'],
  },
  {
    key: 'STARTER',
    label: 'Starter',
    price: 'Rs. 2,999',
    period: '/month',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.25)',
    features: [
      '1 Branch',
      'Up to 5 Users',
      'POS & Billing',
      'Inventory + IMEI',
      'Customers & Credit',
      'Repairs & Warranty',
      'Daily Closing',
      'Basic Reports',
      'WhatsApp Receipts',
    ],
  },
  {
    key: 'PRO',
    label: 'Pro',
    price: 'Rs. 4,999',
    period: '/month',
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.08)',
    border: 'rgba(139,92,246,0.30)',
    features: [
      'Up to 5 Branches',
      'Up to 15 Users',
      'Everything in Starter',
      'Stock Transfer',
      'Suppliers & Purchase Orders',
      'Delivery & Exchanges',
      'P&L / Cash-Flow Reports',
      'Daily Reload',
      'Profit Allocation',
      'Priority Support',
    ],
    popular: true,
  },
  {
    key: 'ENTERPRISE',
    label: 'Enterprise',
    price: 'Custom',
    period: 'contact us',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.25)',
    features: [
      'Unlimited Branches & Users',
      'Everything in Pro',
      'Full Accounting (GL / AR / AP)',
      'Hire Purchase',
      'Product Traceability',
      'API Access',
      'White-Label',
      'Dedicated Support',
      'Custom Integrations',
    ],
  },
]

const PLAN_LIMITS: Record<string, { branches: number | null; users: number | null }> = {
  TRIAL: { branches: 1, users: 2 },
  STARTER: { branches: 1, users: 5 },
  PRO: { branches: 5, users: 15 },
  ENTERPRISE: { branches: null, users: null },
}

const PLAN_ORDER = ['TRIAL', 'STARTER', 'PRO', 'ENTERPRISE'] as const

function planRank(key: string) {
  const i = PLAN_ORDER.indexOf(key as (typeof PLAN_ORDER)[number])
  return i === -1 ? 0 : i
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  TRIAL: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  SUSPENDED: 'bg-red-500/15 text-red-400 border-red-500/30',
  CANCELLED: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
}

const SUPPORT_PHONE = '+94703130100'
const SUPPORT_WA = '94703130100'
const SUPPORT_EMAIL = 'support@hexalyte.com'

function fmtDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-LK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function daysUntil(value?: string | null) {
  if (!value) return null
  const ms = new Date(value).getTime() - Date.now()
  return Math.ceil(ms / 86400000)
}

function UsageMeter({
  label,
  used,
  limit,
  icon: Icon,
}: {
  label: string
  used: number
  limit: number | null
  icon: typeof Building2
}) {
  const unlimited = limit == null
  const pct = unlimited ? 12 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100))
  const over = !unlimited && used > limit
  return (
    <div
      className="rounded-2xl p-4 border"
      style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <Icon size={16} style={{ color: 'var(--text-secondary)' }} />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>
              {label}
            </p>
            <p className="text-lg font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
              {used}
              <span className="text-sm font-medium ml-1" style={{ color: 'var(--text-muted)' }}>
                / {unlimited ? '∞' : limit}
              </span>
            </p>
          </div>
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            over
              ? 'bg-red-500/15 text-red-400 border-red-500/30'
              : 'bg-white/5 text-slate-400 border-white/10'
          }`}
        >
          {unlimited ? 'Unlimited' : over ? 'Over limit' : `${pct}%`}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${unlimited ? 18 : pct}%`,
            background: over
              ? '#f87171'
              : 'linear-gradient(90deg, #6366f1, #a78bfa)',
          }}
        />
      </div>
    </div>
  )
}

export default function BillingSubscriptionPanel({ tenant, plans, teamCount, loading }: Props) {
  const [view, setView] = useState<'cards' | 'compare'>('cards')
  const [upgradePlan, setUpgradePlan] = useState<BillingPlan | null>(null)

  const catalog = plans.length ? plans : FALLBACK_PLANS
  const currentKey = tenant?.plan ?? 'TRIAL'
  const currentPlan = catalog.find((p) => p.key === currentKey) ?? catalog[0]
  const limits = PLAN_LIMITS[currentKey] ?? { branches: null, users: null }
  const branchCount = tenant?.branches?.length ?? 0
  const renewIn = daysUntil(tenant?.subscriptionEndsAt)
  const trialIn = daysUntil(tenant?.trialEndsAt)

  const renewProgress = useMemo(() => {
    if (!tenant?.subscriptionEndsAt || !tenant?.createdAt) return null
    const end = new Date(tenant.subscriptionEndsAt).getTime()
    const start = tenant.trialEndsAt
      ? new Date(tenant.trialEndsAt).getTime()
      : new Date(tenant.createdAt).getTime()
    const now = Date.now()
    if (end <= start) return null
    return Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)))
  }, [tenant])

  const allFeatures = useMemo(() => {
    const set = new Set<string>()
    for (const p of catalog) for (const f of p.features) set.add(f)
    return [...set]
  }, [catalog])

  const waUpgrade = (plan: BillingPlan) => {
    const text = encodeURIComponent(
      `Hi Hexalyte, I want to upgrade to the ${plan.label} plan (${plan.price}${plan.period}).\nShop: ${tenant?.name ?? ''}\nEmail: ${tenant?.ownerEmail ?? ''}`,
    )
    return `https://wa.me/${SUPPORT_WA}?text=${text}`
  }

  if (loading || !tenant) {
    return (
      <div className="card p-10 flex justify-center">
        <Loader2 size={22} className="animate-spin text-violet-400" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-2xl border"
        style={{
          borderColor: 'var(--border-subtle)',
          background:
            'radial-gradient(1200px 280px at 10% -20%, rgba(139,92,246,0.22), transparent 55%), radial-gradient(900px 240px at 90% 0%, rgba(59,130,246,0.12), transparent 50%), var(--bg-card)',
        }}
      >
        <div className="absolute inset-0 pointer-events-none opacity-[0.035]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.9) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }} />

        <div className="relative p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] px-2 py-1 rounded-md bg-violet-500/15 text-violet-300 border border-violet-500/25">
                  <CreditCard size={11} /> Billing & Subscription
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md border ${STATUS_STYLE[tenant.status] ?? STATUS_STYLE.ACTIVE}`}>
                  {tenant.status}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {currentPlan?.label ?? tenant.plan}
                <span className="text-base font-semibold ml-2" style={{ color: 'var(--text-muted)' }}>
                  plan
                </span>
              </h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                {tenant.name}
                {tenant.ownerEmail ? ` · ${tenant.ownerEmail}` : ''}
              </p>
            </div>

            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>
                Monthly rate
              </p>
              <p className="text-2xl font-black" style={{ color: currentPlan?.color ?? 'var(--text-primary)' }}>
                {tenant.mrr
                  ? formatCurrency(tenant.mrr)
                  : currentPlan?.price ?? '—'}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {currentPlan?.period === 'contact us' ? 'Custom billing' : 'Billed monthly'}
              </p>
            </div>
          </div>

          {/* Renewal timeline */}
          <div
            className="rounded-xl border p-4"
            style={{ background: 'rgba(0,0,0,0.18)', borderColor: 'var(--border-subtle)' }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                <Calendar size={14} className="text-violet-300" />
                {tenant.subscriptionEndsAt
                  ? `Renews ${fmtDate(tenant.subscriptionEndsAt)}`
                  : 'No renewal date set'}
              </div>
              <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {renewIn != null
                  ? renewIn < 0
                    ? `${Math.abs(renewIn)} days overdue`
                    : renewIn === 0
                      ? 'Renews today'
                      : `${renewIn} days left`
                  : tenant.trialEndsAt
                    ? `Trial ends ${fmtDate(tenant.trialEndsAt)}`
                    : '—'}
              </div>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${renewProgress ?? (renewIn != null && renewIn <= 0 ? 100 : 35)}%`,
                  background:
                    renewIn != null && renewIn <= 7
                      ? 'linear-gradient(90deg,#f59e0b,#ef4444)'
                      : 'linear-gradient(90deg,#6366f1,#a78bfa,#22d3ee)',
                }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              <span>Member since {fmtDate(tenant.createdAt)}</span>
              {tenant.trialEndsAt && <span>Trial {fmtDate(tenant.trialEndsAt)}{trialIn != null && trialIn > 0 ? ` (${trialIn}d left)` : ''}</span>}
            </div>
          </div>

          {tenant.paymentDue && (
            <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-4 flex flex-wrap items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={16} className="text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-300">Payment due</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {tenant.paymentDueAmount != null
                    ? `Amount ${formatCurrency(tenant.paymentDueAmount)}`
                    : 'Outstanding subscription payment'}
                  {tenant.paymentDueInvoiceNo ? ` · Invoice ${tenant.paymentDueInvoiceNo}` : ''}
                </p>
              </div>
              <a
                href={`tel:${SUPPORT_PHONE}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
              >
                <Phone size={12} /> Settle now
              </a>
            </div>
          )}
        </div>
      </section>

      {/* Usage */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <UsageMeter label="Branches" used={branchCount} limit={limits.branches} icon={Building2} />
        <UsageMeter label="Team members" used={teamCount} limit={limits.users} icon={Users} />
        <div
          className="rounded-2xl p-4 border"
          style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2.5 mb-2">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
            >
              <Zap size={16} className="text-violet-300" />
            </div>
            <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>
              Plan power
            </p>
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {(currentPlan?.features?.length ?? 0)} included features
          </p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
            Compare plans below to unlock more modules
          </p>
        </div>
        <div
          className="rounded-2xl p-4 border"
          style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2.5 mb-2">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
            >
              <Shield size={16} className="text-emerald-300" />
            </div>
            <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>
              Support
            </p>
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Hexalyte billing desk
          </p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
            WhatsApp / phone · {SUPPORT_PHONE.replace('+94', '+94 ')}
          </p>
        </div>
      </section>

      {/* Plans */}
      <section className="card p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">Plans</p>
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              Choose what fits your shop
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Upgrade anytime — we activate after payment confirmation
            </p>
          </div>
          <div
            className="inline-flex p-1 rounded-xl border"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}
          >
            <button
              type="button"
              onClick={() => setView('cards')}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                view === 'cards' ? 'bg-violet-600 text-white' : ''
              }`}
              style={view !== 'cards' ? { color: 'var(--text-muted)' } : undefined}
            >
              <LayoutGrid size={12} /> Cards
            </button>
            <button
              type="button"
              onClick={() => setView('compare')}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                view === 'compare' ? 'bg-violet-600 text-white' : ''
              }`}
              style={view !== 'compare' ? { color: 'var(--text-muted)' } : undefined}
            >
              <Table2 size={12} /> Compare
            </button>
          </div>
        </div>

        {view === 'cards' ? (
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {catalog.map((plan) => {
              const isCurrent = plan.key === currentKey
              const isDowngrade = planRank(plan.key) < planRank(currentKey)
              return (
                <div
                  key={plan.key}
                  className="relative rounded-2xl p-4 flex flex-col gap-3 transition-all hover:-translate-y-0.5"
                  style={{
                    background: isCurrent ? plan.bg : 'var(--bg-subtle)',
                    border: `1px solid ${isCurrent ? plan.border : 'var(--border-subtle)'}`,
                    boxShadow: isCurrent ? `0 0 0 1px ${plan.border}, 0 18px 40px -28px ${plan.color}` : undefined,
                  }}
                >
                  {plan.popular && !isCurrent && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] font-bold px-2.5 py-0.5 rounded-full bg-violet-600 text-white tracking-wide inline-flex items-center gap-1">
                      <Sparkles size={9} /> Popular
                    </span>
                  )}
                  {isCurrent && (
                    <span
                      className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] font-bold px-2.5 py-0.5 rounded-full text-white tracking-wide inline-flex items-center gap-1"
                      style={{ background: plan.color }}
                    >
                      <CheckCircle2 size={9} /> Current
                    </span>
                  )}

                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: plan.color }}>
                      {plan.label}
                    </p>
                    <p className="text-2xl font-black mt-1" style={{ color: 'var(--text-primary)' }}>
                      {plan.price}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {plan.period}
                    </p>
                  </div>

                  <ul className="space-y-1.5 flex-1">
                    {plan.features.slice(0, 7).map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <Check size={12} className="mt-0.5 flex-shrink-0" style={{ color: plan.color }} />
                        <span>{f}</span>
                      </li>
                    ))}
                    {plan.features.length > 7 && (
                      <li className="text-[11px] pl-4" style={{ color: 'var(--text-muted)' }}>
                        +{plan.features.length - 7} more
                      </li>
                    )}
                  </ul>

                  {isCurrent ? (
                    <div
                      className="text-center text-xs font-bold py-2 rounded-xl border"
                      style={{ color: plan.color, borderColor: plan.border, background: plan.bg }}
                    >
                      Active plan
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setUpgradePlan(plan)}
                      className="inline-flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-xl border transition hover:bg-white/5"
                      style={{ color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
                    >
                      {plan.key === 'ENTERPRISE'
                        ? 'Contact sales'
                        : isDowngrade
                          ? 'Talk to us'
                          : 'Upgrade'}
                      <ArrowUpRight size={12} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-subtle)' }}>
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr style={{ background: 'var(--bg-subtle)' }}>
                  <th className="text-left p-3 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                    Feature
                  </th>
                  {catalog.map((p) => (
                    <th key={p.key} className="p-3 text-center">
                      <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: p.color }}>
                        {p.label}
                      </div>
                      <div className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                        {p.price}
                      </div>
                      {p.key === currentKey && (
                        <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-600 text-white">
                          YOU
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allFeatures.map((feature, idx) => (
                  <tr
                    key={feature}
                    style={{
                      background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                      borderTop: '1px solid var(--border-subtle)',
                    }}
                  >
                    <td className="p-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {feature}
                    </td>
                    {catalog.map((p) => {
                      const has = p.features.includes(feature)
                      return (
                        <td key={p.key} className="p-3 text-center">
                          {has ? (
                            <Check size={14} className="inline" style={{ color: p.color }} />
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                <tr style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td className="p-3" />
                  {catalog.map((p) => (
                    <td key={p.key} className="p-3 text-center">
                      {p.key === currentKey ? (
                        <span className="text-[11px] font-bold" style={{ color: p.color }}>
                          Active
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setUpgradePlan(p)}
                          className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border hover:bg-white/5"
                          style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                        >
                          {p.key === 'ENTERPRISE' ? 'Contact' : 'Upgrade'}
                        </button>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Help */}
      <section
        className="rounded-2xl border p-5 flex flex-wrap items-center justify-between gap-4"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}
      >
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Need help with billing?
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Invoices, renewals, and plan changes are handled by Hexalyte support.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`https://wa.me/${SUPPORT_WA}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            <MessageCircle size={13} /> WhatsApp
          </a>
          <a
            href={`tel:${SUPPORT_PHONE}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            <Phone size={13} /> Call
          </a>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Billing · ${tenant.name}`)}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            <Mail size={13} /> Email
          </a>
        </div>
      </section>

      {/* Upgrade modal */}
      {upgradePlan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
          onClick={() => setUpgradePlan(null)}
        >
          <div
            className="rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="p-5 border-b flex items-start justify-between gap-3"
              style={{
                borderColor: 'var(--border-subtle)',
                background: `linear-gradient(135deg, ${upgradePlan.bg}, transparent)`,
              }}
            >
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: upgradePlan.color }}>
                  {upgradePlan.key === 'ENTERPRISE' ? 'Talk to sales' : 'Upgrade request'}
                </p>
                <p className="text-xl font-black mt-1" style={{ color: 'var(--text-primary)' }}>
                  {upgradePlan.label}
                </p>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {upgradePlan.price}
                  <span className="ml-1">{upgradePlan.period}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUpgradePlan(null)}
                className="p-1.5 rounded-lg hover:bg-white/5"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {upgradePlan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <Check size={14} className="mt-0.5 flex-shrink-0" style={{ color: upgradePlan.color }} />
                    {f}
                  </li>
                ))}
              </ul>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Send a request and Hexalyte will confirm payment, then activate{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{upgradePlan.label}</strong> on your account.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <a
                  href={waUpgrade(upgradePlan)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  <MessageCircle size={15} /> WhatsApp
                </a>
                <a
                  href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Upgrade to ${upgradePlan.label} · ${tenant.name}`)}&body=${encodeURIComponent(`Shop: ${tenant.name}\nPlan: ${upgradePlan.label} (${upgradePlan.price}${upgradePlan.period})\nEmail: ${tenant.ownerEmail ?? ''}`)}`}
                  className="inline-flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl border"
                  style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}
                >
                  <Mail size={14} /> Email
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
