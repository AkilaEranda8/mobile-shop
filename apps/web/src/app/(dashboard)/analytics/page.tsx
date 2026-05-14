'use client'

import { useState, useMemo } from 'react'
import {
  TrendingUp, Users, Wrench, ShoppingCart, Package,
  AlertTriangle, DollarSign, Activity
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import { useAnalyticsDashboard, useRevenue, useTopProducts, useRepairsByStatus } from '@/lib/hooks'
import { formatCurrency } from '@/lib/utils'

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: '10px',
  fontSize: '12px',
  color: 'var(--text-primary)',
}

const PIE_COLORS = ['#6d28d9','#1d4ed8','#b45309','#0e7490','#15803d','#166534','#b91c1c']

const STATUS_LABELS: Record<string, string> = {
  RECEIVED: 'Received', DIAGNOSED: 'Diagnosed', IN_REPAIR: 'In Repair',
  QC: 'QC Check', READY: 'Ready', DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<'7' | '14' | '30'>('30')

  const { data: dashData }        = useAnalyticsDashboard()
  const { data: rawRevenue }      = useRevenue({ days: period })
  const { data: topProductsData } = useTopProducts({ limit: '10' })
  const { data: repairStatusData } = useRepairsByStatus()

  const dash         = dashData as any
  const revenueArr: any[]     = Array.isArray(rawRevenue)      ? rawRevenue      : []
  const topProducts: any[]    = Array.isArray(topProductsData) ? topProductsData : []
  const repairStatus: any[]   = Array.isArray(repairStatusData)? repairStatusData: []

  /* revenue chart data */
  const chartData = useMemo(() => revenueArr.map((d: any) => ({
    date:     new Date(d.date).toLocaleDateString('en-LK', { month: 'short', day: 'numeric' }),
    Revenue:  d.totalRevenue  ?? d.revenue  ?? 0,
    Profit:   d.profit        ?? 0,
    Expenses: (d.totalExpenses ?? d.expenses ?? 0) + (d.cogs ?? 0),
  })), [revenueArr])

  const totalRevenue = revenueArr.reduce((s, d) => s + (d.totalRevenue ?? d.revenue ?? 0), 0)
  const totalProfit  = revenueArr.reduce((s, d) => s + (d.profit ?? 0), 0)
  const avgDaily     = revenueArr.length > 0 ? Math.round(totalRevenue / revenueArr.length) : 0
  const margin       = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0

  /* repair status pie */
  const repairPie = repairStatus.map((r: any, i: number) => ({
    name:  STATUS_LABELS[r.status] ?? r.status,
    value: r.count ?? r._count ?? 0,
    fill:  PIE_COLORS[i % PIE_COLORS.length],
  }))
  const totalRepairs = repairPie.reduce((s, r) => s + r.value, 0)

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Business performance insights · Real data</p>
        </div>
        <div className="flex gap-1 p-1 rounded-xl sm:ml-auto" style={{ background: 'var(--bg-subtle)' }}>
          {(['7','14','30'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className="px-3 py-1.5 text-xs rounded-lg font-medium transition-colors"
              style={period === p ? { background: '#6d28d9', color: '#fff' } : { color: 'var(--text-muted)' }}>
              {p}d
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: `${period}d Revenue`,
            value: formatCurrency(totalRevenue),
            sub: `Avg ${formatCurrency(avgDaily)}/day`,
            icon: <DollarSign size={16} />,
            color: '#6d28d9', bg: 'rgba(109,40,217,0.08)', border: 'rgba(109,40,217,0.20)',
          },
          {
            label: `${period}d Profit`,
            value: formatCurrency(totalProfit),
            sub: `Margin: ${margin}%`,
            icon: <TrendingUp size={16} />,
            color: '#15803d', bg: 'rgba(21,128,61,0.08)', border: 'rgba(21,128,61,0.20)',
          },
          {
            label: 'Total Customers',
            value: (dash?.totalCustomers ?? 0).toLocaleString(),
            sub: `${dash?.todaySalesCount ?? 0} sales today`,
            icon: <Users size={16} />,
            color: '#b45309', bg: 'rgba(180,83,9,0.08)', border: 'rgba(180,83,9,0.20)',
          },
          {
            label: 'Active Repairs',
            value: (dash?.activeRepairs ?? 0).toString(),
            sub: `${dash?.lowStockCount ?? 0} low stock items`,
            icon: <Wrench size={16} />,
            color: '#0e7490', bg: 'rgba(14,116,144,0.08)', border: 'rgba(14,116,144,0.20)',
          },
        ].map(({ label, value, sub, icon, color, bg, border }) => (
          <div key={label} className="card p-5" style={{ borderColor: border, background: bg }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color, background: bg, border: `1px solid ${border}` }}>{icon}</div>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Revenue vs Profit Area Chart ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Revenue vs Profit · Last {period} days (LKR)
          </h3>
          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-600 inline-block" />Revenue</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Profit</span>
          </div>
        </div>
        {chartData.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
            No revenue data for this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6d28d9" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6d28d9" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => formatCurrency(v)} />
              <Area type="monotone" dataKey="Revenue" stroke="#6d28d9" fill="url(#gRev)"    strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="Profit"  stroke="#10b981" fill="url(#gProfit)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* ── Top Products ── */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Package size={14} className="text-violet-400" />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Top Products by Revenue</h3>
          </div>
          {topProducts.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No sales data yet</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((product: any, i: number) => (
                <div key={product.productId ?? i} className="flex items-center gap-3">
                  <span className="text-xs font-bold w-5 text-center rounded-md py-0.5" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{product.productName}</p>
                    <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
                      <div className="h-full rounded-full" style={{
                        width: `${topProducts[0]?.revenue ? Math.round((product.revenue / topProducts[0].revenue) * 100) : 0}%`,
                        background: 'linear-gradient(90deg, #6d28d9, #06b6d4)'
                      }} />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(product.revenue ?? 0)}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{product.quantitySold ?? 0} sold</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Repairs by Status ── */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={14} className="text-cyan-500" />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Repairs by Status</h3>
            {totalRepairs > 0 && (
              <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
                {totalRepairs} total
              </span>
            )}
          </div>
          {repairPie.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No repair data yet</p>
          ) : (
            <div className="flex gap-4">
              <ResponsiveContainer width="45%" height={150}>
                <PieChart>
                  <Pie data={repairPie} cx="50%" cy="50%" innerRadius={35} outerRadius={58} dataKey="value" strokeWidth={0}>
                    {repairPie.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5 justify-center flex flex-col">
                {repairPie.map((r, i) => (
                  <div key={r.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: r.fill }} />
                      <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{r.name}</span>
                    </div>
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Today's Stats + Low Stock Alert ── */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart size={14} className="text-violet-400" />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Today at a Glance</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Today's Revenue", value: formatCurrency(dash?.todayRevenue ?? 0), color: '#6d28d9' },
              { label: "Today's Sales",   value: (dash?.todaySalesCount ?? 0).toString(),  color: '#0e7490' },
              { label: 'Total Revenue',   value: formatCurrency(dash?.totalRevenue ?? 0),  color: '#15803d' },
              { label: 'Active Repairs',  value: (dash?.activeRepairs ?? 0).toString(),    color: '#b45309' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
                <p className="text-lg font-bold" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={14} className="text-amber-500" />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Inventory Alert</h3>
          </div>
          <div className="flex items-center justify-center flex-col gap-3 py-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(180,83,9,0.10)', border: '1px solid rgba(180,83,9,0.25)' }}>
              <Package size={28} style={{ color: '#b45309' }} />
            </div>
            <div className="text-center">
              <p className="text-3xl font-black" style={{ color: dash?.lowStockCount > 0 ? '#b91c1c' : '#15803d' }}>
                {dash?.lowStockCount ?? 0}
              </p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {dash?.lowStockCount > 0 ? 'Products with low stock (≤5 units)' : 'All products sufficiently stocked'}
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
