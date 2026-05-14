'use client'

import { useState, useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Package, Wrench, Truck, Download,
  ShoppingCart, AlertTriangle, CheckCircle, Clock, XCircle,
  DollarSign, BarChart3, ArrowUpRight, ArrowDownRight, Users, Wallet,
} from 'lucide-react'
import {
  useRevenue, useTopProducts, useRepairsByStatus,
  useInventorySummary, useDeliverySummary, useAnalyticsDashboard,
  useFinanceSummary,
} from '@/lib/hooks'
import { formatCurrency } from '@/lib/utils'

/* ── constants ─────────────────────────────────────────────────── */
const TOOLTIP_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: '10px',
  fontSize: '12px',
  color: 'var(--text-primary)',
}

const PIE_COLORS   = ['#6d28d9','#1d4ed8','#b45309','#0e7490','#15803d','#b91c1c','#7c3aed','#0369a1']
const STATUS_LABEL: Record<string, string> = {
  RECEIVED:'Received', DIAGNOSED:'Diagnosed', IN_REPAIR:'In Repair',
  QC:'QC Check', READY:'Ready', DELIVERED:'Delivered', CANCELLED:'Cancelled',
  PENDING:'Pending', PACKED:'Packed', DISPATCHED:'Dispatched',
}

const PERIODS = [
  { label: 'Today', days: '1'   },
  { label: '7D',    days: '7'   },
  { label: '30D',   days: '30'  },
  { label: '90D',   days: '90'  },
  { label: '1Y',    days: '365' },
]

/* ── small helpers ──────────────────────────────────────────────── */
function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: any; color: string }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${color}-500/10 border border-${color}-500/20 flex-shrink-0`}>
        <Icon size={16} className={`text-${color}-600 dark:text-${color}-400`} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold truncate" style={{ color: 'var(--text-primary)' }}>{value}</p>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
        {sub && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
      </div>
    </div>
  )
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-1 h-5 rounded-full bg-violet-500" />
      <div>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        {sub && <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
      </div>
    </div>
  )
}

function ExportCSV({ filename, rows, headers }: { filename: string; rows: (string | number)[][]; headers: string[] }) {
  const handle = () => {
    const csv  = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(blob); a.download = filename; a.click()
  }
  return (
    <button onClick={handle} className="flex items-center gap-1.5 text-xs hover:text-violet-600 dark:hover:text-violet-400 border px-3 py-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
      <Download size={12} /> Export CSV
    </button>
  )
}

/* ── tabs ───────────────────────────────────────────────────────── */
const TABS = [
  { id: 'overview',  label: 'Overview',  icon: BarChart3    },
  { id: 'sales',     label: 'Sales',     icon: ShoppingCart },
  { id: 'finance',   label: 'Finance',   icon: DollarSign   },
  { id: 'inventory', label: 'Inventory', icon: Package      },
  { id: 'repairs',   label: 'Repairs',   icon: Wrench       },
  { id: 'delivery',  label: 'Delivery',  icon: Truck        },
]

/* ── Sales Tab ─────────────────────────────────────────────────── */
function SalesTab({ days, fromDate, toDate }: { days: string; fromDate: string; toDate: string }) {
  const { data: rawRevenue }      = useRevenue({ from: fromDate, to: toDate })
  const { data: topProductsData } = useTopProducts({ limit: '10', from: fromDate, to: toDate })
  const revenueArr: any[] = Array.isArray(rawRevenue) ? rawRevenue : []
  const topProducts: any[] = Array.isArray(topProductsData) ? topProductsData : []

  const totalRevenue  = revenueArr.reduce((s, d) => s + (d.totalRevenue ?? 0), 0)
  const totalProfit   = revenueArr.reduce((s, d) => s + (d.profit ?? 0), 0)
  const totalCost     = revenueArr.reduce((s, d) => s + (d.totalExpenses ?? 0) + (d.cogs ?? 0), 0)
  const avgDaily      = revenueArr.length > 0 ? totalRevenue / revenueArr.length : 0
  const marginPct     = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0'

  const chartData = useMemo(() => revenueArr.map(d => ({
    date:     new Date(d.date).toLocaleDateString('en-LK', { month: 'short', day: 'numeric' }),
    Revenue:  d.totalRevenue ?? 0,
    Profit:   d.profit ?? 0,
    Expenses: (d.totalExpenses ?? 0) + (d.cogs ?? 0),
  })), [revenueArr])

  const exportRows = topProducts.map(p => [p.productName, p.quantitySold, p.revenue])

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Revenue"   value={formatCurrency(totalRevenue)}  icon={DollarSign}   color="violet" />
        <StatCard label="Gross Profit"    value={formatCurrency(totalProfit)}   icon={TrendingUp}   color="green"  sub={`${marginPct}% margin`} />
        <StatCard label="Total Cost"      value={formatCurrency(totalCost)}    icon={TrendingDown} color="red"    />
        <StatCard label="Avg Daily Revenue" value={formatCurrency(avgDaily)}   icon={BarChart3}    color="blue"   />
      </div>

      {/* Revenue chart */}
      <div className="card p-5">
        <SectionTitle title="Revenue Trend" sub={`Last ${days} days`} />
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}    />
              </linearGradient>
              <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#15803d" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#15803d" stopOpacity={0}   />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} tickFormatter={v => formatCurrency(v)} width={70} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => formatCurrency(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="Revenue"  stroke="#7c3aed" fill="url(#gRev)"    strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="Profit"   stroke="#16a34a" fill="url(#gProfit)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            <Area type="monotone" dataKey="Expenses" stroke="#dc2626" fill="none"           strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Top products */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle title="Top Products by Revenue" />
          <ExportCSV filename="top-products.csv" headers={['Product','Qty Sold','Revenue']} rows={exportRows} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topProducts.slice(0, 8)} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} tickFormatter={v => formatCurrency(v)} />
              <YAxis type="category" dataKey="productName" width={100} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => formatCurrency(v)} />
              <Bar dataKey="revenue" fill="#7c3aed" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="space-y-1 overflow-y-auto max-h-56">
            {topProducts.map((p: any, i: number) => (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <span className="text-[10px] font-mono w-5" style={{ color: 'var(--text-muted)' }}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>{p.productName}</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{p.quantitySold} units sold</p>
                </div>
                <span className="text-xs font-semibold flex-shrink-0 text-violet-600 dark:text-violet-400">{formatCurrency(p.revenue)}</span>
              </div>
            ))}
            {topProducts.length === 0 && <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>No sales data for this period</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Inventory Tab ─────────────────────────────────────────────── */
function InventoryTab() {
  const { data: invData } = useInventorySummary()
  const inv = invData as any

  const byCategory: any[] = inv?.byCategory ?? []
  const totalStockValue   = inv?.totalStockValue ?? 0
  const totalProducts     = inv?.totalProducts ?? 0
  const lowStockCount     = inv?.lowStockCount ?? 0
  const outOfStockCount   = inv?.outOfStockCount ?? 0

  const exportRows = byCategory.map(c => [c.name, c.products, c.totalStock, c.stockValue, c.lowStock, c.outOfStock])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Products"  value={String(totalProducts)}          icon={Package}       color="violet" />
        <StatCard label="Total Stock Value" value={formatCurrency(totalStockValue)} icon={DollarSign}   color="green"  />
        <StatCard label="Low Stock Items"   value={String(lowStockCount)}          icon={AlertTriangle} color="yellow" />
        <StatCard label="Out of Stock"      value={String(outOfStockCount)}        icon={XCircle}       color="red"    />
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        {/* Bar chart by category */}
        <div className="card p-5">
          <SectionTitle title="Stock Value by Category" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byCategory} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} tickFormatter={v => formatCurrency(v)} width={70} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, n: any) => n === 'stockValue' ? formatCurrency(v) : v} />
              <Bar dataKey="stockValue" name="Stock Value" fill="#6d28d9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie: product distribution */}
        <div className="card p-5">
          <SectionTitle title="Products by Category" />
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={byCategory} dataKey="products" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                {byCategory.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category table */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle title="Category Breakdown" />
          <ExportCSV filename="inventory-report.csv" headers={['Category','Products','Total Stock','Stock Value','Low Stock','Out of Stock']} rows={exportRows} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {['Category','Products','Total Stock','Stock Value','Low Stock','Out of Stock'].map(h => (
                  <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wide px-3 py-2" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byCategory.map((c: any, i: number) => (
                <tr key={i} className="transition-colors" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{c.products}</td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{c.totalStock}</td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-violet-600 dark:text-violet-400">{formatCurrency(c.stockValue)}</td>
                  <td className="px-3 py-2.5"><span className={`text-[11px] px-1.5 py-0.5 rounded ${c.lowStock > 0 ? 'text-yellow-400 bg-yellow-500/10' : 'text-slate-600'}`}>{c.lowStock}</span></td>
                  <td className="px-3 py-2.5"><span className={`text-[11px] px-1.5 py-0.5 rounded ${c.outOfStock > 0 ? 'text-red-400 bg-red-500/10' : 'text-slate-600'}`}>{c.outOfStock}</span></td>
                </tr>
              ))}
              {byCategory.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-xs" style={{ color: 'var(--text-muted)' }}>No inventory data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ── Repairs Tab ────────────────────────────────────────────────── */
function RepairsTab() {
  const { data: repairStatusData } = useRepairsByStatus()
  const statusArr: any[] = Array.isArray(repairStatusData) ? repairStatusData : []

  const total     = statusArr.reduce((s, r) => s + (r.count ?? 0), 0)
  const delivered = statusArr.find(r => r.status === 'DELIVERED')?.count ?? 0
  const active    = statusArr.filter(r => !['DELIVERED','CANCELLED'].includes(r.status)).reduce((s, r) => s + r.count, 0)
  const cancelled = statusArr.find(r => r.status === 'CANCELLED')?.count ?? 0

  const pieData = statusArr.map((r, i) => ({ name: STATUS_LABEL[r.status] ?? r.status, value: r.count ?? 0, fill: PIE_COLORS[i % PIE_COLORS.length] }))

  const exportRows = statusArr.map(r => [STATUS_LABEL[r.status] ?? r.status, r.count ?? 0])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Jobs"    value={String(total)}     icon={Wrench}       color="violet" />
        <StatCard label="Active Jobs"   value={String(active)}    icon={Clock}        color="yellow" />
        <StatCard label="Completed"     value={String(delivered)} icon={CheckCircle}  color="green"  />
        <StatCard label="Cancelled"     value={String(cancelled)} icon={XCircle}      color="red"    />
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        {/* Pie chart */}
        <div className="card p-5">
          <SectionTitle title="Jobs by Status" />
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Status breakdown list */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle title="Status Breakdown" />
            <ExportCSV filename="repairs-report.csv" headers={['Status','Count']} rows={exportRows} />
          </div>
          <div className="space-y-2">
            {statusArr.map((r: any, i: number) => {
              const pct = total > 0 ? Math.round((r.count / total) * 100) : 0
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: 'var(--text-primary)' }}>{STATUS_LABEL[r.status] ?? r.status}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{r.count} <span style={{ color: 'var(--text-muted)' }}>({pct}%)</span></span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  </div>
                </div>
              )
            })}
            {statusArr.length === 0 && <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>No repair data</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Delivery Tab ───────────────────────────────────────────────── */
function DeliveryTab({ days }: { days: string }) {
  const { data: delData } = useDeliverySummary({ days })
  const del = delData as any

  const totalOrders  = del?.totalOrders ?? 0
  const totalRevenue = del?.totalRevenue ?? 0
  const codOrders    = del?.codOrders ?? 0
  const prepaid      = del?.prepaidOrders ?? 0
  const byStatus: any[] = del?.byStatus ?? []

  const delivered = byStatus.find(s => s.status === 'DELIVERED')?.count ?? 0
  const pending   = byStatus.filter(s => ['PENDING','PACKED'].includes(s.status)).reduce((s, r) => s + r.count, 0)

  const pieData = byStatus.map((s, i) => ({ name: STATUS_LABEL[s.status] ?? s.status, value: s.count, fill: PIE_COLORS[i % PIE_COLORS.length] }))
  const codPie  = [{ name: 'COD', value: codOrders, fill: '#b45309' }, { name: 'Prepaid', value: prepaid, fill: '#1d4ed8' }]

  const exportRows = byStatus.map(s => [STATUS_LABEL[s.status] ?? s.status, s.count, s.revenue])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Orders"    value={String(totalOrders)}        icon={Truck}        color="violet" />
        <StatCard label="Total Revenue"   value={formatCurrency(totalRevenue)} icon={DollarSign}  color="green"  />
        <StatCard label="Delivered"        value={String(delivered)}           icon={CheckCircle} color="blue"   />
        <StatCard label="Pending / Packed" value={String(pending)}             icon={Clock}       color="yellow" />
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        {/* Status pie */}
        <div className="card p-5">
          <SectionTitle title="Orders by Status" />
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                  {pieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-slate-500 text-center py-16">No delivery data</p>}
        </div>

        {/* COD vs Prepaid */}
        <div className="card p-5">
          <SectionTitle title="Payment Type Split" />
          {totalOrders > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={codPie} dataKey="value" cx="50%" cy="50%" outerRadius={65}>
                    {codPie.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(180,83,9,0.08)', border: '1px solid rgba(180,83,9,0.2)' }}>
                  <p className="text-[10px] text-yellow-500 uppercase tracking-wide mb-1">COD Orders</p>
                  <p className="text-lg font-bold text-yellow-400">{codOrders}</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(29,78,216,0.08)', border: '1px solid rgba(29,78,216,0.2)' }}>
                  <p className="text-[10px] text-blue-400 uppercase tracking-wide mb-1">Prepaid</p>
                  <p className="text-lg font-bold text-blue-400">{prepaid}</p>
                </div>
              </div>
            </>
          ) : <p className="text-xs text-slate-500 text-center py-16">No delivery data</p>}
        </div>
      </div>

      {/* Status table */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle title="Status Breakdown" />
          <ExportCSV filename="delivery-report.csv" headers={['Status','Orders','Revenue']} rows={exportRows} />
        </div>
        <div className="space-y-2">
          {byStatus.map((s: any, i: number) => {
            const pct = totalOrders > 0 ? Math.round((s.count / totalOrders) * 100) : 0
            return (
              <div key={i} className="flex items-center gap-3">
                <div className="w-20 text-xs flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>{STATUS_LABEL[s.status] ?? s.status}</div>
                <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                </div>
                <span className="text-xs w-8 text-right flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{s.count}</span>
                <span className="text-xs font-medium w-24 text-right flex-shrink-0 text-violet-600 dark:text-violet-400">{formatCurrency(s.revenue)}</span>
              </div>
            )
          })}
          {byStatus.length === 0 && <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>No delivery data for this period</p>}
        </div>
      </div>
    </div>
  )
}

/* ── Overview Tab ─────────────────────────────────────────────── */
function OverviewTab({ days, fromDate, toDate }: { days: string; fromDate: string; toDate: string }) {
  const { data: dashData }         = useAnalyticsDashboard()
  const { data: rawRevenue }       = useRevenue({ from: fromDate, to: toDate })
  const { data: repairStatusData } = useRepairsByStatus()
  const { data: invData }          = useInventorySummary()

  const dash = dashData as any
  const revenue: any[]  = Array.isArray(rawRevenue) ? rawRevenue : []
  const repairs: any[]  = Array.isArray(repairStatusData) ? repairStatusData : []
  const inv = invData as any

  const totalRevenue  = revenue.reduce((s, d) => s + (d.totalRevenue ?? 0), 0)
  const totalProfit   = revenue.reduce((s, d) => s + (d.profit ?? 0), 0)
  const totalCost     = revenue.reduce((s, d) => s + (d.totalExpenses ?? 0) + (d.cogs ?? 0), 0)
  const margin        = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0
  const activeRepairs = repairs.filter(r => !['DELIVERED','CANCELLED'].includes(r.status)).reduce((s, r) => s + (r.count ?? 0), 0)

  const chartData = useMemo(() => revenue.map((d: any) => ({
    date:    new Date(d.date).toLocaleDateString('en-LK', { month: 'short', day: 'numeric' }),
    Revenue: d.totalRevenue ?? 0,
    Profit:  d.profit ?? 0,
    Cost:    (d.totalExpenses ?? 0) + (d.cogs ?? 0),
  })), [revenue])

  const health = [
    { label: `${days}d Revenue`,    value: formatCurrency(totalRevenue),           good: totalRevenue > 0         },
    { label: 'Profit Margin',        value: `${margin}%`,                           good: margin >= 15             },
    { label: 'Low Stock Items',      value: `${dash?.lowStockCount ?? 0} items`,    good: (dash?.lowStockCount ?? 0) === 0 },
    { label: 'Active Repairs',       value: String(activeRepairs),                  good: activeRepairs < 10       },
    { label: 'Expiring Warranties',  value: String(dash?.expiringWarranties ?? 0),  good: (dash?.expiringWarranties ?? 0) === 0 },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label={`${days}d Revenue`}    value={formatCurrency(totalRevenue)}             icon={DollarSign}    color="violet" />
        <StatCard label={`${days}d Net Profit`} value={formatCurrency(totalProfit)}             icon={TrendingUp}    color="green"  sub={`${margin}% margin`} />
        <StatCard label={`${days}d Total Cost`} value={formatCurrency(totalCost)}               icon={TrendingDown}  color="red"    />
        <StatCard label="Today's Revenue"       value={formatCurrency(dash?.todayRevenue ?? 0)} icon={ShoppingCart}  color="blue"   sub={`${dash?.todaySalesCount ?? 0} sales`} />
        <StatCard label="Total Customers"       value={(dash?.totalCustomers ?? 0).toLocaleString()} icon={Users}    color="orange" />
        <StatCard label="Low Stock Items"       value={(dash?.lowStockCount ?? 0).toString()}   icon={AlertTriangle} color="yellow" sub="≤5 units remaining" />
      </div>

      <div className="card p-5">
        <SectionTitle title={`Revenue, Profit & Cost — Last ${days} Days`} />
        {chartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>No data for this period</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="ovRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}    />
                </linearGradient>
                <linearGradient id="ovPro" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} tickFormatter={v => formatCurrency(v)} width={72} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => formatCurrency(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="Revenue" stroke="#7c3aed" fill="url(#ovRev)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="Profit"  stroke="#16a34a" fill="url(#ovPro)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="Cost"    stroke="#dc2626" fill="none"         strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card p-5">
          <SectionTitle title="Business Health Check" />
          <div className="space-y-3">
            {health.map(({ label, value, good }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span className={`text-xs font-semibold ${good ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <SectionTitle title="Quick Stats" />
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Today's Sales",     value: (dash?.todaySalesCount ?? 0).toString(),         color: '#7c3aed' },
              { label: 'All-time Revenue',   value: formatCurrency(dash?.totalRevenue ?? 0),         color: '#15803d' },
              { label: 'Stock Value',        value: formatCurrency(inv?.totalStockValue ?? 0),        color: '#0e7490' },
              { label: 'Ready Pickups',      value: (dash?.readyForPickup ?? 0).toString(),           color: '#b45309' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl p-3 text-center" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-lg font-bold" style={{ color }}>{value}</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Finance Tab ──────────────────────────────────────────────── */
function FinanceTab({ fromDate, toDate }: { fromDate: string; toDate: string }) {
  const { data: summaryData } = useFinanceSummary({ from: fromDate, to: toDate })
  const s = summaryData as any

  const salesRevenue = s?.salesRevenue ?? 0
  const otherIncome  = s?.otherIncome  ?? 0
  const totalIncome  = s?.totalIncome  ?? 0
  const cogs         = s?.cogs         ?? 0
  const grossProfit  = s?.grossProfit  ?? 0
  const opExpenses   = s?.opExpenses   ?? 0
  const netProfit    = s?.profit       ?? 0
  const grossMargin  = salesRevenue > 0 ? Math.round((grossProfit  / salesRevenue) * 100) : 0
  const netMargin    = totalIncome  > 0 ? Math.round((netProfit    / totalIncome)  * 100) : 0
  const cogsRatio    = salesRevenue > 0 ? Math.round((cogs         / salesRevenue) * 100) : 0
  const opexRatio    = totalIncome  > 0 ? Math.round((opExpenses   / totalIncome)  * 100) : 0

  type PLRow = { label: string; value?: number; pct?: number; bold?: boolean; separator?: boolean; positive?: boolean; indent?: boolean }
  const plRows: PLRow[] = [
    { label: 'Sales Revenue',        value: salesRevenue, positive: true                                    },
    { label: 'Other Income',         value: otherIncome,  positive: true,  indent: true                    },
    { label: 'Total Income',         value: totalIncome,  positive: true,  bold: true, separator: true      },
    { label: 'Cost of Goods (COGS)', value: cogs,         positive: false, indent: true                    },
    { label: 'Gross Profit',         value: grossProfit,  positive: grossProfit >= 0, bold: true            },
    { label: 'Gross Margin',         pct: grossMargin,    positive: grossMargin >= 0, indent: true          },
    { label: 'Operating Expenses',   value: opExpenses,   positive: false, indent: true, separator: true   },
    { label: 'Net Profit',           value: netProfit,    positive: netProfit >= 0,   bold: true            },
    { label: 'Net Profit Margin',    pct: netMargin,      positive: netMargin >= 0,   indent: true          },
  ]

  const exportRows = plRows.filter(r => r.value !== undefined).map(r => [r.label, r.value!.toFixed(2)])

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Sales Revenue"    value={formatCurrency(salesRevenue)} icon={ArrowUpRight}   color="green"  />
        <StatCard label="Gross Profit"     value={formatCurrency(grossProfit)}  icon={TrendingUp}     color="cyan"   sub={`${grossMargin}% gross margin`} />
        <StatCard label="Op. Expenses"     value={formatCurrency(opExpenses)}   icon={ArrowDownRight} color="red"    />
        <StatCard label="Net Profit"       value={formatCurrency(netProfit)}    icon={Wallet}         color={netProfit >= 0 ? 'violet' : 'red'} sub={`${netMargin}% net margin`} />
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle title="Profit & Loss Statement" sub={`Period: ${fromDate} → ${toDate}`} />
          <ExportCSV filename="pl-report.csv" headers={['Item','Amount (LKR)']} rows={exportRows} />
        </div>
        <div className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--border-subtle)' }}>
          {plRows.map((row, i) => (
            <div key={i}
              className={['flex justify-between items-center px-4 py-2.5', row.bold ? 'font-semibold' : ''].join(' ')}
              style={{
                borderTop: row.separator ? '2px solid var(--border-default)' : i > 0 ? '1px solid var(--border-subtle)' : 'none',
                background: row.bold ? 'var(--bg-subtle)' : 'transparent',
              }}>
              <span className={`text-sm ${row.indent ? 'pl-5' : ''}`}
                style={{ color: row.bold ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                {row.label}
              </span>
              {row.value !== undefined ? (
                <span className={`text-sm font-semibold ${row.bold ? 'text-base' : ''} ${row.positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {row.positive ? '+' : '−'}{formatCurrency(Math.abs(row.value))}
                </span>
              ) : (
                <span className={`text-sm font-medium ${row.positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {row.pct}%
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card p-4" style={{
          borderColor: netProfit >= 0 ? 'rgba(21,128,61,0.3)' : 'rgba(185,28,28,0.3)',
          background:  netProfit >= 0 ? 'rgba(21,128,61,0.05)' : 'rgba(185,28,28,0.05)',
        }}>
          <div className="flex items-center gap-2 mb-2">
            {netProfit >= 0
              ? <CheckCircle size={14} className="text-green-600 dark:text-green-400" />
              : <AlertTriangle size={14} className="text-red-600 dark:text-red-400" />}
            <span className={`text-xs font-semibold ${netProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {netProfit >= 0 ? 'Profitable Period' : 'Loss Period — Review Expenses'}
            </span>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {netProfit >= 0
              ? `Net profit: ${formatCurrency(netProfit)} · ${netMargin}% margin.`
              : `Net loss: ${formatCurrency(Math.abs(netProfit))}. Review operating expenses.`}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>Efficiency Ratios</p>
          <div className="space-y-2">
            {[
              { label: 'COGS % of Revenue',  value: cogsRatio,    good: cogsRatio < 70   },
              { label: 'OpEx % of Revenue',  value: opexRatio,    good: opexRatio < 30   },
              { label: 'Gross Margin',       value: grossMargin,  good: grossMargin > 20 },
              { label: 'Net Margin',         value: netMargin,    good: netMargin > 10   },
            ].map(({ label, value, good }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(Math.abs(value), 100)}%`, background: good ? '#15803d' : '#b91c1c' }} />
                  </div>
                  <span className={`text-xs font-semibold w-8 text-right ${good ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{value}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────────── */
export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [period, setPeriod]       = useState('30')

  const toDate   = useMemo(() => new Date().toISOString().split('T')[0], [])
  const fromDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - parseInt(period) + 1)
    return d.toISOString().split('T')[0]
  }, [period])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Live business data · Period-based · CSV export</p>
        </div>
        <div className="flex gap-1 p-1 rounded-xl sm:ml-auto" style={{ background: 'var(--bg-subtle)' }}>
          {PERIODS.map(p => (
            <button key={p.days} onClick={() => setPeriod(p.days)}
              className="px-3 py-1.5 text-xs rounded-lg font-medium transition-colors"
              style={period === p.days ? { background: '#6d28d9', color: '#fff' } : { color: 'var(--text-muted)' }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: 'var(--bg-subtle)', width: 'fit-content', maxWidth: '100%' }}>
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg font-medium transition-all whitespace-nowrap"
              style={activeTab === tab.id
                ? { background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }
                : { color: 'var(--text-muted)' }}>
              <Icon size={13} /> {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'overview'  && <OverviewTab days={period} fromDate={fromDate} toDate={toDate} />}
      {activeTab === 'sales'     && <SalesTab    days={period} fromDate={fromDate} toDate={toDate} />}
      {activeTab === 'finance'   && <FinanceTab  fromDate={fromDate} toDate={toDate} />}
      {activeTab === 'inventory' && <InventoryTab />}
      {activeTab === 'repairs'   && <RepairsTab />}
      {activeTab === 'delivery'  && <DeliveryTab days={period} />}
    </div>
  )
}
