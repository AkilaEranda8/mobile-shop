'use client'
// v2
import { useState, useMemo, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ComposedChart, Line, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Package, Wrench, Truck, Download,
  ShoppingCart, AlertTriangle, CheckCircle, Clock, XCircle,
  DollarSign, BarChart3, ArrowUpRight, ArrowDownRight, Users,
  Calendar, Activity, PhoneCall,
} from 'lucide-react'
import {
  useRevenue, useTopProducts, useRepairsByStatus, useRepairs, useProducts,
  useInventorySummary, useDeliverySummary, useAnalyticsDashboard,
  useFinanceSummary, useDailyReloadReport, useFeatureFlag, usePlStatement,
} from '@/lib/hooks'
import { getActiveBranchId } from '@/lib/active-branch'
import { formatCurrency } from '@/lib/utils'
import {
  aggregateRepairStatement,
  buildRepairStatementRows,
  buildCsvContent,
  computeStatusBreakdown,
  FULL_STATEMENT_HEADERS,
  fullStatementCsvRow,
  groupDeliveredByDay,
  PARTS_DETAIL_HEADERS,
  partsDetailCsvRows,
} from '@/lib/repair-statement.util'
import type { RepairTicket } from '@/types'
import { businessToday, businessPeriodFrom, shiftBusinessDate, formatBusinessDateLabel } from '@/lib/business-date'
import { PlStatementBody, type PlStatementLine } from '@/components/finance/PlStatementBody'

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
    const csv  = buildCsvContent(headers, rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(blob); a.download = filename; a.click()
  }
  return (
    <button onClick={handle} className="flex items-center gap-1.5 text-xs hover:text-violet-600 dark:hover:text-violet-400 border px-3 py-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
      <Download size={12} /> Export CSV
    </button>
  )
}

type FetchSlice = { loading: boolean; error: string | null; refetch?: () => void }

function combineFetch(...items: FetchSlice[]) {
  return {
    loading: items.some(i => i.loading),
    error: items.find(i => i.error)?.error ?? null,
    refetch: () => items.forEach(i => i.refetch?.()),
  }
}

function ReportTabState({ loading, error, label, onRetry }: { loading: boolean; error?: string | null; label?: string; onRetry?: () => void }) {
  if (!loading && !error) return null
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm" style={{ color: 'var(--text-muted)' }}>
        Loading {label ?? 'report'}…
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-sm">
      <p className="text-red-600 dark:text-red-400">{error ?? 'Failed to load data'}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="text-xs px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
          Retry
        </button>
      )}
    </div>
  )
}

/* ── tabs ───────────────────────────────────────────────────────── */
const BASE_TABS = [
  { id: 'overview',     label: 'Overview',      icon: BarChart3    },
  { id: 'sales',        label: 'Sales',         icon: ShoppingCart },
  { id: 'pl',           label: 'P&L Report',    icon: DollarSign   },
  { id: 'cashflow',     label: 'Cash Flow',     icon: Activity     },
  { id: 'inventory',    label: 'Inventory',     icon: Package      },
  { id: 'repairs',      label: 'Repairs',       icon: Wrench       },
  { id: 'delivery',     label: 'Delivery',      icon: Truck        },
]
const RELOAD_TAB = { id: 'dailyreload', label: 'Daily Reload', icon: PhoneCall }

/* ── Daily Reload Tab ──────────────────────────────────────────── */
function DailyReloadTab({ fromDate, toDate, branchId }: { fromDate: string; toDate: string; branchId?: string }) {
  const params: Record<string, string> = { from: fromDate, to: toDate }
  if (branchId) params.branchId = branchId
  const { data: rawData, loading, error, refetch } = useDailyReloadReport(params)
  const d = rawData as any

  const totalCount   = d?.totalCount   ?? 0
  const totalAmount  = d?.totalAmount  ?? 0
  const commission   = d?.commission   ?? 0
  const successCount = d?.successCount ?? 0
  const failCount    = d?.failCount    ?? 0
  const breakdown: any[] = d?.dailyBreakdown ?? []
  const successRate  = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0

  const chartData = breakdown.map((r: any) => ({
    date:       formatBusinessDateLabel(r.date),
    Amount:     r.totalAmount,
    Commission: r.commission,
  }))

  const exportRows = breakdown.map((r: any) => [
    r.date, r.count, r.totalAmount.toFixed(2), r.commission.toFixed(2), r.successCount, r.count - r.successCount,
  ])

  const tabState = combineFetch({ loading, error, refetch })
  if (tabState.loading || tabState.error) {
    return <ReportTabState loading={tabState.loading} error={tabState.error} label="daily reload report" onRetry={tabState.refetch} />
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Reloads"       value={String(totalCount)}           icon={PhoneCall}    color="violet" />
        <StatCard label="Total Amount"        value={formatCurrency(totalAmount)}  icon={DollarSign}   color="blue"   />
        <StatCard label="Commission (Profit)" value={formatCurrency(commission)}   icon={TrendingUp}   color="green"  sub="Per provider rates" />
        <StatCard label="Success Rate"        value={`${successRate}%`}            icon={CheckCircle}  color="green"  sub={`${failCount} failed`} />
      </div>

      <div className="card p-5">
        <SectionTitle title="Daily Reload Revenue &amp; Commission" sub={`${fromDate} → ${toDate}`} />
        {chartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>No reload data for this period</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} tickFormatter={v => formatCurrency(v)} width={70} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => formatCurrency(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Amount"     fill="#6d28d9" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Commission" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle title="Daily Breakdown" />
          <ExportCSV filename="reload-report.csv" headers={['Date','Reloads','Amount','Commission','Success','Failed']} rows={exportRows} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {['Date','Reloads','Total Amount','Commission','Success','Failed'].map((h, i) => (
                  <th key={h} className={`text-[11px] font-semibold uppercase tracking-wide px-3 py-2 ${i === 0 ? 'text-left' : 'text-right'}`} style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {breakdown.map((r: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="px-3 py-2.5 text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{r.date}</td>
                  <td className="px-3 py-2.5 text-xs text-right" style={{ color: 'var(--text-secondary)' }}>{r.count}</td>
                  <td className="px-3 py-2.5 text-xs text-right font-semibold text-violet-600 dark:text-violet-400">{formatCurrency(r.totalAmount)}</td>
                  <td className="px-3 py-2.5 text-xs text-right font-semibold text-green-600 dark:text-green-400">{formatCurrency(r.commission)}</td>
                  <td className="px-3 py-2.5 text-xs text-right text-green-600 dark:text-green-400">{r.successCount}</td>
                  <td className="px-3 py-2.5 text-xs text-right text-red-600 dark:text-red-400">{r.count - r.successCount}</td>
                </tr>
              ))}
              {breakdown.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-xs" style={{ color: 'var(--text-muted)' }}>No reload data for this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ── Sales Tab ─────────────────────────────────────────────────── */
function SalesTab({ days, fromDate, toDate, branchId }: { days: string; fromDate: string; toDate: string; branchId?: string }) {
  const revParams: Record<string, string> = { from: fromDate, to: toDate }
  const topParams: Record<string, string> = { limit: '10', from: fromDate, to: toDate }
  if (branchId) { revParams.branchId = branchId; topParams.branchId = branchId }
  const revFetch = useRevenue(revParams)
  const topFetch = useTopProducts(topParams)
  const { data: rawRevenue } = revFetch
  const { data: topProductsData } = topFetch
  const tabState = combineFetch(revFetch, topFetch)
  const revenueArr: any[] = Array.isArray(rawRevenue) ? rawRevenue : []
  const topProducts: any[] = Array.isArray(topProductsData) ? topProductsData : []

  const totalRevenue  = revenueArr.reduce((s, d) => s + (d.totalRevenue ?? 0), 0)
  const totalProfit   = revenueArr.reduce((s, d) => s + (d.profit ?? 0), 0)
  const totalCost     = revenueArr.reduce((s, d) => s + (d.totalExpenses ?? 0) + (d.cogs ?? 0) + (d.refundsTotal ?? 0), 0)
  const avgDaily      = revenueArr.length > 0 ? totalRevenue / revenueArr.length : 0
  const marginPct     = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0'

  const chartData = useMemo(() => revenueArr.map(d => ({
    date:     formatBusinessDateLabel(d.date),
    Revenue:  d.totalRevenue ?? 0,
    Profit:   d.profit ?? 0,
    Expenses: (d.totalExpenses ?? 0) + (d.cogs ?? 0) + (d.refundsTotal ?? 0),
  })), [revenueArr])

  const exportRows = topProducts.map(p => [p.productName, p.quantitySold, p.revenue])

  if (tabState.loading || tabState.error) {
    return <ReportTabState loading={tabState.loading} error={tabState.error} label="sales report" onRetry={tabState.refetch} />
  }

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
function InventoryTab({ branchId }: { branchId?: string }) {
  const params = branchId ? { branchId } : undefined
  const invFetch = useInventorySummary(params)
  const { data: invData } = invFetch
  const inv = invData as any

  const byCategory: any[] = inv?.byCategory ?? []
  const totalStockValue   = inv?.totalStockValue ?? 0
  const totalProducts     = inv?.totalProducts ?? 0
  const lowStockCount     = inv?.lowStockCount ?? 0
  const outOfStockCount   = inv?.outOfStockCount ?? 0

  const exportRows = byCategory.map(c => [c.name, c.products, c.totalStock, c.stockValue, c.lowStock, c.outOfStock])

  if (invFetch.loading || invFetch.error) {
    return <ReportTabState loading={invFetch.loading} error={invFetch.error} label="inventory report" onRetry={invFetch.refetch} />
  }

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
type RepairStatementFilter = 'all' | 'delivered' | 'active' | 'cancelled'

function StatementLine({ label, value, bold, highlight, indent }: {
  label: string; value: string; bold?: boolean; highlight?: 'green' | 'amber' | 'muted'; indent?: boolean
}) {
  const color =
    highlight === 'green' ? 'text-green-600 dark:text-green-400'
    : highlight === 'amber' ? 'text-amber-600 dark:text-amber-400'
    : highlight === 'muted' ? 'var(--text-muted)'
    : 'var(--text-primary)'
  return (
    <div className={`flex justify-between items-center gap-4 text-xs ${indent ? 'pl-3' : ''}`}>
      <span style={{ color: indent ? 'var(--text-muted)' : 'var(--text-secondary)' }}>{label}</span>
      <span className={bold ? 'font-black text-sm' : 'font-semibold'} style={{ color }}>{value}</span>
    </div>
  )
}

function RepairsTab({ branchId, fromDate, toDate }: { branchId?: string; fromDate: string; toDate: string }) {
  const baseParams: Record<string, string> = { ...(branchId ? { branchId } : {}) }
  const receivedParams = { ...baseParams, from: fromDate, to: toDate }
  const deliveredParams = { ...baseParams, completedFrom: fromDate, completedTo: toDate, status: 'DELIVERED' }

  const receivedFetch = useRepairs(receivedParams)
  const deliveredFetch = useRepairs(deliveredParams)
  const { data: productsData } = useProducts()
  const [stmtFilter, setStmtFilter] = useState<RepairStatementFilter>('delivered')

  const receivedRepairs = (receivedFetch.data?.data ?? []) as RepairTicket[]
  const deliveredRepairs = (deliveredFetch.data?.data ?? []) as RepairTicket[]

  const getBuyPrice = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of (productsData?.data ?? []) as any[]) {
      if (p?.id && p.buyingPrice != null) map.set(p.id, Number(p.buyingPrice))
    }
    return (productId: string) => map.get(productId)
  }, [productsData])

  const receivedBreakdown = useMemo(() => computeStatusBreakdown(receivedRepairs), [receivedRepairs])
  const receivedTotal = receivedRepairs.length
  const receivedActive = receivedRepairs.filter(r => !['DELIVERED', 'CANCELLED'].includes(r.status)).length
  const receivedDelivered = receivedRepairs.filter(r => r.status === 'DELIVERED').length
  const receivedCancelled = receivedRepairs.filter(r => r.status === 'CANCELLED').length

  const deliveredRows = useMemo(
    () => buildRepairStatementRows(deliveredRepairs, getBuyPrice),
    [deliveredRepairs, getBuyPrice],
  )
  const totals = useMemo(() => aggregateRepairStatement(deliveredRows), [deliveredRows])
  const dailyData = useMemo(() => groupDeliveredByDay(deliveredRows), [deliveredRows])

  const pieData = receivedBreakdown.map((r, i) => ({
    name: STATUS_LABEL[r.status] ?? r.status,
    value: r.count,
    fill: PIE_COLORS[i % PIE_COLORS.length],
  }))

  const tableSource = useMemo(() => {
    if (stmtFilter === 'delivered') return deliveredRows
    const receivedRows = buildRepairStatementRows(receivedRepairs, getBuyPrice)
    if (stmtFilter === 'active') {
      return receivedRows.filter(r => !['DELIVERED', 'CANCELLED'].includes(r.repair.status))
    }
    if (stmtFilter === 'cancelled') {
      return receivedRows.filter(r => r.repair.status === 'CANCELLED')
    }
    return receivedRows
  }, [stmtFilter, deliveredRows, receivedRepairs, getBuyPrice])

  const fullStatementExport = useMemo(
    () => tableSource.map(fullStatementCsvRow),
    [tableSource],
  )
  const partsDetailExport = useMemo(
    () => partsDetailCsvRows(deliveredRows),
    [deliveredRows],
  )

  const tabState = combineFetch(receivedFetch, deliveredFetch)
  if (tabState.loading || tabState.error) {
    return <ReportTabState loading={tabState.loading} error={tabState.error} label="repairs report" onRetry={tabState.refetch} />
  }

  const periodLabel = `${fromDate} → ${toDate}`

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Jobs Received" value={String(receivedTotal)} icon={Wrench} color="violet" sub={periodLabel} />
        <StatCard label="Active (Period)" value={String(receivedActive)} icon={Clock} color="yellow" />
        <StatCard label="Delivered (Period)" value={String(totals.jobCount)} icon={CheckCircle} color="green" sub="By completion date" />
        <StatCard label="Net Profit" value={formatCurrency(totals.totalProfit)} icon={TrendingUp} color="green" sub={`${totals.marginPct}% margin`} />
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 card p-5">
          <SectionTitle title="Repair Financial Statement" sub={`Delivered jobs · ${periodLabel}`} />
          <div className="rounded-xl border p-4 space-y-2.5" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
            <StatementLine label="Jobs Completed" value={String(totals.jobCount)} />
            <StatementLine label="Customer Quotes" value={formatCurrency(totals.serviceCharge)} />
            <StatementLine label="Less: Discounts" value={`−${formatCurrency(totals.discount)}`} highlight="amber" />
            <div className="border-t my-2" style={{ borderColor: 'var(--border-subtle)' }} />
            <StatementLine label="Collected Revenue" value={formatCurrency(totals.customerRevenue)} bold />
            <StatementLine label="Cash Received" value={formatCurrency(totals.cashReceived)} indent />
            <StatementLine label="Customer Credit (Due)" value={formatCurrency(totals.creditDue)} indent highlight={totals.creditDue > 0 ? 'amber' : 'muted'} />
            <div className="border-t my-2" style={{ borderColor: 'var(--border-subtle)' }} />
            <StatementLine label="Parts Inventory Cost" value={formatCurrency(totals.partsBuyTotal)} />
            <StatementLine label="Parts Margin" value={formatCurrency(totals.partsMargin)} highlight="green" />
            <StatementLine label="Labour Share" value={formatCurrency(totals.labourShare)} />
            <div className="border-t my-2" style={{ borderColor: 'var(--border-subtle)' }} />
            <StatementLine label="NET PROFIT" value={formatCurrency(totals.totalProfit)} bold highlight="green" />
            <p className="text-[10px] pt-1" style={{ color: 'var(--text-muted)' }}>
              Net profit = collected − parts buy · Avg {formatCurrency(totals.avgProfitPerJob)} per job
            </p>
          </div>
        </div>

        <div className="lg:col-span-2 card p-5">
          <SectionTitle title="Period Pipeline" sub="Jobs received in date range" />
          <div className="space-y-2">
            {[
              { label: 'Received', value: receivedTotal, pct: 100 },
              { label: 'Still Active', value: receivedActive, pct: receivedTotal ? Math.round((receivedActive / receivedTotal) * 100) : 0 },
              { label: 'Delivered', value: receivedDelivered, pct: receivedTotal ? Math.round((receivedDelivered / receivedTotal) * 100) : 0 },
              { label: 'Cancelled', value: receivedCancelled, pct: receivedTotal ? Math.round((receivedCancelled / receivedTotal) * 100) : 0 },
            ].map((row, i) => (
              <div key={row.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: 'var(--text-primary)' }}>{row.label}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{row.value} <span style={{ color: 'var(--text-muted)' }}>({row.pct}%)</span></span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${row.pct}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div className="card p-5">
          <SectionTitle title="Daily Delivered — Revenue & Profit" sub={periodLabel} />
          {dailyData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>No delivered jobs in this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={dailyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} tickFormatter={v => formatCurrency(v)} width={70} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="collected" name="Collected" fill="#6d28d9" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="profit" name="Net Profit" stroke="#16a34a" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle title="Status Breakdown" sub="Received in period" />
            <ExportCSV filename="repairs-status.csv" headers={['Status', 'Count']} rows={receivedBreakdown.map(r => [STATUS_LABEL[r.status] ?? r.status, r.count])} />
          </div>
          {pieData.length === 0 ? (
            <p className="text-xs text-center py-16" style={{ color: 'var(--text-muted)' }}>No repair jobs received in this period</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={78} innerRadius={38}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle title="Full Repair Statement" sub={`${tableSource.length} jobs · export for accounting`} />
          <div className="flex flex-wrap items-center gap-2">
            {([
              ['delivered', 'Delivered'],
              ['all', 'All Received'],
              ['active', 'Active'],
              ['cancelled', 'Cancelled'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setStmtFilter(id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${stmtFilter === id ? 'bg-violet-500/15 border-violet-500/30 text-violet-600 dark:text-violet-300' : ''}`}
                style={stmtFilter !== id ? { borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' } : undefined}
              >
                {label}
              </button>
            ))}
            <ExportCSV filename={`repair-statement-${fromDate}-${toDate}.csv`} headers={[...FULL_STATEMENT_HEADERS]} rows={fullStatementExport} />
            <ExportCSV filename={`repair-parts-detail-${fromDate}-${toDate}.csv`} headers={[...PARTS_DETAIL_HEADERS]} rows={partsDetailExport} />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard label="Quote Total" value={formatCurrency(totals.serviceCharge)} icon={DollarSign} color="blue" />
          <StatCard label="Discounts" value={formatCurrency(totals.discount)} icon={DollarSign} color="amber" />
          <StatCard label="Collected" value={formatCurrency(totals.customerRevenue)} icon={DollarSign} color="violet" />
          <StatCard label="Parts Margin" value={formatCurrency(totals.partsMargin)} icon={Package} color="cyan" />
          <StatCard label="Cash In" value={formatCurrency(totals.cashReceived)} icon={DollarSign} color="green" sub={totals.creditDue > 0 ? `${formatCurrency(totals.creditDue)} credit` : undefined} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-xs">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                {['Ticket', 'Received', 'Completed', 'Customer', 'Device', 'Status', 'Quote', 'Discount', 'Collected', 'Cash', 'Credit', 'Parts', 'Parts Buy', 'Labour', 'Net Profit'].map(h => (
                  <th key={h} className={`${['Ticket', 'Received', 'Completed', 'Customer', 'Device', 'Status'].includes(h) ? 'text-left' : 'text-right'} py-2 px-2 font-bold uppercase tracking-wide whitespace-nowrap`} style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableSource.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-12 text-center" style={{ color: 'var(--text-muted)' }}>No jobs match this filter for the selected period</td>
                </tr>
              ) : tableSource.map(({ repair: r, report, payment }) => {
                const isDelivered = r.status === 'DELIVERED'
                return (
                  <tr key={r.id} className="border-b hover:bg-white/[0.02]" style={{ borderColor: 'var(--border-subtle)' }}>
                    <td className="py-2.5 px-2 font-mono text-violet-500 whitespace-nowrap">{r.ticketNumber}</td>
                    <td className="py-2.5 px-2 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{r.createdAt?.slice(0, 10)}</td>
                    <td className="py-2.5 px-2 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{r.completedAt?.slice(0, 10) ?? '—'}</td>
                    <td className="py-2.5 px-2 max-w-[120px] truncate" style={{ color: 'var(--text-primary)' }}>{r.customerName}</td>
                    <td className="py-2.5 px-2 max-w-[140px] truncate" style={{ color: 'var(--text-secondary)' }}>{r.deviceBrand} {r.deviceModel}</td>
                    <td className="py-2.5 px-2 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{STATUS_LABEL[r.status] ?? r.status}</td>
                    <td className="py-2.5 px-2 text-right" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(report.serviceCharge)}</td>
                    <td className="py-2.5 px-2 text-right text-amber-600 dark:text-amber-400">{isDelivered && report.discount > 0 ? `−${formatCurrency(report.discount)}` : '—'}</td>
                    <td className="py-2.5 px-2 text-right font-semibold" style={{ color: 'var(--text-primary)' }}>{isDelivered ? formatCurrency(report.customerRevenue) : '—'}</td>
                    <td className="py-2.5 px-2 text-right text-green-600 dark:text-green-400">{isDelivered ? formatCurrency(payment.paid) : '—'}</td>
                    <td className="py-2.5 px-2 text-right text-amber-600 dark:text-amber-400">{isDelivered && payment.due > 0 ? formatCurrency(payment.due) : '—'}</td>
                    <td className="py-2.5 px-2 text-right" style={{ color: 'var(--text-muted)' }}>{r.spareParts?.length ?? 0}</td>
                    <td className="py-2.5 px-2 text-right" style={{ color: 'var(--text-muted)' }}>{isDelivered ? formatCurrency(report.partsBuyTotal) : '—'}</td>
                    <td className="py-2.5 px-2 text-right" style={{ color: 'var(--text-secondary)' }}>{isDelivered ? formatCurrency(report.labourShare) : '—'}</td>
                    <td className="py-2.5 px-2 text-right font-bold text-green-600 dark:text-green-400">{isDelivered ? formatCurrency(report.netProfit) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
            {stmtFilter === 'delivered' && tableSource.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--bg-subtle)' }}>
                  <td colSpan={6} className="py-2.5 px-2 font-bold" style={{ color: 'var(--text-muted)' }}>Totals (Delivered)</td>
                  <td className="py-2.5 px-2 text-right font-bold">{formatCurrency(totals.serviceCharge)}</td>
                  <td className="py-2.5 px-2 text-right font-bold text-amber-600 dark:text-amber-400">{totals.discount > 0 ? `−${formatCurrency(totals.discount)}` : '—'}</td>
                  <td className="py-2.5 px-2 text-right font-bold">{formatCurrency(totals.customerRevenue)}</td>
                  <td className="py-2.5 px-2 text-right font-bold text-green-600 dark:text-green-400">{formatCurrency(totals.cashReceived)}</td>
                  <td className="py-2.5 px-2 text-right font-bold text-amber-600 dark:text-amber-400">{totals.creditDue > 0 ? formatCurrency(totals.creditDue) : '—'}</td>
                  <td className="py-2.5 px-2 text-right font-bold">{totals.partLineCount}</td>
                  <td className="py-2.5 px-2 text-right font-bold">{formatCurrency(totals.partsBuyTotal)}</td>
                  <td className="py-2.5 px-2 text-right font-bold">{formatCurrency(totals.labourShare)}</td>
                  <td className="py-2.5 px-2 text-right font-bold text-green-600 dark:text-green-400">{formatCurrency(totals.totalProfit)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}

/* ── Delivery Tab ───────────────────────────────────────────────── */
function DeliveryTab({ fromDate, toDate, branchId }: { fromDate: string; toDate: string; branchId?: string }) {
  const params: Record<string, string> = { from: fromDate, to: toDate }
  if (branchId) params.branchId = branchId
  const delFetch = useDeliverySummary(params)
  const { data: delData } = delFetch
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

  if (delFetch.loading || delFetch.error) {
    return <ReportTabState loading={delFetch.loading} error={delFetch.error} label="delivery report" onRetry={delFetch.refetch} />
  }

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
          ) : <p className="text-xs text-gray-500 dark:text-slate-500 text-center py-16">No delivery data</p>}
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
          ) : <p className="text-xs text-gray-500 dark:text-slate-500 text-center py-16">No delivery data</p>}
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
function OverviewTab({ days, fromDate, toDate, branchId }: { days: string; fromDate: string; toDate: string; branchId?: string }) {
  const revParams: Record<string, string> = { from: fromDate, to: toDate }
  const branchParams = branchId ? { branchId } : undefined
  if (branchId) revParams.branchId = branchId
  const dashFetch    = useAnalyticsDashboard(branchId)
  const revFetch     = useRevenue(revParams)
  const repairFetch  = useRepairsByStatus(branchParams)
  const invFetch     = useInventorySummary(branchParams)
  const tabState     = combineFetch(dashFetch, revFetch, repairFetch, invFetch)
  const { data: dashData }         = dashFetch
  const { data: rawRevenue }       = revFetch
  const { data: repairStatusData } = repairFetch
  const { data: invData }          = invFetch

  const dash = dashData as any
  const revenue: any[]  = Array.isArray(rawRevenue) ? rawRevenue : []
  const repairs: any[]  = Array.isArray(repairStatusData) ? repairStatusData : []
  const inv = invData as any

  const totalRevenue  = revenue.reduce((s, d) => s + (d.totalRevenue ?? 0), 0)
  const totalProfit   = revenue.reduce((s, d) => s + (d.profit ?? 0), 0)
  const totalCost     = revenue.reduce((s, d) => s + (d.totalExpenses ?? 0) + (d.cogs ?? 0) + (d.refundsTotal ?? 0), 0)
  const margin        = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0
  const activeRepairs = repairs.filter(r => !['DELIVERED','CANCELLED'].includes(r.status)).reduce((s, r) => s + (r.count ?? 0), 0)

  const chartData = useMemo(() => revenue.map((d: any) => ({
    date:    formatBusinessDateLabel(d.date),
    Revenue: d.totalRevenue ?? 0,
    Profit:  d.profit ?? 0,
    Cost:    (d.totalExpenses ?? 0) + (d.cogs ?? 0) + (d.refundsTotal ?? 0),
  })), [revenue])

  const health = [
    { label: `${days}d Revenue`,    value: formatCurrency(totalRevenue),           good: totalRevenue > 0         },
    { label: 'Profit Margin',        value: `${margin}%`,                           good: margin >= 15             },
    { label: 'Low Stock Items',      value: `${dash?.lowStockCount ?? 0} items`,    good: (dash?.lowStockCount ?? 0) === 0 },
    { label: 'Active Repairs',       value: String(activeRepairs),                  good: activeRepairs < 10       },
    { label: 'Expiring Warranties',  value: String(dash?.expiringWarranties ?? 0),  good: (dash?.expiringWarranties ?? 0) === 0 },
  ]

  if (tabState.loading || tabState.error) {
    return <ReportTabState loading={tabState.loading} error={tabState.error} label="overview" onRetry={tabState.refetch} />
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label={`${days}d Revenue`}    value={formatCurrency(totalRevenue)}             icon={DollarSign}    color="violet" />
        <StatCard label={`${days}d Net Profit`} value={formatCurrency(totalProfit)}             icon={TrendingUp}    color="green"  sub={`${margin}% margin`} />
        <StatCard label={`${days}d Total Cost`} value={formatCurrency(totalCost)}               icon={TrendingDown}  color="red"    />
        <StatCard label="Today's Revenue"       value={formatCurrency(dash?.todayRevenue ?? 0)} icon={ShoppingCart}  color="blue"   sub={`${dash?.todaySalesCount ?? 0} sales`} />
        <StatCard label="Total Customers"       value={(dash?.totalCustomers ?? 0).toLocaleString()} icon={Users}    color="orange" />
        <StatCard label="Low Stock Items"       value={(inv?.lowStockCount ?? dash?.lowStockCount ?? 0).toString()}   icon={AlertTriangle} color="yellow" sub="Below min stock" />
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

/* ── P&L Tab ──────────────────────────────────────────────────── */
function PLTab({ fromDate, toDate, branchId }: { fromDate: string; toDate: string; branchId?: string }) {
  const mkParams = (extra: Record<string, string> = {}): Record<string, string> => {
    const p: Record<string, string> = { from: fromDate, to: toDate, ...extra }
    if (branchId) p.branchId = branchId
    return p
  }
  const plFetch = usePlStatement(mkParams())
  const { data: plData } = plFetch

  const periodDays = useMemo(() => {
    const ms = new Date(toDate).getTime() - new Date(fromDate).getTime()
    return Math.max(1, Math.round(ms / 86400000) + 1)
  }, [fromDate, toDate])

  const d = plData as any
  const summary = d?.summary ?? {}
  const previous = d?.previous ?? {}
  const margins = d?.margins ?? { gross: 0, net: 0 }
  const incomeBreakdown: any[] = d?.incomeBreakdown ?? []
  const expenseBreakdown: any[] = d?.expenseBreakdown ?? []
  const insights: string[] = d?.insights ?? []
  const statement: PlStatementLine[] = d?.statement ?? []
  const repairAccrual = d?.repairAccrual ?? { jobs: 0 }

  const salesRevenue = summary.salesRevenue ?? 0
  const otherIncome = summary.otherIncome ?? 0
  const totalIncome = summary.totalIncome ?? 0
  const cogs = summary.cogs ?? 0
  const repairPartsCogs = summary.repairPartsCogs ?? 0
  const posCogs = summary.posCogs ?? (cogs - repairPartsCogs)
  const repairIncome = summary.repairIncome ?? 0
  const grossProfit = summary.grossProfit ?? 0
  const opExpenses = summary.opExpenses ?? 0
  const netProfit = summary.profit ?? 0
  const grossMargin = margins.gross ?? 0
  const netMargin = margins.net ?? 0
  const cogsRatio = salesRevenue > 0 ? Math.round((posCogs / salesRevenue) * 100) : 0
  const opexRatio = totalIncome > 0 ? Math.round((opExpenses / totalIncome) * 100) : 0

  const delta = (curr: number, p: number) => {
    if (!p) return null
    const pct = Math.round(((curr - p) / Math.abs(p)) * 100)
    return { pct, up: curr >= p }
  }
  const DeltaBadge = ({ d: badge }: { d: { pct: number; up: boolean } | null }) => {
    if (!badge) return null
    return <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${badge.up ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>{badge.up ? '▲' : '▼'} {Math.abs(badge.pct)}%</span>
  }

  const waterfallData = [
    { name: 'POS Sales', value: salesRevenue, fill: '#16a34a' },
    { name: 'Repairs', value: repairIncome, fill: '#7c3aed' },
    { name: 'Other', value: Math.max(0, otherIncome - (summary.reloadCommission ?? 0)), fill: '#0e7490' },
    { name: 'POS COGS', value: -posCogs, fill: '#dc2626' },
    { name: 'Parts', value: -repairPartsCogs, fill: '#b91c1c' },
    { name: 'OpEx', value: -opExpenses, fill: '#f97316' },
    { name: 'Net', value: netProfit, fill: netProfit >= 0 ? '#7c3aed' : '#dc2626' },
  ]

  if (plFetch.loading || plFetch.error) {
    return <ReportTabState loading={plFetch.loading} error={plFetch.error} label="P&amp;L report" onRetry={plFetch.refetch} />
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Sales Revenue', val: salesRevenue, d: delta(salesRevenue, previous?.salesRevenue ?? 0), color: 'text-green-600 dark:text-green-400' },
          { label: 'Gross Profit', val: grossProfit, d: delta(grossProfit, previous?.grossProfit ?? 0), color: 'text-cyan-600 dark:text-cyan-400', sub: `${grossMargin}% margin` },
          { label: 'Op. Expenses', val: opExpenses, d: delta(opExpenses, previous?.opExpenses ?? 0), color: 'text-orange-500 dark:text-orange-400' },
          { label: 'Net Profit', val: netProfit, d: delta(netProfit, previous?.profit ?? 0), color: netProfit >= 0 ? 'text-violet-600 dark:text-violet-400' : 'text-red-500', sub: `${netMargin}% net margin` },
        ].map(({ label, val, d: badge, color, sub }) => (
          <div key={label} className="card p-4">
            <p className="text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
            <div className="flex items-baseline gap-1 flex-wrap">
              <p className={`text-lg font-bold ${color}`}>{formatCurrency(val)}</p>
              <DeltaBadge d={badge} />
            </div>
            {sub && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
          </div>
        ))}
      </div>

      {insights.length > 0 && (
        <div className="card p-5">
          <SectionTitle title="Business Insights" />
          <div className="space-y-2">
            {insights.map((text, i) => (
              <p key={i} className="text-xs" style={{ color: 'var(--text-secondary)' }}>{text}</p>
            ))}
          </div>
        </div>
      )}

      {repairAccrual.jobs > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Repair Jobs" value={String(repairAccrual.jobs)} icon={Wrench} color="violet" />
          <StatCard label="Repair Collected" value={formatCurrency(repairAccrual.collected)} icon={DollarSign} color="blue" />
          <StatCard label="Repair Parts Cost" value={formatCurrency(repairAccrual.partsBuy)} icon={Package} color="red" />
          <StatCard label="Repair Net Profit" value={formatCurrency(repairAccrual.netProfit)} icon={TrendingUp} color="green" />
        </div>
      )}

      <div className="card p-5">
        <SectionTitle title="P&L Waterfall" sub="Revenue flow → costs → profit" />
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={waterfallData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} tickFormatter={v => formatCurrency(v)} width={72} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => formatCurrency(Math.abs(v))} />
            <ReferenceLine y={0} stroke="var(--border-default)" strokeWidth={1.5} />
            <Bar dataKey="value" radius={[4, 4, 4, 4]}>
              {waterfallData.map((entry, i) => <Cell key={i} fill={entry.fill} opacity={0.85} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card p-5">
        <SectionTitle title="Profit & Loss Statement" sub={`${fromDate} → ${toDate} · vs prev ${periodDays}d`} />
        <PlStatementBody
          lines={statement}
          exportFilename={`pl-report-${fromDate}-${toDate}.csv`}
          footer={previous ? (
            <p className="text-[11px] mt-3 pt-3" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)' }}>
              Previous period: Revenue {formatCurrency(previous.salesRevenue ?? 0)} · Net {formatCurrency(previous.profit ?? 0)}
            </p>
          ) : undefined}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <SectionTitle title="Income Breakdown" />
          {incomeBreakdown.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>No income recorded</p>
          ) : (
            <div className="space-y-1.5">
              {incomeBreakdown.map((item, i) => (
                <div key={item.key} className="flex justify-between text-xs py-1.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-primary)' }}>{item.label}</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card p-5">
          <SectionTitle title="Expense Breakdown" />
          {expenseBreakdown.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>No expenses recorded</p>
          ) : (
            <div className="space-y-1.5">
              {expenseBreakdown.map(item => (
                <div key={item.key} className="flex justify-between text-xs py-1.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-primary)' }}>{item.label}</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card p-4" style={{ borderColor: netProfit >= 0 ? 'rgba(21,128,61,0.3)' : 'rgba(185,28,28,0.3)', background: netProfit >= 0 ? 'rgba(21,128,61,0.05)' : 'rgba(185,28,28,0.05)' }}>
          <div className="flex items-center gap-2 mb-2">
            {netProfit >= 0 ? <CheckCircle size={14} className="text-green-600 dark:text-green-400" /> : <AlertTriangle size={14} className="text-red-600 dark:text-red-400" />}
            <span className={`text-xs font-semibold ${netProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {netProfit >= 0 ? 'Profitable Period' : 'Loss Period — Review Expenses'}
            </span>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {netProfit >= 0 ? `Net profit: ${formatCurrency(netProfit)} · ${netMargin}% margin` : `Net loss: ${formatCurrency(Math.abs(netProfit))}. Review operating expenses.`}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>Efficiency Ratios</p>
          <div className="space-y-2">
            {[
              { label: 'POS COGS % of Revenue', value: cogsRatio, good: cogsRatio < 70 },
              { label: 'OpEx % of Revenue', value: opexRatio, good: opexRatio < 30 },
              { label: 'Gross Margin', value: grossMargin, good: grossMargin > 20 },
              { label: 'Net Margin', value: netMargin, good: netMargin > 10 },
            ].map(({ label, value, good }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span className={`text-xs font-semibold ${good ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Cash Flow Tab ────────────────────────────────────────────── */
function CashFlowTab({ fromDate, toDate, branchId }: { fromDate: string; toDate: string; branchId?: string }) {
  const cfParams: Record<string, string> = { from: fromDate, to: toDate }
  if (branchId) cfParams.branchId = branchId
  const revFetch = useRevenue(cfParams)
  const { data: rawRevenue } = revFetch
  const revenueArr: any[] = Array.isArray(rawRevenue) ? rawRevenue : []

  const cashFlowData = useMemo(() => {
    let cumulative = 0
    return revenueArr.map(d => {
      const cashIn  = (d.salesRevenue ?? 0) + (d.otherIncome   ?? 0)
      const cashOut = (d.cogs ?? 0) + (d.totalExpenses ?? 0) + (d.refundsTotal ?? 0)
      const net     = cashIn - cashOut
      cumulative   += net
      return { date: formatBusinessDateLabel(d.date), rawDate: d.date, cashIn, cashOut, net, cumulative }
    })
  }, [revenueArr])

  const totalIn  = cashFlowData.reduce((s, d) => s + d.cashIn,  0)
  const totalOut = cashFlowData.reduce((s, d) => s + d.cashOut, 0)
  const netPos   = totalIn - totalOut
  const bestDay  = cashFlowData.length > 0 ? cashFlowData.reduce((b, d) => d.net > b.net ? d : b, cashFlowData[0]) : null

  const exportRows = cashFlowData.map(d => [d.rawDate, d.cashIn.toFixed(2), d.cashOut.toFixed(2), d.net.toFixed(2), d.cumulative.toFixed(2)])

  if (revFetch.loading || revFetch.error) {
    return <ReportTabState loading={revFetch.loading} error={revFetch.error} label="cash flow report" onRetry={revFetch.refetch} />
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Cash In"  value={formatCurrency(totalIn)}  icon={ArrowUpRight}   color="green"  />
        <StatCard label="Total Cash Out" value={formatCurrency(totalOut)} icon={ArrowDownRight} color="red"    />
        <StatCard label="Net Cash Flow"  value={formatCurrency(netPos)}   icon={Activity}       color={netPos >= 0 ? 'violet' : 'red'} sub={netPos >= 0 ? 'Positive' : 'Negative'} />
        <StatCard label="Best Day"       value={bestDay ? formatCurrency(bestDay.net) : '—'} icon={TrendingUp} color="blue" sub={bestDay?.date ?? ''} />
      </div>

      <div className="card p-5">
        <SectionTitle title="Daily Cash Flow" sub="Cash In vs Cash Out · Cumulative net (right axis)" />
        {cashFlowData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>No data for this period</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={cashFlowData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} />
              <YAxis yAxisId="left"  tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} tickFormatter={v => formatCurrency(v)} width={72} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} tickFormatter={v => formatCurrency(v)} width={72} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => formatCurrency(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine yAxisId="left" y={0} stroke="var(--border-default)" strokeWidth={1} />
              <Bar yAxisId="left" dataKey="cashIn"  name="Cash In"    fill="#16a34a" opacity={0.75} radius={[3,3,0,0]} />
              <Bar yAxisId="left" dataKey="cashOut" name="Cash Out"   fill="#dc2626" opacity={0.75} radius={[3,3,0,0]} />
              <Line yAxisId="right" type="monotone" dataKey="cumulative" name="Cumulative Net" stroke="#7c3aed" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle title="Daily Detail" />
          <ExportCSV filename="cashflow.csv" headers={['Date','Cash In','Cash Out','Net','Cumulative']} rows={exportRows} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {['Date','Cash In','Cash Out','Net Cash','Cumulative'].map((h, i) => (
                  <th key={h} className={`text-[11px] font-semibold uppercase tracking-wide px-3 py-2 ${i === 0 ? 'text-left' : 'text-right'}`} style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cashFlowData.map((d, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="px-3 py-2 text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{d.date}</td>
                  <td className="px-3 py-2 text-xs text-right text-green-600 dark:text-green-400 font-medium">{formatCurrency(d.cashIn)}</td>
                  <td className="px-3 py-2 text-xs text-right text-red-600 dark:text-red-400">{formatCurrency(d.cashOut)}</td>
                  <td className={`px-3 py-2 text-xs text-right font-semibold ${d.net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {d.net >= 0 ? '+' : '−'}{formatCurrency(Math.abs(d.net))}
                  </td>
                  <td className={`px-3 py-2 text-xs text-right font-bold ${d.cumulative >= 0 ? 'text-violet-600 dark:text-violet-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(d.cumulative)}
                  </td>
                </tr>
              ))}
              {cashFlowData.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-xs" style={{ color: 'var(--text-muted)' }}>No cash flow data for this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────────── */
const TAB_IDS = new Set([...BASE_TABS.map(t => t.id), RELOAD_TAB.id])

function ReportsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const hasDailyReload = useFeatureFlag('DAILY_RELOAD')
  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab]   = useState('overview')
  const [period, setPeriod]         = useState('30')
  const branchId = getActiveBranchId() ?? ''
  const [isCustom, setIsCustom]     = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]     = useState('')

  useEffect(() => {
    if (!tabFromUrl || !TAB_IDS.has(tabFromUrl)) return
    if (tabFromUrl === 'dailyreload' && !hasDailyReload) return
    setActiveTab(tabFromUrl)
  }, [tabFromUrl, hasDailyReload])

  const selectTab = (id: string) => {
    setActiveTab(id)
    router.replace(`/dashboard/reports?tab=${id}`, { scroll: false })
  }

  const todayStr = useMemo(() => businessToday(), [])

  const toDate = useMemo(() => {
    if (isCustom && customTo) return customTo
    return todayStr
  }, [isCustom, customTo, todayStr])

  const fromDate = useMemo(() => {
    if (isCustom && customFrom) return customFrom
    return businessPeriodFrom(parseInt(period), toDate)
  }, [isCustom, customFrom, period, toDate])

  const handlePeriod = (days: string) => { setPeriod(days); setIsCustom(false) }
  const activeBranch = branchId || undefined
  const TABS = hasDailyReload ? [...BASE_TABS, RELOAD_TAB] : BASE_TABS

  return (
    <div className="space-y-5">
      {/* Header + filter bar */}
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Advanced filters · P&amp;L · Cash Flow · Export CSV</p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* Period presets */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-subtle)' }}>
            {PERIODS.map(p => (
              <button key={p.days} onClick={() => handlePeriod(p.days)}
                className="px-3 py-1.5 text-xs rounded-lg font-medium transition-colors"
                style={!isCustom && period === p.days ? { background: '#6d28d9', color: '#fff' } : { color: 'var(--text-muted)' }}>
                {p.label}
              </button>
            ))}
            <button onClick={() => setIsCustom(true)}
              className="px-3 py-1.5 text-xs rounded-lg font-medium transition-colors flex items-center gap-1"
              style={isCustom ? { background: '#6d28d9', color: '#fff' } : { color: 'var(--text-muted)' }}>
              <Calendar size={11} /> Custom
            </button>
          </div>

          {/* Custom date inputs */}
          {isCustom && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: 'var(--bg-subtle)' }}>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} max={customTo || todayStr}
                className="text-xs bg-transparent outline-none cursor-pointer" style={{ color: 'var(--text-primary)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>→</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} min={customFrom} max={todayStr}
                className="text-xs bg-transparent outline-none cursor-pointer" style={{ color: 'var(--text-primary)' }} />
            </div>
          )}

          {/* Active range label */}
          <span className="text-[11px] px-2 py-1 rounded-lg" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
            {fromDate} → {toDate}
          </span>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: 'var(--bg-subtle)', width: 'fit-content', maxWidth: '100%' }}>
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button key={tab.id} onClick={() => selectTab(tab.id)}
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
      {activeTab === 'overview'  && <OverviewTab  days={period} fromDate={fromDate} toDate={toDate} branchId={activeBranch} />}
      {activeTab === 'sales'     && <SalesTab     days={period} fromDate={fromDate} toDate={toDate} branchId={activeBranch} />}
      {activeTab === 'pl'        && <PLTab        fromDate={fromDate} toDate={toDate} branchId={activeBranch} />}
      {activeTab === 'cashflow'  && <CashFlowTab  fromDate={fromDate} toDate={toDate} branchId={activeBranch} />}
      {activeTab === 'inventory' && <InventoryTab branchId={activeBranch} />}
      {activeTab === 'repairs'      && <RepairsTab branchId={activeBranch} fromDate={fromDate} toDate={toDate} />}
      {activeTab === 'delivery'     && <DeliveryTab fromDate={fromDate} toDate={toDate} branchId={activeBranch} />}
      {activeTab === 'dailyreload'  && <DailyReloadTab fromDate={fromDate} toDate={toDate} branchId={activeBranch} />}
    </div>
  )
}

export default function ReportsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[40vh] text-sm" style={{ color: 'var(--text-muted)' }}>
        Loading Reports &amp; Analytics…
      </div>
    }>
      <ReportsPageContent />
    </Suspense>
  )
}
