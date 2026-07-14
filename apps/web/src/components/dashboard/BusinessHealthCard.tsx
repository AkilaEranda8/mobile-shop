'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight, Info, TrendingUp, Package, Users, Wrench,
  DollarSign, ShoppingCart, ChevronDown, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export type BusinessHealthInput = {
  totalRevenue: number
  totalGrossProfit: number
  totalNetProfit: number
  grossMarginPct: number
  netMarginPct: number
  lowStockCount: number
  totalCustomers: number
  activeRepairs: number
  /** Last 7 days revenue for trend (optional) */
  sparkRevenue?: number[]
}

type Factor = {
  id: string
  label: string
  detail: string
  score: number
  max: number
  ok: boolean
  warn: boolean
  href: string
  icon: typeof ShoppingCart
}

function clamp(n: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, n))
}

function buildFactors(d: BusinessHealthInput): Factor[] {
  const salesScore = d.totalRevenue > 0 ? (d.totalRevenue > 100_000 ? 18 : 12) : 0
  const grossScore =
    d.totalGrossProfit <= 0 ? 0
      : d.grossMarginPct >= 30 ? 18
        : d.grossMarginPct >= 15 ? 14
          : 8
  const netScore =
    d.totalNetProfit > 0 ? (d.netMarginPct >= 10 ? 16 : 10)
      : d.totalNetProfit === 0 && d.totalRevenue > 0 ? 4
        : 0
  const stockScore =
    d.lowStockCount === 0 ? 16
      : d.lowStockCount <= 3 ? 10
        : d.lowStockCount <= 8 ? 5
          : 0
  const custScore =
    d.totalCustomers >= 50 ? 16
      : d.totalCustomers >= 10 ? 12
        : d.totalCustomers > 0 ? 6
          : 0
  const repairScore =
    d.activeRepairs === 0 ? 16
      : d.activeRepairs < 5 ? 14
        : d.activeRepairs < 10 ? 10
          : d.activeRepairs < 20 ? 5
            : 0

  return [
    {
      id: 'sales',
      label: 'Sales (30d)',
      detail: d.totalRevenue > 0 ? formatCurrency(d.totalRevenue) : 'No sales',
      score: salesScore,
      max: 18,
      ok: d.totalRevenue > 0,
      warn: d.totalRevenue === 0,
      href: '/dashboard/sales',
      icon: ShoppingCart,
    },
    {
      id: 'gross',
      label: 'Gross Profit',
      detail: d.totalGrossProfit > 0 ? `${d.grossMarginPct.toFixed(1)}% margin` : 'No margin',
      score: grossScore,
      max: 18,
      ok: d.grossMarginPct >= 15,
      warn: d.grossMarginPct > 0 && d.grossMarginPct < 15,
      href: '/dashboard/finance',
      icon: TrendingUp,
    },
    {
      id: 'net',
      label: 'Net Profit',
      detail: d.totalNetProfit > 0
        ? `${d.netMarginPct.toFixed(1)}% after expenses`
        : d.totalRevenue > 0 ? 'After expenses' : 'No profit yet',
      score: netScore,
      max: 16,
      ok: d.totalNetProfit > 0,
      warn: d.totalNetProfit <= 0 && d.totalRevenue > 0,
      href: '/dashboard/profit-loss',
      icon: DollarSign,
    },
    {
      id: 'stock',
      label: 'Stock Status',
      detail: d.lowStockCount === 0 ? 'All stocked' : `${d.lowStockCount} low`,
      score: stockScore,
      max: 16,
      ok: d.lowStockCount === 0,
      warn: d.lowStockCount > 0,
      href: '/inventory?filter=low-stock',
      icon: Package,
    },
    {
      id: 'customers',
      label: 'Customers',
      detail: `${d.totalCustomers} registered`,
      score: custScore,
      max: 16,
      ok: d.totalCustomers > 0,
      warn: d.totalCustomers === 0,
      href: '/dashboard/customers',
      icon: Users,
    },
    {
      id: 'repairs',
      label: 'Active Repairs',
      detail: d.activeRepairs === 0 ? 'None open' : `${d.activeRepairs} open`,
      score: repairScore,
      max: 16,
      ok: d.activeRepairs < 10,
      warn: d.activeRepairs >= 10,
      href: '/dashboard/repairs',
      icon: Wrench,
    },
  ]
}

function HealthRing({ score, color }: { score: number; color: string }) {
  const clampScore = clamp(Math.round(score))
  const r = 54
  const circ = 2 * Math.PI * r
  const offset = circ - (clampScore / 100) * circ
  return (
    <div className="relative w-[9.5rem] h-[9.5rem] mx-auto">
      <svg viewBox="0 0 130 130" className="w-full h-full -rotate-90">
        <circle
          cx="65" cy="65" r={r} fill="none" strokeWidth="11"
          stroke="var(--border-default)"
        />
        <circle
          cx="65" cy="65" r={r} fill="none" stroke={color} strokeWidth="11"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-out, stroke 0.4s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black tabular-nums leading-none" style={{ color }}>{clampScore}%</span>
        <span className="text-[10px] mt-1 font-medium" style={{ color: 'var(--text-muted)' }}>Health</span>
      </div>
    </div>
  )
}

function trendLabel(spark?: number[]) {
  if (!spark || spark.length < 2) return null
  const first = spark.slice(0, Math.ceil(spark.length / 2)).reduce((a, b) => a + b, 0)
  const second = spark.slice(Math.ceil(spark.length / 2)).reduce((a, b) => a + b, 0)
  if (first === 0 && second === 0) return null
  const pct = first === 0 ? 100 : Math.round(((second - first) / Math.abs(first)) * 100)
  if (pct === 0) return { text: 'Flat vs prior half-week', up: true as boolean | null }
  return {
    text: `${pct > 0 ? '+' : ''}${pct}% vs prior days`,
    up: pct > 0,
  }
}

export function BusinessHealthCard({ data }: { data: BusinessHealthInput }) {
  const [showHow, setShowHow] = useState(false)
  const factors = useMemo(() => buildFactors(data), [data])
  const score = useMemo(
    () => clamp(factors.reduce((s, f) => s + f.score, 0)),
    [factors],
  )

  const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'
  const label = score >= 85 ? 'Excellent' : score >= 75 ? 'Strong' : score >= 50 ? 'Good' : score >= 30 ? 'Fair' : 'Needs Attention'
  const subtitle =
    score >= 75 ? "You're on a solid track"
      : score >= 50 ? 'A few areas need attention'
        : 'Focus on the amber items below'

  const trend = trendLabel(data.sparkRevenue)
  const issues = factors.filter(f => f.warn || !f.ok)

  return (
    <div
      className="rounded-2xl border shadow-sm p-5 flex flex-col h-full"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Business Health</h3>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>30-day weighted score</p>
        </div>
        <button
          type="button"
          onClick={() => setShowHow(v => !v)}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)' }}
          title="How score is calculated"
        >
          <Info size={15} />
        </button>
      </div>

      {showHow && (
        <div
          className="mb-3 rounded-xl border px-3 py-2.5 text-[11px] space-y-1"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
        >
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>How the score works</p>
          <p>Sales up to 18 · Gross margin 18 · Net profit 16 · Stock 16 · Customers 16 · Repairs 16 (max 100).</p>
          <p style={{ color: 'var(--text-muted)' }}>Only existing shop data is used — higher margins and healthy stock raise the score.</p>
        </div>
      )}

      <HealthRing score={score} color={color} />

      <div className="text-center mt-1 mb-4">
        <p className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
        {trend && (
          <p
            className="text-[11px] mt-1.5 font-medium inline-flex items-center gap-1"
            style={{ color: trend.up ? '#22c55e' : trend.up === false ? '#ef4444' : 'var(--text-muted)' }}
          >
            {trend.up === true ? <TrendingUp size={12} /> : trend.up === false ? <AlertTriangle size={12} /> : null}
            {trend.text}
          </p>
        )}
      </div>

      {issues.length > 0 && (
        <div
          className="mb-3 rounded-xl px-3 py-2 text-[11px] flex items-start gap-2 border"
          style={{
            borderColor: score < 50 ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)',
            background: score < 50 ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
            color: score < 50 ? '#ef4444' : '#d97706',
          }}
        >
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <span>
            {issues.length} area{issues.length > 1 ? 's' : ''} need attention:{' '}
            {issues.map(i => i.label).join(', ')}
          </span>
        </div>
      )}

      <div className="space-y-1 flex-1">
        {factors.map(f => {
          const statusColor = f.ok ? '#22c55e' : f.warn ? '#f59e0b' : '#ef4444'
          const Icon = f.icon
          const pct = Math.round((f.score / f.max) * 100)
          return (
            <Link
              key={f.id}
              href={f.href}
              className="group flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--bg-subtle)]"
            >
              <span
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border"
                style={{
                  background: `${statusColor}18`,
                  borderColor: `${statusColor}33`,
                  color: statusColor,
                }}
              >
                <Icon size={13} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
                    {f.label}
                  </span>
                  <span className="text-[11px] font-semibold tabular-nums shrink-0" style={{ color: statusColor }}>
                    {f.detail}
                  </span>
                </div>
                <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle-md)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: statusColor }}
                  />
                </div>
              </div>
              <ChevronDown size={12} className=" -rotate-90 opacity-0 group-hover:opacity-60 shrink-0" style={{ color: 'var(--text-muted)' }} />
            </Link>
          )
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div
          className="rounded-xl border px-3 py-2 text-center"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}
        >
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Points earned</p>
          <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {factors.reduce((s, f) => s + f.score, 0)}
            <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>/100</span>
          </p>
        </div>
        <div
          className="rounded-xl border px-3 py-2 text-center"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}
        >
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Healthy factors</p>
          <p className="text-sm font-bold tabular-nums inline-flex items-center justify-center gap-1" style={{ color: '#22c55e' }}>
            <CheckCircle2 size={13} />
            {factors.filter(f => f.ok).length}/{factors.length}
          </p>
        </div>
      </div>

      <Link
        href="/dashboard/reports/overview"
        className="mt-4 flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl text-sm font-semibold transition-colors border"
        style={{
          color: color,
          background: `${color}14`,
          borderColor: `${color}33`,
        }}
      >
        Go to Reports <ArrowRight size={14} />
      </Link>
    </div>
  )
}
