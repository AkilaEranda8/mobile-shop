'use client'

import { useMemo } from 'react'
import {
  TrendingUp, TrendingDown, ShoppingCart, Users, Wrench,
  AlertTriangle, Package, Shield, ArrowRight, Zap,
  BarChart2, Activity, Star, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'
import {
  useRevenue, useRepairs, useTransactions,
  useAnalyticsDashboard, useTopProducts
} from '@/lib/hooks'
import type { RepairTicket, Transaction as AppTransaction } from '@/types'
import { formatCurrency, formatRelativeTime, getRepairStatusColor } from '@/lib/utils'

/* ═══════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════ */

/* ── Business Health Score Ring ────────────────────────────────────── */
function HealthRing({ score }: { score: number }) {
  const clamp = Math.min(100, Math.max(0, score))
  const r = 52, circ = 2 * Math.PI * r
  const offset = circ - (clamp / 100) * circ
  const status = clamp >= 75 ? 'Excellent' : clamp >= 50 ? 'Good' : 'Warning'
  const gradId = clamp >= 75 ? 'healthGreen' : clamp >= 50 ? 'healthAmber' : 'healthRed'

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <defs>
            <linearGradient id="healthGreen" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
            <linearGradient id="healthAmber" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#eab308" />
            </linearGradient>
            <linearGradient id="healthRed" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#f97316" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* Track */}
          <circle cx="60" cy="60" r={r} fill="none"
            className="stroke-slate-200/60 dark:stroke-white/5" strokeWidth="10" />
          {/* Progress */}
          <circle cx="60" cy="60" r={r} fill="none"
            stroke={`url(#${gradId})`} strokeWidth="10"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round" filter="url(#glow)"
            style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.34,1.56,.64,1)' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black tabular-nums dash-text-primary">{clamp}</span>
          <span className="text-[10px] font-medium dash-text-muted uppercase tracking-widest">/ 100</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${clamp >= 75 ? 'bg-green-500' : clamp >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} />
        <span className={`text-xs font-bold tracking-wide ${clamp >= 75 ? 'text-green-600 dark:text-green-400' : clamp >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
          {status}
        </span>
      </div>
    </div>
  )
}

/* ── Mini Sparkline Bars ──────────────────────────────────────────── */
function SparkBars({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1)
  return (
    <div className="flex items-end gap-[3px] h-9 mt-auto">
      {data.map((v, i) => (
        <div key={i} className="flex-1 rounded-sm transition-all duration-500"
          style={{
            height: `${Math.max(8, (v / max) * 100)}%`,
            background: color,
            opacity: 0.3 + (i / data.length) * 0.7,
          }} />
      ))}
    </div>
  )
}

/* ── Custom Chart Tooltip ─────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="dash-tooltip">
      <p className="text-xs font-semibold dash-text-primary mb-1.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.stroke }} />
          <span className="dash-text-secondary">{p.name}:</span>
          <span className="font-bold dash-text-primary tabular-nums">₹{p.value}k</span>
        </div>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN DASHBOARD
   ═══════════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const { data: rawRevenue } = useRevenue()
  const { data: repairsData } = useRepairs()
  const { data: txData } = useTransactions()
  const { data: stats } = useAnalyticsDashboard()
  const { data: rawTopProducts } = useTopProducts()

  const topProducts: any[] = Array.isArray(rawTopProducts) ? rawTopProducts : []
  const s = stats as any
  const revenueArr: any[] = Array.isArray(rawRevenue) ? rawRevenue : []
  const repairs: RepairTicket[] = ((repairsData?.data ?? []) as RepairTicket[])
    .filter(r => r.status !== 'DELIVERED' && r.status !== 'CANCELLED').slice(0, 5)
  const transactions: AppTransaction[] = (txData?.data ?? []) as AppTransaction[]

  const chartData = revenueArr.slice(-14).map((d: any) => ({
    date: new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    revenue: Math.round((d.revenue ?? 0) / 1000),
    profit: Math.round((d.profit ?? 0) / 1000),
  }))

  const sparkData = revenueArr.slice(-7).map((d: any) => Math.round((d.revenue ?? 0) / 1000))
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  /* ── Health Score ── */
  const healthScore = useMemo(() => {
    let score = 60
    if ((s?.todayRevenue ?? 0) > 0) score += 10
    if ((s?.activeRepairs ?? 0) < 5) score += 10
    if ((s?.lowStockCount ?? 0) === 0) score += 10
    if ((s?.totalCustomers ?? 0) > 10) score += 10
    return Math.min(100, score)
  }, [s])

  /* ── Activity Feed ── */
  const activityFeed = useMemo(() => {
    const items: any[] = []
    repairs.slice(0, 3).forEach(r => items.push({
      type: 'repair', id: r.id, icon: Wrench,
      iconBg: 'bg-blue-100 dark:bg-blue-500/10',
      iconColor: 'text-blue-600 dark:text-blue-400',
      label: `${r.deviceBrand} ${r.deviceModel}`,
      sub: r.ticketNumber,
      badge: r.status.replace('_', ' '),
      badgeColor: getRepairStatusColor(r.status),
      time: r.createdAt
    }))
    transactions.slice(0, 4).forEach(t => items.push({
      type: 'tx', id: t.id,
      icon: t.type === 'INCOME' ? TrendingUp : TrendingDown,
      iconBg: t.type === 'INCOME' ? 'bg-green-100 dark:bg-green-500/10' : 'bg-red-100 dark:bg-red-500/10',
      iconColor: t.type === 'INCOME' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
      label: t.description, sub: t.category,
      amount: t.amount, txType: t.type, time: t.createdAt
    }))
    return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 8)
  }, [repairs, transactions])

  /* ── KPI definitions ── */
  const kpis = [
    {
      label: "Today's Revenue", value: formatCurrency(s?.todayRevenue ?? 0),
      sub: `${s?.todaySalesCount ?? 0} sales today`,
      icon: TrendingUp, growth: 18.6,
      accent: 'linear-gradient(90deg, #22c55e, #4ade80)',
      iconBg: 'bg-green-100 dark:bg-green-500/10',
      iconColor: 'text-green-600 dark:text-green-400',
      href: '/dashboard/finance', spark: sparkData, sparkColor: '#22c55e'
    },
    {
      label: 'Active Repairs', value: String(s?.activeRepairs ?? 0),
      sub: 'In progress',
      icon: Wrench, growth: null,
      accent: 'linear-gradient(90deg, #06b6d4, #22d3ee)',
      iconBg: 'bg-cyan-100 dark:bg-cyan-500/10',
      iconColor: 'text-cyan-600 dark:text-cyan-400',
      href: '/dashboard/repairs', spark: [], sparkColor: '#06b6d4'
    },
    {
      label: 'Total Customers', value: String(s?.totalCustomers ?? 0),
      sub: 'Registered',
      icon: Users, growth: 12.4,
      accent: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
      iconBg: 'bg-violet-100 dark:bg-violet-500/10',
      iconColor: 'text-violet-600 dark:text-violet-400',
      href: '/dashboard/customers', spark: [], sparkColor: '#7c3aed'
    },
    {
      label: 'Low Stock Items', value: String(s?.lowStockCount ?? 0),
      sub: 'Need reorder',
      icon: AlertTriangle, growth: null,
      accent: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
      iconBg: 'bg-amber-100 dark:bg-amber-500/10',
      iconColor: 'text-amber-600 dark:text-amber-400',
      href: '/dashboard/inventory', spark: [], sparkColor: '#f59e0b'
    },
  ]

  /* ── Quick actions ── */
  const actions = [
    { href: '/dashboard/pos', icon: ShoppingCart, label: 'New Sale', sub: 'Create invoice',
      bg: 'bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-600/15 dark:to-purple-900/10',
      border: 'border-violet-200/60 dark:border-violet-500/20',
      iconBg: 'bg-violet-500', iconColor: 'text-white' },
    { href: '/dashboard/repairs', icon: Wrench, label: 'New Repair', sub: 'Create ticket',
      bg: 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-600/15 dark:to-cyan-900/10',
      border: 'border-blue-200/60 dark:border-blue-500/20',
      iconBg: 'bg-blue-500', iconColor: 'text-white' },
    { href: '/dashboard/customers', icon: Users, label: 'Add Customer', sub: 'Register new',
      bg: 'bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-600/15 dark:to-teal-900/10',
      border: 'border-cyan-200/60 dark:border-cyan-500/20',
      iconBg: 'bg-cyan-500', iconColor: 'text-white' },
    { href: '/dashboard/inventory', icon: Package, label: 'Add Product', sub: 'Update stock',
      bg: 'bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-600/15 dark:to-green-900/10',
      border: 'border-emerald-200/60 dark:border-emerald-500/20',
      iconBg: 'bg-emerald-500', iconColor: 'text-white' },
  ]

  /* ── Chart colors ── */
  const chartColors = {
    revenue: { stroke: '#7c3aed', gradStart: isDark ? 'rgba(124,58,237,0.35)' : 'rgba(124,58,237,0.2)', gradEnd: 'rgba(124,58,237,0.02)' },
    profit: { stroke: '#06b6d4', gradStart: isDark ? 'rgba(6,182,212,0.3)' : 'rgba(6,182,212,0.15)', gradEnd: 'rgba(6,182,212,0.02)' },
    grid: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.06)',
    axis: isDark ? '#475569' : '#94a3b8',
  }

  return (
    <div className="dash-bg min-h-full -m-4 lg:-m-6 p-4 lg:p-6">
      <div className="max-w-[1400px] mx-auto space-y-5">

        {/* ═══ HEADER ═══════════════════════════════════════════════════ */}
        <div className="dash-fade-1 flex flex-col sm:flex-row sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <h1 className="text-2xl font-extrabold tracking-tight dash-text-primary">Dashboard</h1>
              <span className="live-dot" />
            </div>
            <p className="text-sm dash-text-secondary">
              {today} · <span className="dash-text-muted">Live overview</span>
            </p>
          </div>
          <div className="flex gap-2.5 sm:ml-auto">
            <Link href="/dashboard/repairs" className="btn-secondary text-sm flex items-center gap-2 !rounded-xl !px-4 !py-2">
              <Wrench size={14} />New Repair
            </Link>
            <Link href="/dashboard/pos" className="btn-primary text-sm flex items-center gap-2 !rounded-xl !px-4 !py-2">
              <ShoppingCart size={15} />New Sale
            </Link>
          </div>
        </div>

        {/* ═══ KPI CARDS + HEALTH SCORE ═════════════════════════════════ */}
        <div className="dash-fade-2 grid grid-cols-2 xl:grid-cols-5 gap-3">
          {kpis.map((kpi, i) => (
            <Link key={kpi.label} href={kpi.href}
              className="dash-card dash-kpi p-4 group cursor-pointer"
              style={{ '--kpi-accent': kpi.accent } as React.CSSProperties}>
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl ${kpi.iconBg} flex items-center justify-center`}>
                  <kpi.icon size={16} className={kpi.iconColor} />
                </div>
                <div className="flex items-center gap-1.5">
                  {kpi.growth !== null && (
                    <span className={`flex items-center gap-0.5 text-[11px] font-bold tabular-nums ${kpi.growth >= 0 ? 'growth-up' : 'growth-down'}`}>
                      {kpi.growth >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                      {Math.abs(kpi.growth)}%
                    </span>
                  )}
                  <ArrowRight size={12} className="dash-text-muted opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
              <p className="text-xl font-extrabold tabular-nums dash-text-primary mb-0.5 tracking-tight">{kpi.value}</p>
              <p className="text-[11px] font-medium dash-text-secondary">{kpi.label}</p>
              <p className="text-[10px] dash-text-muted mb-1">{kpi.sub}</p>
              {kpi.spark.length > 0 ? (
                <SparkBars data={kpi.spark} color={kpi.sparkColor} />
              ) : (
                <div className="h-1 rounded-full mt-auto overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
                  <div className="h-full rounded-full" style={{ width: '60%', background: kpi.accent }} />
                </div>
              )}
            </Link>
          ))}

          {/* Business Health Score */}
          <div className="dash-card p-5 flex flex-col items-center justify-center gap-1 xl:col-span-1 col-span-2
                          bg-gradient-to-br from-violet-50/80 to-purple-50/40 dark:from-violet-600/8 dark:to-purple-900/5
                          border-violet-200/40 dark:border-violet-500/15">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity size={13} className="text-violet-500 dark:text-violet-400" />
              <span className="text-[11px] font-bold dash-text-secondary uppercase tracking-wider">Business Health</span>
            </div>
            <HealthRing score={healthScore} />
            <div className="flex gap-4 mt-1">
              {[{ v: s?.todaySalesCount ?? 0, l: 'Sales' }, { v: s?.activeRepairs ?? 0, l: 'Repairs' }].map(i => (
                <div key={i.l} className="text-center">
                  <p className="text-sm font-bold dash-text-primary tabular-nums">{i.v}</p>
                  <p className="text-[9px] dash-text-muted uppercase tracking-wider">{i.l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ QUICK ACTIONS ═══════════════════════════════════════════ */}
        <div className="dash-fade-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {actions.map(a => (
            <Link key={a.href} href={a.href}
              className={`dash-action p-3.5 rounded-2xl ${a.bg} border ${a.border} flex items-center gap-3`}>
              <div className={`w-9 h-9 rounded-xl ${a.iconBg} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                <a.icon size={16} className={a.iconColor} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold dash-text-primary truncate">{a.label}</p>
                <p className="text-[11px] dash-text-muted truncate">{a.sub}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* ═══ CHART + TOP PRODUCTS ═══════════════════════════════════ */}
        <div className="dash-fade-4 grid lg:grid-cols-3 gap-4">
          {/* Revenue Chart */}
          <div className="lg:col-span-2 dash-card p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-bold dash-text-primary flex items-center gap-2">
                  <BarChart2 size={15} className="text-violet-500 dark:text-violet-400" />
                  Revenue & Profit
                </h3>
                <p className="text-[11px] dash-text-muted mt-0.5">Last 14 days · ₹ thousands</p>
              </div>
              <div className="flex items-center gap-4 text-[11px]">
                <span className="flex items-center gap-1.5 dash-text-secondary">
                  <span className="w-2 h-2 rounded-full bg-violet-500" />Revenue
                </span>
                <span className="flex items-center gap-1.5 dash-text-secondary">
                  <span className="w-2 h-2 rounded-full bg-cyan-500" />Profit
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGradDash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColors.revenue.stroke} stopOpacity={isDark ? 0.35 : 0.2} />
                    <stop offset="100%" stopColor={chartColors.revenue.stroke} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="profGradDash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColors.profit.stroke} stopOpacity={isDark ? 0.3 : 0.15} />
                    <stop offset="100%" stopColor={chartColors.profit.stroke} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                <XAxis dataKey="date"
                  tick={{ fontSize: 10, fill: chartColors.axis }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10, fill: chartColors.axis }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: isDark ? 'rgba(124,58,237,0.2)' : 'rgba(124,58,237,0.1)' }} />
                <Area type="monotone" dataKey="revenue" stroke={chartColors.revenue.stroke}
                  strokeWidth={2.5} fill="url(#revGradDash)" name="Revenue"
                  dot={false} activeDot={{ r: 5, fill: chartColors.revenue.stroke, stroke: isDark ? '#0B1120' : '#fff', strokeWidth: 2.5 }} />
                <Area type="monotone" dataKey="profit" stroke={chartColors.profit.stroke}
                  strokeWidth={2} fill="url(#profGradDash)" name="Profit"
                  dot={false} activeDot={{ r: 5, fill: chartColors.profit.stroke, stroke: isDark ? '#0B1120' : '#fff', strokeWidth: 2.5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Top Products */}
          <div className="dash-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold dash-text-primary flex items-center gap-2">
                <Star size={14} className="text-amber-500 dark:text-amber-400" />Top Products
              </h3>
              <Link href="/dashboard/inventory" className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors">
                View all
              </Link>
            </div>
            <div className="space-y-3">
              {topProducts.length > 0 ? topProducts.slice(0, 5).map((p: any, i: number) => (
                <div key={p.productId ?? i} className="flex items-center gap-3">
                  <span className={`text-[10px] font-black w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0
                    ${i === 0 ? 'rank-gold' : i === 1 ? 'rank-silver' : i === 2 ? 'rank-bronze' : 'bg-slate-100 dark:bg-white/5 dash-text-muted'}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium dash-text-primary truncate">{p.productName ?? 'Unknown'}</p>
                    <div className="h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min(100, ((p.totalQty ?? 1) / ((topProducts[0] as any)?.totalQty ?? 1)) * 100)}%`,
                          background: 'linear-gradient(90deg, #7c3aed, #06b6d4)'
                        }} />
                    </div>
                  </div>
                  <span className="text-[11px] font-bold dash-text-secondary flex-shrink-0 tabular-nums">
                    {p.totalQty ?? 0}
                  </span>
                </div>
              )) : (
                <div className="py-8 text-center flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-violet-100 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 flex items-center justify-center">
                    <BarChart2 size={22} className="text-violet-500 dark:text-violet-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium dash-text-primary">No sales data yet</p>
                    <p className="text-[11px] dash-text-muted mt-0.5">Make your first sale to see top products</p>
                  </div>
                  <Link href="/dashboard/pos" className="text-[11px] font-medium text-violet-600 dark:text-violet-400 flex items-center gap-1">
                    Go to POS <ArrowRight size={10} />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ ACTIVITY FEED + ALERTS ═════════════════════════════════ */}
        <div className="dash-fade-5 grid lg:grid-cols-3 gap-4">
          {/* Live Activity Feed */}
          <div className="lg:col-span-2 dash-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold dash-text-primary flex items-center gap-2">
                <Zap size={14} className="text-violet-500 dark:text-violet-400" />
                Activity Feed
              </h3>
              <span className="dash-live-badge">
                <span className="live-dot" style={{ width: 6, height: 6 }} />
                Live
              </span>
            </div>
            <div className="space-y-2">
              {activityFeed.length > 0 ? activityFeed.map((item: any, i: number) => (
                <div key={`${item.id}-${i}`}
                  className="flex items-center gap-3 p-3 rounded-xl
                             bg-slate-50/60 dark:bg-white/[0.02]
                             border border-slate-200/50 dark:border-white/5
                             hover:border-violet-300/40 dark:hover:border-violet-500/20
                             transition-all group">
                  <div className={`w-8 h-8 rounded-lg ${item.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <item.icon size={14} className={item.iconColor} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium dash-text-primary truncate">{item.label}</p>
                    <p className="text-[10px] dash-text-muted">{item.sub}</p>
                  </div>
                  {item.type === 'tx' ? (
                    <span className={`text-xs font-bold tabular-nums ${item.txType === 'INCOME' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {item.txType === 'INCOME' ? '+' : '-'}{formatCurrency(item.amount)}
                    </span>
                  ) : (
                    <span className={`badge-status border text-[10px] ${item.badgeColor}`}>{item.badge}</span>
                  )}
                  <span className="text-[10px] dash-text-muted hidden sm:block flex-shrink-0 w-14 text-right tabular-nums">
                    {formatRelativeTime(item.time)}
                  </span>
                </div>
              )) : (
                <div className="py-10 text-center flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-violet-100 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 flex items-center justify-center">
                    <Zap size={22} className="text-violet-500 dark:text-violet-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium dash-text-primary">No activity yet today</p>
                    <p className="text-[11px] dash-text-muted mt-0.5">Sales and repairs will appear here in real-time</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Alert Cards */}
          <div className="space-y-3">
            {/* Low Stock */}
            <div className="dash-card dash-alert p-4
                            bg-gradient-to-br from-amber-50/80 to-yellow-50/40 dark:from-amber-500/8 dark:to-yellow-900/5
                            border-amber-200/50 dark:border-yellow-500/15">
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/25 flex items-center justify-center">
                  <Package size={14} className="text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300">Low Stock</span>
              </div>
              <p className="text-2xl font-black dash-text-primary tabular-nums mb-1">{s?.lowStockCount ?? 0}</p>
              <p className="text-[11px] dash-text-muted leading-relaxed">
                {(s?.lowStockProducts ?? []).length === 0
                  ? 'All products stocked ✓'
                  : (s.lowStockProducts as any[]).slice(0, 2).map((p: any) => p.name).join(', ')}
              </p>
              <Link href="/dashboard/inventory" className="text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 mt-2 inline-flex items-center gap-1 transition-colors">
                View inventory <ArrowRight size={10} />
              </Link>
            </div>

            {/* Warranty Expiring */}
            <div className="dash-card dash-alert p-4
                            bg-gradient-to-br from-orange-50/80 to-red-50/40 dark:from-orange-500/8 dark:to-red-900/5
                            border-orange-200/50 dark:border-orange-500/15">
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-500/15 border border-orange-200 dark:border-orange-500/25 flex items-center justify-center">
                  <Shield size={14} className="text-orange-600 dark:text-orange-400" />
                </div>
                <span className="text-xs font-bold text-orange-700 dark:text-orange-300">Warranty Expiring</span>
              </div>
              <p className="text-2xl font-black dash-text-primary tabular-nums mb-1">{s?.expiringWarranties ?? 0}</p>
              <p className="text-[11px] dash-text-muted">
                {(s?.expiringWarranties ?? 0) === 0 ? 'No expiries within 30 days ✓' : 'Expiring within 30 days'}
              </p>
              <Link href="/dashboard/warranty" className="text-[11px] font-medium text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 mt-2 inline-flex items-center gap-1 transition-colors">
                View warranties <ArrowRight size={10} />
              </Link>
            </div>

            {/* Ready for Pickup */}
            <div className="dash-card dash-alert p-4
                            bg-gradient-to-br from-blue-50/80 to-indigo-50/40 dark:from-blue-500/8 dark:to-indigo-900/5
                            border-blue-200/50 dark:border-blue-500/15">
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/25 flex items-center justify-center">
                  <Wrench size={14} className="text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-xs font-bold text-blue-700 dark:text-blue-300">Ready for Pickup</span>
              </div>
              <p className="text-2xl font-black dash-text-primary tabular-nums mb-1">{s?.readyForPickup ?? 0}</p>
              <p className="text-[11px] dash-text-muted">
                {(s?.readyForPickup ?? 0) === 0 ? 'No devices waiting ✓' : 'Repair jobs done, awaiting pickup'}
              </p>
              <Link href="/dashboard/repairs" className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mt-2 inline-flex items-center gap-1 transition-colors">
                View repairs <ArrowRight size={10} />
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
