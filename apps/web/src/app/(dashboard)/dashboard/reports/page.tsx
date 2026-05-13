'use client'

import { useMemo } from 'react'
import {
  TrendingUp, TrendingDown, Package, Users, Wrench,
  BarChart3, ShoppingCart, DollarSign, AlertTriangle, Activity
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import {
  useRevenue, useTopProducts, useAnalyticsDashboard,
  useFinanceSummary, useRepairsByStatus
} from '@/lib/hooks'
import { formatCurrency } from '@/lib/utils'

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: '10px',
  fontSize: '12px',
  color: 'var(--text-primary)',
}

const STATUS_LABELS: Record<string, string> = {
  RECEIVED: 'Received', DIAGNOSED: 'Diagnosed', IN_REPAIR: 'In Repair',
  QC: 'QC', READY: 'Ready', DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
}
const PIE_COLORS = ['#6d28d9','#1d4ed8','#b45309','#0e7490','#15803d','#166534','#b91c1c']

export default function ReportsPage() {
  const { data: dashData }       = useAnalyticsDashboard()
  const { data: summaryData }    = useFinanceSummary()
  const { data: revenueData }    = useRevenue({ days: '30' })
  const { data: topProductsRaw } = useTopProducts({ limit: '8' })
  const { data: repairStatusRaw } = useRepairsByStatus()

  const dash      = dashData as any
  const summary   = summaryData as any
  const revenue: any[]     = Array.isArray(revenueData)     ? revenueData     : []
  const products: any[]    = Array.isArray(topProductsRaw)  ? topProductsRaw  : []
  const repairStatus: any[] = Array.isArray(repairStatusRaw) ? repairStatusRaw : []

  const totalRevenue30 = revenue.reduce((s, r) => s + (r.totalRevenue ?? 0), 0)
  const totalProfit30  = revenue.reduce((s, r) => s + (r.profit       ?? 0), 0)

  const chartData = useMemo(() => revenue.map((r: any) => ({
    date:    new Date(r.date).toLocaleDateString('en-LK', { day: 'numeric', month: 'short' }),
    Revenue: r.totalRevenue ?? 0,
    Profit:  r.profit       ?? 0,
  })), [revenue])

  const maxQty = Math.max(...products.map((p: any) => p.quantitySold ?? 1), 1)

  const repairPie = repairStatus.map((r: any, i: number) => ({
    name:  STATUS_LABELS[r.status] ?? r.status,
    value: r.count ?? r._count ?? 0,
    fill:  PIE_COLORS[i % PIE_COLORS.length],
  }))
  const totalRepairs = repairPie.reduce((s, r) => s + r.value, 0)

  const kpis = [
    { label: 'All-time Revenue',  value: formatCurrency(dash?.totalRevenue ?? 0),   sub: `${dash?.todaySalesCount ?? 0} sales today`,   icon: <DollarSign size={15} />, color: '#6d28d9', bg: 'rgba(109,40,217,0.08)', border: 'rgba(109,40,217,0.20)' },
    { label: "Today's Revenue",   value: formatCurrency(dash?.todayRevenue  ?? 0),   sub: 'Live today',                                   icon: <TrendingUp size={15} />, color: '#15803d', bg: 'rgba(21,128,61,0.08)',  border: 'rgba(21,128,61,0.20)'  },
    { label: '30d Net Profit',    value: formatCurrency(totalProfit30),               sub: `30d Revenue: ${formatCurrency(totalRevenue30)}`, icon: <BarChart3 size={15} />, color: '#0e7490', bg: 'rgba(14,116,144,0.08)', border: 'rgba(14,116,144,0.20)' },
    { label: 'MTD Profit',        value: formatCurrency(summary?.profit ?? 0),        sub: `Income: ${formatCurrency(summary?.totalIncome ?? 0)}`, icon: <TrendingDown size={15} />, color: '#b45309', bg: 'rgba(180,83,9,0.08)',   border: 'rgba(180,83,9,0.20)'   },
    { label: 'Total Customers',   value: (dash?.totalCustomers ?? 0).toLocaleString(), sub: `${dash?.lowStockCount ?? 0} low-stock items`,  icon: <Users size={15} />,     color: '#1d4ed8', bg: 'rgba(29,78,216,0.08)',  border: 'rgba(29,78,216,0.20)'  },
    { label: 'Active Repairs',    value: (dash?.activeRepairs  ?? 0).toString(),       sub: `${totalRepairs} total repair records`,         icon: <Wrench size={15} />,    color: '#c2410c', bg: 'rgba(194,65,12,0.08)',  border: 'rgba(194,65,12,0.20)'  },
  ]

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div>
        <h1 className="page-title">Reports & Analytics</h1>
        <p className="page-subtitle">Live business performance · All real data</p>
      </div>

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map(({ label, value, sub, icon, color, bg, border }) => (
          <div key={label} className="card p-4" style={{ borderColor: border, background: bg }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color, background: bg, border: `1px solid ${border}` }}>{icon}</div>
            </div>
            <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Revenue & Profit Trend ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Revenue & Profit Trend</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Last 30 days (LKR)</p>
          </div>
          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#6d28d9' }} />Revenue</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#06b6d4' }} />Profit</span>
          </div>
        </div>
        {chartData.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>No sales data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6d28d9" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6d28d9" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#06b6d4" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => formatCurrency(v)} />
              <Area type="monotone" dataKey="Revenue" stroke="#6d28d9" strokeWidth={2} fill="url(#rg)" />
              <Area type="monotone" dataKey="Profit"  stroke="#06b6d4" strokeWidth={2} fill="url(#pg)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* ── Top Products by Units Sold ── */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Package size={14} className="text-violet-400" />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Top Products — Units Sold</h3>
          </div>
          {products.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No sales data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={products.slice(0,6)} layout="vertical" barSize={10}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="productName" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={100}
                  tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 14) + '…' : v} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="quantitySold" fill="#6d28d9" name="Units Sold" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Top Products by Revenue ── */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart size={14} className="text-cyan-500" />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Top Products — Revenue</h3>
          </div>
          {products.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No sales data yet</p>
          ) : (
            <div className="space-y-2.5">
              {products.slice(0, 6).map((p: any, i: number) => (
                <div key={p.productId ?? i} className="flex items-center gap-3">
                  <span className="text-xs font-bold w-5 text-center rounded py-0.5" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium truncate max-w-[130px]" style={{ color: 'var(--text-primary)' }}>{p.productName}</span>
                      <span className="flex-shrink-0 font-semibold" style={{ color: '#6d28d9' }}>{formatCurrency(p.revenue ?? 0)}</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
                      <div className="h-full rounded-full" style={{ width: `${products[0]?.revenue ? Math.round((p.revenue / products[0].revenue) * 100) : 0}%`, background: 'linear-gradient(90deg,#6d28d9,#06b6d4)' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Repair Status Distribution ── */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={14} className="text-amber-500" />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Repair Jobs Status Distribution</h3>
          {totalRepairs > 0 && (
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
              {totalRepairs} total
            </span>
          )}
        </div>
        {repairPie.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>No repair data yet</p>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie data={repairPie} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" strokeWidth={0}>
                  {repairPie.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {repairPie.map((r) => (
                <div key={r.name} className="rounded-xl p-3 text-center" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                  <div className="w-3 h-3 rounded-full mx-auto mb-1.5" style={{ backgroundColor: r.fill }} />
                  <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{r.value}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{r.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Business Summary ── */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={14} className="text-amber-500" />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Business Health Summary</h3>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Revenue Growth', value: chartData.length >= 2 ? (((chartData[chartData.length-1]?.Revenue ?? 0) - (chartData[0]?.Revenue ?? 0)) / Math.max(chartData[0]?.Revenue ?? 1, 1) * 100).toFixed(1) + '%' : 'N/A', color: '#15803d', desc: '30-day change' },
            { label: 'Avg Daily Revenue', value: formatCurrency(revenue.length > 0 ? Math.round(totalRevenue30 / revenue.length) : 0), color: '#6d28d9', desc: 'Last 30 days' },
            { label: 'Profit Margin', value: totalRevenue30 > 0 ? Math.round((totalProfit30 / totalRevenue30) * 100) + '%' : '0%', color: '#0e7490', desc: '30-day margin' },
            { label: 'Low Stock Items', value: (dash?.lowStockCount ?? 0).toString(), color: dash?.lowStockCount > 0 ? '#b91c1c' : '#15803d', desc: '≤5 units remaining' },
          ].map(({ label, value, color, desc }) => (
            <div key={label} className="rounded-xl p-4 text-center" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
              <p className="text-2xl font-black" style={{ color }}>{value}</p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
