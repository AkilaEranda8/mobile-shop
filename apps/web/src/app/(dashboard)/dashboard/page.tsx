'use client'

import { useMemo } from 'react'
import { TrendingUp, TrendingDown, ShoppingCart, Users, Wrench, AlertTriangle, Package, Shield, ArrowRight, Clock, Zap, BarChart2, Activity, Star } from 'lucide-react'
import Link from 'next/link'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { useRevenue, useRepairs, useTransactions, useAnalyticsDashboard, useTopProducts } from '@/lib/hooks'
import type { RepairTicket, Transaction as AppTransaction } from '@/types'
import { formatCurrency, formatRelativeTime, getRepairStatusColor } from '@/lib/utils'

/* ── Business Health Score ─────────────────────────────────────────── */
function HealthScore({ score }: { score: number }) {
  const clamp = Math.min(100, Math.max(0, score))
  const r = 45, circ = 2 * Math.PI * r
  const offset = circ - (clamp / 100) * circ
  const color = clamp >= 75 ? '#22c55e' : clamp >= 50 ? '#f59e0b' : '#ef4444'
  const label = clamp >= 75 ? 'Excellent' : clamp >= 50 ? 'Good' : 'Needs Attention'
  return (
    <div className="flex flex-col items-center justify-center gap-1">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
          <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.34,1.56,.64,1)' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black tabular-nums" style={{ color }}>{clamp}</span>
          <span className="text-[9px] text-slate-500 uppercase tracking-wide">/ 100</span>
        </div>
      </div>
      <span className="text-xs font-semibold" style={{ color }}>{label}</span>
    </div>
  )
}

/* ── Mini Spark Bar ────────────────────────────────────────────────── */
function SparkBar({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1)
  return (
    <div className="flex items-end gap-0.5 h-8">
      {data.map((v, i) => (
        <div key={i} className="flex-1 rounded-sm opacity-80 transition-all"
          style={{ height: `${(v / max) * 100}%`, background: color, minHeight: 2 }} />
      ))}
    </div>
  )
}

export default function DashboardPage() {
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

  /* ── Health Score: weighted from live metrics ── */
  const healthScore = useMemo(() => {
    let score = 60
    if ((s?.todayRevenue ?? 0) > 0) score += 10
    if ((s?.activeRepairs ?? 0) < 5) score += 10
    if ((s?.lowStockCount ?? 0) === 0) score += 10
    if ((s?.totalCustomers ?? 0) > 10) score += 10
    return Math.min(100, score)
  }, [s])

  /* ── Recent activity feed: merge repairs + transactions ── */
  const activityFeed = useMemo(() => {
    const items: any[] = []
    repairs.slice(0, 3).forEach(r => items.push({ type: 'repair', id: r.id, icon: Wrench, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', label: `${r.deviceBrand} ${r.deviceModel}`, sub: r.ticketNumber, badge: r.status.replace('_', ' '), badgeColor: getRepairStatusColor(r.status), time: r.createdAt }))
    transactions.slice(0, 4).forEach(t => items.push({ type: 'tx', id: t.id, icon: t.type === 'INCOME' ? TrendingUp : TrendingDown, color: t.type === 'INCOME' ? 'text-green-400 bg-green-500/10 border-green-500/20' : 'text-red-400 bg-red-500/10 border-red-500/20', label: t.description, sub: t.category, amount: t.amount, txType: t.type, time: t.createdAt }))
    return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 8)
  }, [repairs, transactions])

  return (
    <div className="space-y-5 animate-fade-up">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="page-title">Dashboard</h1>
            <span className="live-dot" />
          </div>
          <p className="page-subtitle">{today} · Live data</p>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <Link href="/dashboard/repairs" className="btn-secondary text-sm flex items-center gap-2"><Wrench size={14} />New Repair</Link>
          <Link href="/dashboard/pos" className="btn-primary text-sm flex items-center gap-2"><ShoppingCart size={15} />New Sale</Link>
        </div>
      </div>

      {/* ── Hero Row: KPIs + Health Score ── */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        {[
          { label: "Today's Revenue",  value: formatCurrency(s?.todayRevenue ?? 0),  sub: `${s?.todaySalesCount ?? 0} sales`,   icon: TrendingUp,    bar: 'kpi-bar-green',  href: '/dashboard/finance',   spark: sparkData },
          { label: 'Active Repairs',   value: String(s?.activeRepairs ?? 0),          sub: 'In progress',                        icon: Wrench,        bar: 'kpi-bar-cyan',   href: '/dashboard/repairs',   spark: [] },
          { label: 'Total Customers',  value: String(s?.totalCustomers ?? 0),         sub: 'Registered',                         icon: Users,         bar: 'kpi-bar-violet', href: '/dashboard/customers', spark: [] },
          { label: 'Low Stock',        value: String(s?.lowStockCount ?? 0),          sub: 'Items to reorder',                   icon: AlertTriangle, bar: 'kpi-bar-amber',  href: '/dashboard/inventory', spark: [] },
        ].map((stat) => (
          <Link key={stat.label} href={stat.href} className="card brand-glow-card p-4 hover:border-violet-500/30 transition-all duration-200 group xl:col-span-1 col-span-1">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center">
                <stat.icon size={15} className="text-slate-300" />
              </div>
              <ArrowRight size={12} className="text-slate-700 group-hover:text-violet-400 transition-colors" />
            </div>
            <p className="text-xl font-black tabular-nums text-white mb-0.5">{stat.value}</p>
            <p className="text-[11px] font-medium text-slate-400">{stat.label}</p>
            <p className="text-[10px] text-slate-600 mb-2">{stat.sub}</p>
            {stat.spark.length > 0
              ? <SparkBar data={stat.spark} color="#7c3aed" />
              : <div className={`h-0.5 rounded-full ${stat.bar} w-full mt-1`} />}
          </Link>
        ))}

        {/* Business Health Score */}
        <div className="card brand-gradient-card p-4 flex flex-col items-center justify-center gap-1 xl:col-span-1 col-span-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity size={12} className="text-violet-400" />
            <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wide">Business Health</span>
          </div>
          <HealthScore score={healthScore} />
          <div className="flex gap-3 mt-1">
            {[{ v: s?.todaySalesCount ?? 0, l: 'Sales' }, { v: s?.activeRepairs ?? 0, l: 'Repairs' }].map(i => (
              <div key={i.l} className="text-center">
                <p className="text-sm font-bold text-white">{i.v}</p>
                <p className="text-[9px] text-slate-600 uppercase">{i.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { href: '/dashboard/pos',       icon: ShoppingCart, label: 'Point of Sale',  sub: 'Start a sale',        grad: 'from-violet-600/25 to-purple-900/20 border-violet-500/25' },
          { href: '/dashboard/repairs',   icon: Wrench,       label: 'New Repair',     sub: 'Log job',             grad: 'from-blue-600/20 to-blue-900/15 border-blue-500/20' },
          { href: '/dashboard/customers', icon: Users,        label: 'Add Customer',   sub: 'Register',            grad: 'from-cyan-600/20 to-cyan-900/15 border-cyan-500/20' },
          { href: '/dashboard/inventory', icon: Package,      label: 'Add Product',    sub: 'Update stock',        grad: 'from-emerald-600/20 to-green-900/15 border-emerald-500/20' },
        ].map(q => (
          <Link key={q.href} href={q.href} className={`p-3 rounded-xl bg-gradient-to-br ${q.grad} border hover:scale-[1.02] active:scale-95 transition-all duration-150 flex items-center gap-2.5`}>
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
              <q.icon size={14} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{q.label}</p>
              <p className="text-[10px] text-slate-400 truncate">{q.sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Revenue Chart + Top Products ── */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <BarChart2 size={14} className="text-violet-400" />Revenue & Profit
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Last 14 days · ₹ thousands</p>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />Revenue</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />Profit</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"  stopColor="#7c3aed" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"  stopColor="#06b6d4" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f1623', border: '1px solid rgba(124,58,237,0.25)', borderRadius: '12px', fontSize: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
                labelStyle={{ color: '#94a3b8', fontWeight: 600 }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#7c3aed" strokeWidth={2.5} fill="url(#revGrad)" name="Revenue (k)" dot={false} activeDot={{ r: 4, fill: '#7c3aed', stroke: '#fff', strokeWidth: 2 }} />
              <Area type="monotone" dataKey="profit"  stroke="#06b6d4" strokeWidth={2}   fill="url(#profGrad)" name="Profit (k)"  dot={false} activeDot={{ r: 4, fill: '#06b6d4', stroke: '#fff', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Star size={13} className="text-amber-400" />Top Products
            </h3>
            <Link href="/dashboard/inventory" className="text-xs text-violet-400 hover:text-violet-300">All</Link>
          </div>
          <div className="space-y-3">
            {topProducts.length > 0 ? topProducts.slice(0, 5).map((p: any, i: number) => (
              <div key={p.productId ?? i} className="flex items-center gap-2.5">
                <span className={`text-[10px] font-black w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${i === 0 ? 'bg-amber-500/20 text-amber-400' : i === 1 ? 'bg-slate-500/20 text-slate-400' : 'bg-white/5 text-slate-600'}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-300 truncate">{p.productName ?? 'Unknown'}</p>
                  <div className="h-1.5 bg-white/5 rounded-full mt-1 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(100, ((p.totalQty ?? 1) / ((topProducts[0] as any)?.totalQty ?? 1)) * 100)}%`, background: `linear-gradient(90deg, #7c3aed, #06b6d4)` }} />
                  </div>
                </div>
                <span className="text-[11px] font-bold text-slate-400 flex-shrink-0 tabular-nums">{p.totalQty ?? 0}</span>
              </div>
            )) : (
              <div className="py-8 text-center flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                  <BarChart2 size={22} className="text-violet-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-300">No sales data yet</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">Make your first sale to see top products</p>
                </div>
                <Link href="/dashboard/pos" className="text-[11px] text-violet-400 hover:text-violet-300 flex items-center gap-1">Go to POS <ArrowRight size={10} /></Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Activity Feed + Alerts ── */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Live Activity Feed */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="live-dot" />Activity Feed
            </h3>
            <span className="text-[10px] text-slate-600 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">Live</span>
          </div>
          <div className="space-y-2">
            {activityFeed.length > 0 ? activityFeed.map((item: any, i: number) => (
              <div key={`${item.id}-${i}`} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/2 border border-white/5 hover:border-white/10 transition-all hover:bg-white/3 group">
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${item.color}`}>
                  <item.icon size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-200 truncate">{item.label}</p>
                  <p className="text-[10px] text-slate-500">{item.sub}</p>
                </div>
                {item.type === 'tx' ? (
                  <span className={`text-xs font-bold tabular-nums ${item.txType === 'INCOME' ? 'text-green-400' : 'text-red-400'}`}>
                    {item.txType === 'INCOME' ? '+' : '-'}{formatCurrency(item.amount)}
                  </span>
                ) : (
                  <span className={`badge-status border text-[10px] ${item.badgeColor}`}>{item.badge}</span>
                )}
                <span className="text-[10px] text-slate-700 group-hover:text-slate-500 transition-colors hidden sm:block flex-shrink-0 w-12 text-right">
                  {formatRelativeTime(item.time)}
                </span>
              </div>
            )) : (
              <div className="py-8 text-center flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl dot-grid-bg bg-violet-500/5 border border-violet-500/15 flex items-center justify-center">
                  <Zap size={22} className="text-violet-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-300">No activity yet today</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">Sales and repairs will appear here in real-time</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Alerts Stack */}
        <div className="space-y-3">
          <div className="card p-4 border-yellow-500/20 bg-gradient-to-br from-yellow-500/8 to-transparent">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-yellow-500/15 border border-yellow-500/25 flex items-center justify-center"><Package size={13} className="text-yellow-400" /></div>
              <span className="text-xs font-semibold text-yellow-300">Low Stock</span>
            </div>
            <p className="text-2xl font-black text-white tabular-nums mb-0.5">{s?.lowStockCount ?? 0}</p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {(s?.lowStockProducts ?? []).length === 0 ? 'All products stocked ✓' : (s.lowStockProducts as any[]).slice(0, 2).map((p: any) => p.name).join(', ')}
            </p>
            <Link href="/dashboard/inventory" className="text-[11px] text-yellow-400 hover:text-yellow-300 mt-2 inline-flex items-center gap-1">View inventory <ArrowRight size={10} /></Link>
          </div>

          <div className="card p-4 border-orange-500/20 bg-gradient-to-br from-orange-500/8 to-transparent">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-orange-500/15 border border-orange-500/25 flex items-center justify-center"><Shield size={13} className="text-orange-400" /></div>
              <span className="text-xs font-semibold text-orange-300">Warranty Expiring</span>
            </div>
            <p className="text-2xl font-black text-white tabular-nums mb-0.5">{s?.expiringWarranties ?? 0}</p>
            <p className="text-[11px] text-slate-500">{(s?.expiringWarranties ?? 0) === 0 ? 'No expiries within 30 days ✓' : 'Expiring within 30 days'}</p>
            <Link href="/dashboard/warranty" className="text-[11px] text-orange-400 hover:text-orange-300 mt-2 inline-flex items-center gap-1">View warranties <ArrowRight size={10} /></Link>
          </div>

          <div className="card p-4 border-blue-500/20 bg-gradient-to-br from-blue-500/8 to-transparent">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center"><Wrench size={13} className="text-blue-400" /></div>
              <span className="text-xs font-semibold text-blue-300">Ready for Pickup</span>
            </div>
            <p className="text-2xl font-black text-white tabular-nums mb-0.5">{s?.readyForPickup ?? 0}</p>
            <p className="text-[11px] text-slate-500">{(s?.readyForPickup ?? 0) === 0 ? 'No devices waiting ✓' : 'Repair jobs done, awaiting pickup'}</p>
            <Link href="/dashboard/repairs" className="text-[11px] text-blue-400 hover:text-blue-300 mt-2 inline-flex items-center gap-1">View repairs <ArrowRight size={10} /></Link>
          </div>
        </div>
      </div>
    </div>
  )
}
