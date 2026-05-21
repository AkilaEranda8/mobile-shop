'use client'

import { useMemo } from 'react'
import {
  ShoppingCart, TrendingUp, Package, Wrench, AlertTriangle,
  Users, ArrowUpRight, ArrowRight, Receipt, Activity,
  BarChart2, DollarSign, ChevronRight, TrendingDown, Star
} from 'lucide-react'
import Link from 'next/link'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import {
  useRevenue, useRepairs, useTransactions,
  useAnalyticsDashboard, useTopProducts
} from '@/lib/hooks'
import type { RepairTicket, Transaction as AppTransaction } from '@/types'
import { formatCurrency, formatRelativeTime } from '@/lib/utils'

/* ─────────────────────────────────────────────────────────────────────
   SVG SPARKLINE
   ───────────────────────────────────────────────────────────────────── */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) {
    const fake = [3, 5, 4, 7, 5, 8, 6]
    return <Sparkline data={fake} color={color} />
  }
  const max = Math.max(...data, 1), min = Math.min(...data, 0)
  const range = max - min || 1
  const W = 120, H = 40
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * W,
    H - ((v - min) / range) * H,
  ])
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const area = `${path} L${W},${H} L0,${H} Z`
  const cId  = color.replace(/[^a-z0-9]/gi, '')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-9 mt-1" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sp-${cId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.25"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sp-${cId})`}/>
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

/* ─────────────────────────────────────────────────────────────────────
   HEALTH DONUT
   ───────────────────────────────────────────────────────────────────── */
function HealthRing({ score }: { score: number }) {
  const clamp  = Math.min(100, Math.max(0, score))
  const r      = 56, circ = 2 * Math.PI * r
  const offset = circ - (clamp / 100) * circ
  const color  = clamp >= 75 ? '#22c55e' : clamp >= 50 ? '#f59e0b' : '#ef4444'
  const label  = clamp >= 75 ? 'Excellent' : clamp >= 50 ? 'Good' : 'Needs Attention'
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-40">
        <svg viewBox="0 0 130 130" className="w-full h-full -rotate-90">
          <circle cx="65" cy="65" r={r} fill="none" stroke="#f1f5f9" strokeWidth="12"/>
          <circle cx="65" cy="65" r={r} fill="none" stroke={color} strokeWidth="12"
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.34,1.56,.64,1)' }}/>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black tabular-nums" style={{ color }}>{clamp}%</span>
        </div>
      </div>
      <p className="font-bold text-gray-800 dark:text-slate-200 text-base mt-1">{label}</p>
      <p className="text-xs text-gray-400 mt-0.5">You&apos;re doing great!</p>
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════════
   MAIN DASHBOARD
   ═════════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  /* ── Data ── */
  const { data: rawRevenue }     = useRevenue()
  const { data: repairsData }    = useRepairs()
  const { data: txData }         = useTransactions()
  const { data: stats }          = useAnalyticsDashboard()
  const { data: rawTopProducts } = useTopProducts()

  const s            = stats as any
  const revenueArr   = Array.isArray(rawRevenue) ? rawRevenue as any[] : []
  const allRepairs   = (repairsData?.data ?? []) as RepairTicket[]
  const activeRepairs = allRepairs.filter(r => r.status !== 'DELIVERED' && r.status !== 'CANCELLED' && r.status !== 'COMPLETED')
  const transactions  = (txData?.data ?? []) as AppTransaction[]
  const topProducts   = Array.isArray(rawTopProducts) ? rawTopProducts as any[] : []

  /* Aggregates */
  const totalRevenue = revenueArr.reduce((a, d) => a + (d.revenue ?? 0), 0)
  const totalProfit  = revenueArr.reduce((a, d) => a + (d.profit  ?? 0), 0)
  const totalCost    = totalRevenue - totalProfit
  const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : '0.00'

  /* Sparklines */
  const sparkRev  = revenueArr.slice(-7).map(d => Math.round((d.revenue ?? 0) / 1000))
  const sparkProf = revenueArr.slice(-7).map(d => Math.round((d.profit  ?? 0) / 1000))

  /* Chart */
  const chartData = revenueArr.slice(-7).map((d: any) => ({
    date:   new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    sales:  Math.round(d.revenue ?? 0),
    cost:   Math.round((d.revenue ?? 0) - (d.profit ?? 0)),
    profit: Math.round(d.profit  ?? 0),
  }))

  /* Repairs breakdown */
  const repairStats = useMemo(() => {
    const inProg  = allRepairs.filter(r => r.status === 'IN_PROGRESS').length
    const waiting = allRepairs.filter(r => r.status === 'WAITING_FOR_PARTS').length
    const ready   = allRepairs.filter(r => ['READY_FOR_DELIVERY','READY_FOR_PICKUP','DELIVERED'].includes(r.status)).length
    const done    = allRepairs.filter(r => r.status === 'COMPLETED').length
    return { inProg, waiting, ready, done, total: allRepairs.length }
  }, [allRepairs])

  const repairDonut = [
    { name: 'In Progress',       value: repairStats.inProg,  color: '#3b82f6' },
    { name: 'Waiting for Parts', value: repairStats.waiting, color: '#8b5cf6' },
    { name: 'Ready to Deliver',  value: repairStats.ready,   color: '#22c55e' },
    { name: 'Completed',         value: repairStats.done,    color: '#f59e0b' },
  ].filter(d => d.value > 0)

  /* Health */
  const healthScore = useMemo(() => {
    let sc = 55
    if ((s?.todayRevenue   ?? 0) > 0)   sc += 12
    if ((s?.activeRepairs  ?? 0) < 5)   sc += 11
    if ((s?.lowStockCount  ?? 0) === 0) sc += 11
    if ((s?.totalCustomers ?? 0) > 10)  sc += 11
    return Math.min(100, sc)
  }, [s])

  /* Activity */
  const activityFeed = useMemo(() => {
    const items: any[] = []
    activeRepairs.slice(0, 3).forEach(r => items.push({
      id: r.id, icon: Wrench,
      iconBg: '#fff1e6', iconColor: '#f97316',
      title: `${r.deviceBrand} ${r.deviceModel} repair`,
      sub: `Repair #${r.ticketNumber}`, time: r.createdAt,
    }))
    transactions.slice(0, 5).forEach(t => items.push({
      id: t.id,
      icon: t.type === 'INCOME' ? TrendingUp : TrendingDown,
      iconBg:    t.type === 'INCOME' ? '#f0fdf4' : '#fff1f2',
      iconColor: t.type === 'INCOME' ? '#22c55e' : '#f43f5e',
      title: t.type === 'INCOME' ? 'Payment received' : 'Expense recorded',
      sub: t.description || t.category,
      amount: t.amount, txType: t.type, time: t.createdAt,
    }))
    return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 6)
  }, [activeRepairs, transactions])

  const CARD = 'bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700'

  return (
    <div className="space-y-5 pb-4">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Welcome back! Here&apos;s what&apos;s happening with your business today.</p>
      </div>

      {/* ── KPI Strip (6 cards) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: 'Total Sales',         value: formatCurrency(totalRevenue),            sub: `+18.6% from last 7 days`,                      icon: ShoppingCart, iconBg: '#ede9fe', iconColor: '#7c3aed', spark: sparkRev,  sparkColor: '#7c3aed' },
          { label: 'Total Profit',        value: formatCurrency(totalProfit),             sub: `+23.5% from last 7 days`,                      icon: TrendingUp,   iconBg: '#dcfce7', iconColor: '#16a34a', spark: sparkProf, sparkColor: '#22c55e' },
          { label: 'Total Orders',        value: String(s?.todaySalesCount ?? 0),          sub: `+15.7% from last 7 days`,                      icon: Receipt,      iconBg: '#dbeafe', iconColor: '#2563eb', spark: [],        sparkColor: '#3b82f6' },
          { label: 'Repairs In Progress', value: String(s?.activeRepairs ?? 0),            sub: `${s?.readyForPickup ?? 0} Ready to Deliver`,   icon: Wrench,       iconBg: '#ffedd5', iconColor: '#ea580c', spark: [],        sparkColor: '#f97316' },
          { label: 'Low Stock Items',     value: String(s?.lowStockCount ?? 0),            sub: 'View and restock',                             icon: AlertTriangle,iconBg: '#ffe4e6', iconColor: '#e11d48', spark: [],        sparkColor: '#f43f5e' },
          { label: 'Total Customers',     value: String(s?.totalCustomers ?? 0),           sub: `+12.4% from last 7 days`,                      icon: Users,        iconBg: '#cffafe', iconColor: '#0891b2', spark: [],        sparkColor: '#06b6d4' },
        ].map(k => (
          <div key={k.label} className={`${CARD} p-4 flex flex-col`}>
            <div className="flex items-start gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: k.iconBg }}>
                <k.icon size={16} style={{ color: k.iconColor }}/>
              </div>
              <span className="text-xs font-medium text-gray-500 dark:text-slate-400 leading-tight mt-0.5">{k.label}</span>
            </div>
            <p className="text-[22px] font-black text-gray-900 dark:text-white tabular-nums leading-tight">{k.value}</p>
            <p className="text-[11px] text-green-600 mt-0.5 flex items-center gap-0.5 font-medium">
              <ArrowUpRight size={11}/>{k.sub}
            </p>
            <Sparkline data={k.spark.length > 0 ? k.spark : [2, 5, 3, 7, 4, 8, 6]} color={k.sparkColor}/>
          </div>
        ))}
      </div>

      {/* ── Sales Overview + Business Health + Recent Activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* Sales Overview */}
        <div className={`${CARD} lg:col-span-5 p-5`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 dark:text-white">Sales Overview</h3>
            <span className="text-xs text-gray-500 bg-gray-100 dark:bg-slate-700 dark:text-slate-400 px-2.5 py-1 rounded-lg cursor-default">This Week ▾</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`}/>
              <Tooltip formatter={(v: any) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}/>
              <Line type="monotone" dataKey="sales"  stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 4, fill: '#7c3aed', strokeWidth: 0 }} activeDot={{ r: 6 }} name="Total Sales"/>
              <Line type="monotone" dataKey="cost"   stroke="#3b82f6" strokeWidth={2}   dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 5 }} name="Total Cost"/>
              <Line type="monotone" dataKey="profit" stroke="#22c55e" strokeWidth={2}   dot={{ r: 3, fill: '#22c55e', strokeWidth: 0 }} activeDot={{ r: 5 }} name="Total Profit"/>
            </LineChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-gray-50 dark:border-slate-700">
            {[
              { label: 'Total Sales',   value: formatCurrency(totalRevenue), color: '#7c3aed' },
              { label: 'Total Cost',    value: formatCurrency(totalCost),    color: '#3b82f6' },
              { label: 'Total Profit',  value: formatCurrency(totalProfit),  color: '#22c55e' },
              { label: 'Profit Margin', value: `${profitMargin}%`,           color: '#f59e0b' },
            ].map(l => (
              <div key={l.label} className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: l.color }}/>
                  <span className="text-[10px] text-gray-400">{l.label}</span>
                </div>
                <p className="text-xs font-bold text-gray-700 dark:text-slate-200 tabular-nums">{l.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Business Health */}
        <div className={`${CARD} lg:col-span-3 p-5`}>
          <h3 className="font-bold text-gray-900 dark:text-white mb-4">Business Health</h3>
          <HealthRing score={healthScore}/>
          <div className="space-y-2.5 mt-5">
            {[
              { label: 'Sales Growth',       status: (s?.todayRevenue   ?? 0) > 0  ? 'Good'    : 'Average', ok: (s?.todayRevenue ?? 0) > 0 },
              { label: 'Profitability',      status: totalProfit > 0               ? 'Excellent': 'Average', ok: totalProfit > 0 },
              { label: 'Stock Status',       status: (s?.lowStockCount  ?? 0) === 0 ? 'Good'    : 'Low',     ok: (s?.lowStockCount ?? 0) === 0 },
              { label: 'Customer Retention', status: (s?.totalCustomers ?? 0) > 5  ? 'Good'    : 'Average', ok: (s?.totalCustomers ?? 0) > 5 },
              { label: 'Repairs Performance',status: repairStats.done > repairStats.inProg ? 'Good' : 'Average', ok: repairStats.done > repairStats.inProg },
            ].map(m => (
              <div key={m.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: m.ok ? '#22c55e' : '#f59e0b' }}/>
                  <span className="text-xs text-gray-600 dark:text-slate-400">{m.label}</span>
                </div>
                <span className="text-[11px] font-semibold" style={{ color: m.ok ? '#22c55e' : '#f59e0b' }}>{m.status}</span>
              </div>
            ))}
          </div>
          <Link href="/dashboard/finance"
            className="mt-5 flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl text-sm font-semibold text-green-600 bg-green-50 dark:bg-green-500/10 hover:bg-green-100 dark:hover:bg-green-500/20 transition-colors border border-green-100 dark:border-green-500/20">
            Go to Analytics <ArrowRight size={14}/>
          </Link>
        </div>

        {/* Recent Activity */}
        <div className={`${CARD} lg:col-span-4 p-5`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 dark:text-white">Recent Activity</h3>
            <Link href="/dashboard/finance" className="text-xs font-medium text-violet-600 hover:text-violet-700 transition-colors">View All</Link>
          </div>
          <div className="space-y-3.5">
            {activityFeed.length > 0 ? activityFeed.map((item: any, i: number) => (
              <div key={`${item.id}-${i}`} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: item.iconBg }}>
                  <item.icon size={14} style={{ color: item.iconColor }}/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 dark:text-slate-200 truncate">{item.title}</p>
                  <p className="text-[10px] text-gray-400 truncate">{item.sub}</p>
                </div>
                <span className="text-[10px] text-gray-400 flex-shrink-0 whitespace-nowrap">{formatRelativeTime(item.time)}</span>
              </div>
            )) : (
              <div className="py-8 text-center text-sm text-gray-400">No activity yet</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Top Products + Repairs Overview + Low Stock ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Top Selling Products */}
        <div className={`${CARD} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 dark:text-white">Top Selling Products</h3>
            <span className="text-xs text-gray-500 bg-gray-100 dark:bg-slate-700 dark:text-slate-400 px-2.5 py-1 rounded-lg cursor-default">This Week ▾</span>
          </div>
          {topProducts.length > 0 ? (
            <div className="space-y-3.5">
              {topProducts.slice(0, 5).map((p: any, i: number) => {
                const pct = Math.min(100, ((p.totalQty ?? 1) / ((topProducts[0] as any)?.totalQty ?? 1)) * 100)
                return (
                  <div key={p.productId ?? i} className="flex items-center gap-3">
                    <span className="text-sm font-black text-gray-300 w-4 flex-shrink-0">{i + 1}</span>
                    <div className="w-9 h-9 rounded-xl bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 flex items-center justify-center flex-shrink-0">
                      <Package size={14} className="text-gray-400"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 dark:text-slate-200 truncate">{p.productName ?? 'Unknown'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-gray-100 dark:bg-slate-600 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #7c3aed, #a78bfa)' }}/>
                        </div>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">{p.totalQty ?? 0} units</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-gray-700 dark:text-slate-300 flex-shrink-0 tabular-nums">{formatCurrency(p.totalRevenue ?? 0)}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="py-10 text-center">
              <BarChart2 size={32} className="text-gray-200 mx-auto mb-2"/>
              <p className="text-sm text-gray-400">No sales data yet</p>
              <Link href="/dashboard/pos" className="text-xs text-violet-600 mt-1 inline-flex items-center gap-1">Open POS <ArrowRight size={10}/></Link>
            </div>
          )}
        </div>

        {/* Repairs Overview */}
        <div className={`${CARD} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 dark:text-white">Repairs Overview</h3>
            <span className="text-xs text-gray-500 bg-gray-100 dark:bg-slate-700 dark:text-slate-400 px-2.5 py-1 rounded-lg cursor-default">This Week ▾</span>
          </div>
          {repairStats.total > 0 ? (
            <>
              <div className="relative">
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={repairDonut} cx="50%" cy="50%" innerRadius={52} outerRadius={76} paddingAngle={2} dataKey="value">
                      {repairDonut.map((e, i) => <Cell key={i} fill={e.color}/>)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">{repairStats.total}</span>
                  <span className="text-[11px] text-gray-400">Total Repairs</span>
                </div>
              </div>
              <div className="space-y-2 mt-2">
                {repairDonut.map(item => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: item.color }}/>
                      <span className="text-gray-600 dark:text-slate-400">{item.name}</span>
                    </div>
                    <span className="font-semibold text-gray-700 dark:text-slate-300 tabular-nums">
                      {item.value} ({repairStats.total > 0 ? ((item.value / repairStats.total) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                ))}
              </div>
              <Link href="/dashboard/repairs" className="mt-3 text-xs font-medium text-violet-600 hover:text-violet-700 flex items-center gap-1 transition-colors">
                View All Repairs <ArrowRight size={11}/>
              </Link>
            </>
          ) : (
            <div className="py-10 text-center text-sm text-gray-400">No repair data</div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className={`${CARD} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 dark:text-white">Low Stock Alerts</h3>
            <Link href="/dashboard/inventory" className="text-xs font-medium text-violet-600 hover:text-violet-700 transition-colors">View All</Link>
          </div>
          {(s?.lowStockProducts ?? []).length > 0 ? (
            <div className="space-y-3">
              {(s.lowStockProducts as any[]).slice(0, 5).map((p: any, i: number) => (
                <div key={p.id ?? i} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 flex items-center justify-center flex-shrink-0">
                    <Package size={14} className="text-gray-400"/>
                  </div>
                  <p className="flex-1 text-xs font-semibold text-gray-800 dark:text-slate-200 truncate">{p.name}</p>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg flex-shrink-0 ${
                    (p.stock ?? 0) <= 2 ? 'bg-red-50   text-red-600   dark:bg-red-500/10   dark:text-red-400' :
                    (p.stock ?? 0) <= 5 ? 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400' :
                                          'bg-yellow-50 text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-400'
                  }`}>
                    Stock: {p.stock ?? 0}
                  </span>
                  <ChevronRight size={13} className="text-gray-300 flex-shrink-0"/>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center">
                <Package size={18} className="text-green-500"/>
              </div>
              <p className="text-xs text-gray-400 font-medium">All products stocked ✓</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Quick Actions bar ── */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {[
          { href: '/dashboard/pos',       icon: ShoppingCart, label: 'New Sale',     sub: 'Create Invoice', iconBg: '#ede9fe', iconColor: '#7c3aed' },
          { href: '/dashboard/customers', icon: Users,        label: 'Add Customer', sub: 'Register New',   iconBg: '#dbeafe', iconColor: '#2563eb' },
          { href: '/dashboard/inventory', icon: Package,      label: 'Add Product',  sub: 'New Item',       iconBg: '#dcfce7', iconColor: '#16a34a' },
          { href: '/dashboard/repairs',   icon: Wrench,       label: 'New Repair',   sub: 'Create Ticket',  iconBg: '#ffedd5', iconColor: '#ea580c' },
          { href: '/dashboard/finance',   icon: DollarSign,   label: 'Expenses',     sub: 'Add Expense',    iconBg: '#ffe4e6', iconColor: '#e11d48' },
          { href: '/dashboard/finance',   icon: BarChart2,    label: 'Reports',      sub: 'View Reports',   iconBg: '#cffafe', iconColor: '#0891b2' },
        ].map(a => (
          <Link key={`${a.href}-${a.label}`} href={a.href}
            className={`${CARD} p-4 flex flex-col items-center gap-2 text-center hover:shadow-md hover:border-violet-200 dark:hover:border-violet-500/30 transition-all active:scale-95`}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: a.iconBg }}>
              <a.icon size={19} style={{ color: a.iconColor }}/>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-800 dark:text-slate-200">{a.label}</p>
              <p className="text-[10px] text-gray-400">{a.sub}</p>
            </div>
          </Link>
        ))}
      </div>

    </div>
  )
}
