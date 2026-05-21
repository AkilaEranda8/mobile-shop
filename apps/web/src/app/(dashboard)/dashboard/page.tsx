'use client'

import { useMemo } from 'react'
import {
  TrendingUp, TrendingDown, ShoppingCart, Users, Wrench,
  AlertTriangle, Package, Shield, ArrowRight, Zap,
  BarChart2, Activity, Star, ArrowUpRight,
  CheckCircle2, Box
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

/* ─────────────────────────────────────────────────────────────────────
   HEALTH RING
   ───────────────────────────────────────────────────────────────────── */
function HealthRing({ score }: { score: number }) {
  const clamp  = Math.min(100, Math.max(0, score))
  const r      = 48, circ = 2 * Math.PI * r
  const offset = circ - (clamp / 100) * circ
  const color  = clamp >= 75 ? '#22c55e' : clamp >= 50 ? '#f59e0b' : '#ef4444'
  const label  = clamp >= 75 ? 'Excellent' : clamp >= 50 ? 'Good' : 'Warning'
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 110 110" className="w-full h-full -rotate-90">
          <defs>
            <filter id="hglow"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>
          <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="9"/>
          <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="9"
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            filter="url(#hglow)"
            style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.34,1.56,.64,1)' }}/>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[28px] font-black tabular-nums leading-none" style={{ color }}>{clamp}</span>
          <span className="text-[9px] text-slate-500 uppercase tracking-widest mt-0.5">/ 100</span>
        </div>
      </div>
      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
        style={{ color, background: `${color}18`, border: `1px solid ${color}30` }}>{label}</span>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────
   SPARK BARS
   ───────────────────────────────────────────────────────────────────── */
function SparkBars({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1)
  return (
    <div className="flex items-end gap-0.5 h-8">
      {data.map((v, i) => (
        <div key={i} className="flex-1 rounded-[3px]"
          style={{ height: `${Math.max(10, (v / max) * 100)}%`, background: color, opacity: 0.25 + (i / data.length) * 0.75 }} />
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────
   CHART TOOLTIP
   ───────────────────────────────────────────────────────────────────── */
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900/95 dark:bg-[#0d1117]/95 border border-violet-500/20 rounded-xl p-3 shadow-2xl backdrop-blur-sm min-w-[130px]">
      <p className="text-[11px] font-semibold text-slate-300 mb-2">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs mb-1 last:mb-0">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.stroke }}/>
          <span className="text-slate-400">{p.name}</span>
          <span className="font-bold text-white tabular-nums ml-auto">₹{p.value}k</span>
        </div>
      ))}
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════════
   MAIN DASHBOARD
   ═════════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme !== 'light'

  /* ── Data hooks ── */
  const { data: rawRevenue }    = useRevenue()
  const { data: repairsData }   = useRepairs()
  const { data: txData }        = useTransactions()
  const { data: stats }         = useAnalyticsDashboard()
  const { data: rawTopProducts }= useTopProducts()

  const topProducts: any[]         = Array.isArray(rawTopProducts) ? rawTopProducts : []
  const s                          = stats as any
  const revenueArr: any[]          = Array.isArray(rawRevenue) ? rawRevenue : []
  const repairs: RepairTicket[]    = ((repairsData?.data ?? []) as RepairTicket[]).filter(r => r.status !== 'DELIVERED' && r.status !== 'CANCELLED').slice(0, 5)
  const transactions: AppTransaction[] = (txData?.data ?? []) as AppTransaction[]

  const chartData  = revenueArr.slice(-14).map((d: any) => ({
    date:    new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    revenue: Math.round((d.revenue ?? 0) / 1000),
    profit:  Math.round((d.profit  ?? 0) / 1000),
  }))
  const sparkData  = revenueArr.slice(-7).map((d: any) => Math.round((d.revenue ?? 0) / 1000))
  const today      = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
  const gridColor  = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.06)'
  const axisColor  = isDark ? '#475569' : '#94a3b8'

  /* ── Health score ── */
  const healthScore = useMemo(() => {
    let sc = 55
    if ((s?.todayRevenue    ?? 0) > 0)  sc += 12
    if ((s?.activeRepairs   ?? 0) < 5)  sc += 11
    if ((s?.lowStockCount   ?? 0) === 0) sc += 11
    if ((s?.totalCustomers  ?? 0) > 10) sc += 11
    return Math.min(100, sc)
  }, [s])

  /* ── Activity feed ── */
  const activityFeed = useMemo(() => {
    const items: any[] = []
    repairs.slice(0, 3).forEach(r => items.push({
      type: 'repair', id: r.id, icon: Wrench,
      iconBg: 'bg-blue-500/10', iconColor: 'text-blue-400',
      label: `${r.deviceBrand} ${r.deviceModel}`, sub: r.ticketNumber,
      badge: r.status.replace('_', ' '), badgeColor: getRepairStatusColor(r.status),
      time: r.createdAt,
    }))
    transactions.slice(0, 5).forEach(t => items.push({
      type: 'tx', id: t.id,
      icon: t.type === 'INCOME' ? TrendingUp : TrendingDown,
      iconBg:    t.type === 'INCOME' ? 'bg-green-500/10' : 'bg-red-500/10',
      iconColor: t.type === 'INCOME' ? 'text-green-400'  : 'text-red-400',
      label: t.description, sub: t.category,
      amount: t.amount, txType: t.type, time: t.createdAt,
    }))
    return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 8)
  }, [repairs, transactions])

  /* ── KPI rows ── */
  const kpis = [
    { label: "Today's Revenue", value: formatCurrency(s?.todayRevenue ?? 0), sub: `${s?.todaySalesCount ?? 0} sales`, icon: TrendingUp, color: '#22c55e', href: '/dashboard/finance',   spark: sparkData },
    { label: 'Active Repairs',  value: String(s?.activeRepairs ?? 0),         sub: 'In progress',                     icon: Wrench,      color: '#06b6d4', href: '/dashboard/repairs',   spark: [] },
    { label: 'Customers',       value: String(s?.totalCustomers ?? 0),         sub: 'Registered',                      icon: Users,       color: '#7c3aed', href: '/dashboard/customers', spark: [] },
    { label: 'Low Stock',       value: String(s?.lowStockCount ?? 0),          sub: 'Need reorder',                    icon: AlertTriangle,color: '#f59e0b',href: '/dashboard/inventory', spark: [] },
  ]

  return (
    <div className="space-y-5">

      {/* ══════════ HEADER ══════════ */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-2xl font-black tracking-tight text-white">Dashboard</h1>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
              <span className="live-dot" style={{ width: 5, height: 5, minWidth: 5 }} />Live
            </span>
          </div>
          <p className="text-sm text-slate-500">{today}</p>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <Link href="/dashboard/repairs" className="btn-secondary text-sm flex items-center gap-2">
            <Wrench size={14} />New Repair
          </Link>
          <Link href="/dashboard/pos" className="btn-primary text-sm flex items-center gap-2">
            <ShoppingCart size={15} />New Sale
          </Link>
        </div>
      </div>

      {/* ══════════ KPI STRIP + HEALTH ══════════ */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">

        {kpis.map(k => (
          <Link key={k.label} href={k.href}
            className="group relative overflow-hidden rounded-2xl bg-[#0f1623] border border-white/[0.07] hover:border-white/[0.14] transition-all duration-200 p-4 flex flex-col gap-2"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
            {/* coloured top stripe */}
            <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl opacity-80" style={{ background: `linear-gradient(90deg, ${k.color}cc, ${k.color}44)` }} />
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${k.color}18` }}>
                <k.icon size={15} style={{ color: k.color }} />
              </div>
              <ArrowUpRight size={13} className="text-slate-700 group-hover:text-slate-400 transition-colors" />
            </div>
            <div>
              <p className="text-[22px] font-black tabular-nums text-white leading-tight">{k.value}</p>
              <p className="text-[11px] font-medium text-slate-400 mt-0.5">{k.label}</p>
              <p className="text-[10px] text-slate-600">{k.sub}</p>
            </div>
            {k.spark.length > 0 ? (
              <SparkBars data={k.spark} color={k.color} />
            ) : (
              <div className="h-0.5 rounded-full w-full overflow-hidden bg-white/5">
                <div className="h-full rounded-full w-3/5" style={{ background: `linear-gradient(90deg, ${k.color}aa, ${k.color}33)` }} />
              </div>
            )}
          </Link>
        ))}

        {/* Business Health Score */}
        <div className="col-span-2 xl:col-span-1 relative overflow-hidden rounded-2xl border border-violet-500/15 flex flex-col items-center justify-center gap-3 p-5"
          style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.1) 0%, rgba(6,182,212,0.04) 100%)', boxShadow: '0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(124,58,237,0.1)' }}>
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'radial-gradient(circle, #7c3aed 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div className="flex items-center gap-1.5 relative z-10">
            <Activity size={12} className="text-violet-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Business Health</span>
          </div>
          <div className="relative z-10">
            <HealthRing score={healthScore} />
          </div>
          <div className="flex gap-5 relative z-10">
            {[{ v: s?.todaySalesCount ?? 0, l: 'Sales' }, { v: s?.activeRepairs ?? 0, l: 'Repairs' }].map(item => (
              <div key={item.l} className="text-center">
                <p className="text-sm font-black text-white tabular-nums">{item.v}</p>
                <p className="text-[9px] text-slate-600 uppercase tracking-wider">{item.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════ QUICK ACTIONS ══════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { href: '/dashboard/pos',       icon: ShoppingCart, label: 'New Sale',     sub: 'Open POS',        color: '#7c3aed' },
          { href: '/dashboard/repairs',   icon: Wrench,       label: 'New Repair',   sub: 'Create ticket',   color: '#06b6d4' },
          { href: '/dashboard/customers', icon: Users,        label: 'Add Customer', sub: 'Register new',    color: '#10b981' },
          { href: '/dashboard/inventory', icon: Box,          label: 'Add Product',  sub: 'Update stock',    color: '#f59e0b' },
        ].map(a => (
          <Link key={a.href} href={a.href}
            className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.07] hover:border-white/[0.14] transition-all duration-150 active:scale-[0.97] group"
            style={{ background: 'rgba(255,255,255,0.025)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
              style={{ background: `${a.color}22`, border: `1px solid ${a.color}30` }}>
              <a.icon size={15} style={{ color: a.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{a.label}</p>
              <p className="text-[10px] text-slate-600 truncate">{a.sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ══════════ CHART + TOP PRODUCTS ══════════ */}
      <div className="grid lg:grid-cols-3 gap-4">

        {/* Revenue Chart */}
        <div className="lg:col-span-2 rounded-2xl border border-white/[0.07] p-5"
          style={{ background: '#0f1623', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart2 size={14} className="text-violet-400" />Revenue & Profit
              </h3>
              <p className="text-[11px] text-slate-600 mt-0.5">Last 14 days · ₹ thousands</p>
            </div>
            <div className="flex items-center gap-3">
              {[{ label: 'Revenue', color: '#7c3aed' }, { label: 'Profit', color: '#06b6d4' }].map(l => (
                <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="dRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#7c3aed" stopOpacity={0.45}/>
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.01}/>
                </linearGradient>
                <linearGradient id="dProfGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#06b6d4" stopOpacity={0.35}/>
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.01}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke={gridColor} vertical={false}/>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
              <YAxis tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false}/>
              <Tooltip content={<ChartTip />} cursor={{ stroke: 'rgba(124,58,237,0.15)', strokeWidth: 1 }}/>
              <Area type="monotone" dataKey="revenue" stroke="#7c3aed" strokeWidth={2.5}
                fill="url(#dRevGrad)" name="Revenue" dot={false}
                activeDot={{ r: 5, fill: '#7c3aed', stroke: '#0f1623', strokeWidth: 2.5 }}/>
              <Area type="monotone" dataKey="profit"  stroke="#06b6d4" strokeWidth={2}
                fill="url(#dProfGrad)" name="Profit" dot={false}
                activeDot={{ r: 5, fill: '#06b6d4', stroke: '#0f1623', strokeWidth: 2.5 }}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top Products */}
        <div className="rounded-2xl border border-white/[0.07] p-5"
          style={{ background: '#0f1623', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Star size={13} className="text-amber-400" />Top Products
            </h3>
            <Link href="/dashboard/inventory" className="text-[11px] text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-0.5">
              View all <ArrowRight size={10} />
            </Link>
          </div>
          {topProducts.length > 0 ? (
            <div className="space-y-3.5">
              {topProducts.slice(0, 5).map((p: any, i: number) => {
                const pct = Math.min(100, ((p.totalQty ?? 1) / ((topProducts[0] as any)?.totalQty ?? 1)) * 100)
                const rankColor = i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : '#334155'
                return (
                  <div key={p.productId ?? i} className="flex items-center gap-2.5">
                    <span className="text-[10px] font-black w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ background: `${rankColor}22`, color: rankColor }}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-300 truncate mb-1">{p.productName ?? 'Unknown'}</p>
                      <div className="h-1.5 rounded-full overflow-hidden bg-white/[0.05]">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #7c3aed, #06b6d4)' }}/>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-slate-500 tabular-nums flex-shrink-0">{p.totalQty ?? 0}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <BarChart2 size={20} className="text-violet-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400">No sales yet</p>
                <p className="text-[11px] text-slate-600 mt-0.5">Top sellers will show here</p>
              </div>
              <Link href="/dashboard/pos" className="text-[11px] text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors">
                Open POS <ArrowRight size={10} />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ══════════ ACTIVITY FEED + ALERTS ══════════ */}
      <div className="grid lg:grid-cols-3 gap-4 pb-2">

        {/* Activity Feed */}
        <div className="lg:col-span-2 rounded-2xl border border-white/[0.07] p-5"
          style={{ background: '#0f1623', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap size={14} className="text-violet-400" />Activity Feed
            </h3>
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
              <span className="live-dot" style={{ width: 5, height: 5, minWidth: 5 }} />Live
            </span>
          </div>

          {activityFeed.length > 0 ? (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-px bg-white/[0.04]" />
              <div className="space-y-1">
                {activityFeed.map((item: any, i: number) => (
                  <div key={`${item.id}-${i}`}
                    className="relative flex items-center gap-3 p-2.5 pl-3 rounded-xl hover:bg-white/[0.03] transition-colors group cursor-default">
                    {/* Timeline dot */}
                    <div className={`relative z-10 w-8 h-8 rounded-xl ${item.iconBg} flex items-center justify-center flex-shrink-0 ring-1 ring-black/20`}>
                      <item.icon size={13} className={item.iconColor} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-200 truncate">{item.label}</p>
                      <p className="text-[10px] text-slate-600">{item.sub}</p>
                    </div>
                    {item.type === 'tx' ? (
                      <span className={`text-xs font-bold tabular-nums flex-shrink-0 ${item.txType === 'INCOME' ? 'text-green-400' : 'text-red-400'}`}>
                        {item.txType === 'INCOME' ? '+' : '−'}{formatCurrency(item.amount)}
                      </span>
                    ) : (
                      <span className={`badge-status border text-[10px] flex-shrink-0 ${item.badgeColor}`}>{item.badge}</span>
                    )}
                    <span className="text-[10px] text-slate-700 group-hover:text-slate-500 transition-colors flex-shrink-0 w-12 text-right tabular-nums hidden sm:block">
                      {formatRelativeTime(item.time)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-violet-500/8 border border-violet-500/15 flex items-center justify-center"
                style={{ backgroundImage: 'radial-gradient(circle, rgba(124,58,237,0.1) 1px, transparent 1px)', backgroundSize: '12px 12px' }}>
                <Zap size={22} className="text-violet-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400">No activity yet</p>
                <p className="text-[11px] text-slate-600 mt-0.5">Sales and repairs appear here in real-time</p>
              </div>
            </div>
          )}
        </div>

        {/* Alert stack */}
        <div className="space-y-3">
          {[
            {
              icon: Package,    label: 'Low Stock',
              value: s?.lowStockCount ?? 0,
              detail: (s?.lowStockProducts ?? []).length === 0 ? 'All stocked ✓' : (s?.lowStockProducts as any[] ?? []).slice(0, 2).map((p: any) => p.name).join(', '),
              color: '#f59e0b', href: '/dashboard/inventory',  linkLabel: 'View inventory',
            },
            {
              icon: Shield,     label: 'Warranty Expiring',
              value: s?.expiringWarranties ?? 0,
              detail: (s?.expiringWarranties ?? 0) === 0 ? 'No expiries within 30 days ✓' : 'Expiring within 30 days',
              color: '#f97316', href: '/dashboard/warranty',   linkLabel: 'View warranties',
            },
            {
              icon: CheckCircle2, label: 'Ready for Pickup',
              value: s?.readyForPickup ?? 0,
              detail: (s?.readyForPickup ?? 0) === 0 ? 'No devices waiting ✓' : 'Completed, awaiting pickup',
              color: '#06b6d4', href: '/dashboard/repairs',    linkLabel: 'View repairs',
            },
          ].map(card => (
            <div key={card.label}
              className="relative overflow-hidden rounded-2xl border p-4 transition-all"
              style={{
                background: `linear-gradient(135deg, ${card.color}0a 0%, transparent 60%)`,
                borderColor: `${card.color}20`,
                boxShadow: `0 1px 3px rgba(0,0,0,0.4), inset 0 0 0 1px ${card.color}08`,
              }}>
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-[0.04] -translate-y-8 translate-x-8"
                style={{ background: card.color, filter: 'blur(20px)' }} />
              <div className="flex items-center gap-2.5 mb-3 relative z-10">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: `${card.color}15`, border: `1px solid ${card.color}25` }}>
                  <card.icon size={14} style={{ color: card.color }} />
                </div>
                <span className="text-xs font-bold" style={{ color: card.color }}>{card.label}</span>
              </div>
              <p className="text-3xl font-black text-white tabular-nums mb-1 relative z-10">{card.value}</p>
              <p className="text-[11px] text-slate-500 leading-relaxed mb-2 relative z-10">{card.detail}</p>
              <Link href={card.href}
                className="text-[11px] font-medium inline-flex items-center gap-1 transition-colors relative z-10 hover:underline"
                style={{ color: card.color }}>
                {card.linkLabel} <ArrowRight size={10} />
              </Link>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
