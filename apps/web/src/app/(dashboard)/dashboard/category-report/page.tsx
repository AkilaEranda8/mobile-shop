'use client'
import { useState, useMemo } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  TrendingUp, TrendingDown, DollarSign, Package,
  Download, Calendar, Tag, X, ChevronRight, Info,
} from 'lucide-react'
import { useCategorySales, useCategoryProducts, useFeatureFlag } from '@/lib/hooks'
import { getActiveBranchId } from '@/lib/active-branch'
import { formatCurrency } from '@/lib/utils'
import { businessToday, businessPeriodFrom } from '@/lib/business-date'

/* ── constants ─────────────────────────────────────────────────── */
const TOOLTIP_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: '10px',
  fontSize: '12px',
  color: 'var(--text-primary)',
}
const COLORS = ['var(--brand-primary-light)','#1d4ed8','#0e7490','#15803d','#b45309','#b91c1c','var(--brand-primary)','#0369a1','#065f46','#92400e']
const PERIODS = [
  { label: 'Today', days: '1'   },
  { label: '7D',    days: '7'   },
  { label: '30D',   days: '30'  },
  { label: '90D',   days: '90'  },
  { label: '1Y',    days: '365' },
]

/* ── helpers ────────────────────────────────────────────────────── */
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

/* ── custom pie label ───────────────────────────────────────────── */
const renderPieLabel = ({ name, percent }: any) =>
  percent > 0.04 ? `${name} ${(percent * 100).toFixed(0)}%` : ''

/* ── main page ──────────────────────────────────────────────────── */
export default function CategoryReportPage() {
  const hasServices = useFeatureFlag('SERVICES')
  const [period, setPeriod]         = useState('30')
  const branchId = getActiveBranchId() ?? ''
  const [selectedCat, setSelectedCat] = useState('')
  const [isCustom, setIsCustom]     = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]     = useState('')

  const todayStr = useMemo(() => businessToday(), [])

  const toDate = useMemo(() => {
    if (isCustom && customTo) return customTo
    return todayStr
  }, [isCustom, customTo, todayStr])

  const fromDate = useMemo(() => {
    if (isCustom && customFrom) return customFrom
    return businessPeriodFrom(parseInt(period), toDate)
  }, [isCustom, customFrom, period, toDate])

  const apiParams: Record<string, string> = { from: fromDate, to: toDate }
  if (branchId) apiParams.branchId = branchId

  const { data: rawData, loading } = useCategorySales(apiParams)
  const d = rawData as any

  const categories: any[] = d?.categories ?? []
  const totals = d?.totals ?? { revenue: 0, cogs: 0, profit: 0, margin: 0, units: 0 }

  const bestCat = categories[0]

  // Product drill-down
  const productParams: Record<string, string> = { from: fromDate, to: toDate }
  if (branchId)     productParams.branchId = branchId
  if (selectedCat)  productParams.category = selectedCat
  const { data: rawProducts, loading: prodLoading } = useCategoryProducts(
    selectedCat ? productParams : undefined
  )
  const products: any[] = Array.isArray(rawProducts) ? rawProducts : []

  const activeCatData = selectedCat ? categories.find(c => c.category === selectedCat) : null

  const barData = categories.slice(0, 10).map(c => ({
    category: c.category.length > 14 ? c.category.slice(0, 13) + '…' : c.category,
    fullName: c.category,
    Revenue:  c.revenue,
    Profit:   c.profit,
    COGS:     c.cogs,
  }))

  const pieData = categories.slice(0, 8).map((c, i) => ({
    name:  c.category,
    value: c.revenue,
    fill:  COLORS[i % COLORS.length],
  }))

  const productExportRows = products.map((p: any) => [
    p.product, p.sku, p.revenue.toFixed(2), p.cogs.toFixed(2),
    p.profit.toFixed(2), `${p.margin}%`, p.unitsSold, p.transactions,
  ])

  const exportRows = categories.map(c => [
    c.category, c.revenue.toFixed(2), c.cogs.toFixed(2),
    c.profit.toFixed(2), `${c.margin}%`, c.unitsSold, c.transactions,
  ])

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="page-title">Category Sales Report</h1>
          <p className="page-subtitle">
            Revenue · COGS · Profit · Margin — by product category{hasServices ? ' and services' : ''}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* Period presets */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-subtle)' }}>
            {PERIODS.map(p => (
              <button key={p.days} onClick={() => { setPeriod(p.days); setIsCustom(false) }}
                className="px-3 py-1.5 text-xs rounded-lg font-medium transition-colors"
                style={!isCustom && period === p.days ? { background: 'var(--brand-primary-light)', color: '#fff' } : { color: 'var(--text-muted)' }}>
                {p.label}
              </button>
            ))}
            <button onClick={() => setIsCustom(true)}
              className="px-3 py-1.5 text-xs rounded-lg font-medium transition-colors flex items-center gap-1"
              style={isCustom ? { background: 'var(--brand-primary-light)', color: '#fff' } : { color: 'var(--text-muted)' }}>
              <Calendar size={11} /> Custom
            </button>
          </div>

          {isCustom && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: 'var(--bg-subtle)' }}>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} max={customTo || todayStr}
                className="text-xs bg-transparent outline-none cursor-pointer" style={{ color: 'var(--text-primary)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>→</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} min={customFrom} max={todayStr}
                className="text-xs bg-transparent outline-none cursor-pointer" style={{ color: 'var(--text-primary)' }} />
            </div>
          )}

          <span className="text-[11px] px-2 py-1 rounded-lg" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
            {fromDate} → {toDate}
          </span>

          {/* Category selector */}
          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: 'var(--bg-subtle)' }}>
              <Tag size={13} style={{ color: 'var(--text-muted)' }} />
              <select
                value={selectedCat}
                onChange={e => setSelectedCat(e.target.value)}
                className="bg-transparent text-xs outline-none cursor-pointer font-medium"
                style={{ color: selectedCat ? 'var(--brand-primary-light)' : 'var(--text-muted)', minWidth: 120 }}
              >
                <option value="">All Categories</option>
                {categories.map((c: any) => (
                  <option key={c.category} value={c.category}>{c.category}</option>
                ))}
              </select>
              {selectedCat && (
                <button onClick={() => setSelectedCat('')} className="ml-1 hover:text-red-500 transition-colors" style={{ color: 'var(--text-muted)' }}>
                  <X size={11} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl px-4 py-3 flex gap-3 items-start text-xs leading-relaxed" style={{ background: 'var(--brand-glow)', border: '1px solid var(--sidebar-active-border)' }}>
        <Info size={16} className="flex-shrink-0 mt-0.5 text-violet-600 dark:text-violet-400" />
        <div style={{ color: 'var(--text-secondary)' }}>
          <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Product categories vs Profit Allocation buckets</p>
          <p>
            This report groups sales by each product&apos;s inventory category (e.g. Accessories, Mobile Phones).
            Daily Closing and Profit Allocation use separate revenue buckets (Mobile Sales, Reload, Services, etc.).
            Totals may not match — use this report for product mix analysis; use Profit Allocation for fund distribution.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-sm" style={{ color: 'var(--text-muted)' }}>
          Loading category data…
        </div>
      ) : (
        <>
          {/* ── KPI Cards ── */}
          {selectedCat && activeCatData ? (
            <>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                <div className="w-2 h-2 rounded-full bg-violet-500" />
                <span className="text-xs font-semibold text-violet-600 dark:text-violet-400">Category:</span>
                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{selectedCat}</span>
                <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Showing product breakdown</span>
                <button onClick={() => setSelectedCat('')} className="ml-auto text-[11px] flex items-center gap-1 hover:text-red-500 transition-colors" style={{ color: 'var(--text-muted)' }}>
                  <X size={11} /> Clear
                </button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="Category Revenue" value={formatCurrency(activeCatData.revenue)} icon={DollarSign}  color="violet" />
                <StatCard label="Category COGS"    value={formatCurrency(activeCatData.cogs)}    icon={TrendingDown} color="red"   />
                <StatCard label="Category Profit"  value={formatCurrency(activeCatData.profit)}  icon={TrendingUp}   color="green" sub={`${activeCatData.margin}% margin`} />
                <StatCard label="Units Sold"        value={activeCatData.unitsSold.toLocaleString()} icon={Package} color="blue" sub={`${activeCatData.transactions} transactions`} />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <StatCard label="Total Revenue"   value={formatCurrency(totals.revenue)} icon={DollarSign}  color="violet" />
              <StatCard label="Total COGS"      value={formatCurrency(totals.cogs)}    icon={TrendingDown} color="red"   />
              <StatCard label="Total Profit"    value={formatCurrency(totals.profit)}  icon={TrendingUp}   color="green" sub={`${totals.margin}% margin`} />
              <StatCard label="Units Sold"      value={totals.units.toLocaleString()}  icon={Package}      color="blue"  />
              <StatCard label="Best Category"   value={bestCat?.category ?? '—'}       icon={Tag}          color="orange" sub={bestCat ? formatCurrency(bestCat.revenue) : ''} />
            </div>
          )}

          {/* ── Charts ── */}
          <div className="grid lg:grid-cols-2 gap-5">
            {/* Revenue vs Profit bar */}
            <div className="card p-5">
              <SectionTitle title="Revenue & Profit by Category" sub="Top 10 categories" />
              {barData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>No sales data for this period</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={barData} margin={{ top: 4, right: 4, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                    <XAxis dataKey="category" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} tickLine={false} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} tickFormatter={v => formatCurrency(v)} width={72} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, n: any, p: any) => [formatCurrency(v), p.payload.fullName || n]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Revenue" fill="var(--brand-primary-light)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Profit"  fill="#16a34a" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Revenue share pie */}
            <div className="card p-5">
              <SectionTitle title="Revenue Share by Category" sub="Top 8 categories" />
              {pieData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>No sales data for this period</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                      outerRadius={100} label={renderPieLabel} labelLine={false} fontSize={10}>
                      {pieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => formatCurrency(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ── Product drill-down (visible when a category is selected) ── */}
          {selectedCat && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <SectionTitle
                  title={`${hasServices ? 'Item' : 'Product'} Breakdown — ${selectedCat}`}
                  sub={`${hasServices ? 'Products and services' : 'Products'} sold in this category · ${fromDate} → ${toDate}`}
                />
                <ExportCSV
                  filename={`${selectedCat.replace(/\s+/g, '-')}-products.csv`}
                  headers={['Product','SKU','Revenue','COGS','Profit','Margin','Units','Transactions']}
                  rows={productExportRows}
                />
              </div>
              {prodLoading ? (
                <div className="py-10 text-center text-xs" style={{ color: 'var(--text-muted)' }}>Loading products…</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        {['#','Product','SKU','Revenue','COGS','Profit','Margin','Units','Txns'].map((h, i) => (
                          <th key={h} className={`text-[11px] font-semibold uppercase tracking-wide px-3 py-2.5 ${i <= 2 ? 'text-left' : 'text-right'}`} style={{ color: 'var(--text-muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p: any, i: number) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td className="px-3 py-2.5 text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                          <td className="px-3 py-2.5 text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{p.product}</td>
                          <td className="px-3 py-2.5 text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{p.sku}</td>
                          <td className="px-3 py-2.5 text-xs text-right font-semibold text-violet-600 dark:text-violet-400">{formatCurrency(p.revenue)}</td>
                          <td className="px-3 py-2.5 text-xs text-right text-red-600 dark:text-red-400">{formatCurrency(p.cogs)}</td>
                          <td className="px-3 py-2.5 text-xs text-right font-semibold text-green-600 dark:text-green-400">{formatCurrency(p.profit)}</td>
                          <td className="px-3 py-2.5 text-right">
                              <span className={`text-xs font-semibold ${p.margin >= 20 ? 'text-green-600 dark:text-green-400' : p.margin >= 10 ? 'text-sky-600 dark:text-sky-400' : 'text-red-500'}`}>{p.margin}%</span>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-right" style={{ color: 'var(--text-secondary)' }}>{Number(p.unitsSold).toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-xs text-right" style={{ color: 'var(--text-secondary)' }}>{p.transactions}</td>
                        </tr>
                      ))}
                      {products.length === 0 && (
                        <tr><td colSpan={9} className="text-center py-8 text-xs" style={{ color: 'var(--text-muted)' }}>No {hasServices ? 'items' : 'products'} found for this category in the selected period.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── COGS vs Profit stacked bar ── */}
          <div className="card p-5">
            <SectionTitle title="Revenue Breakdown: COGS vs Profit" sub="How each category's revenue is split between cost and profit" />
            {barData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} margin={{ top: 4, right: 4, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="category" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} tickLine={false} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} tickFormatter={v => formatCurrency(v)} width={72} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => formatCurrency(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="COGS"   stackId="a" fill="#dc2626" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Profit" stackId="a" fill="#16a34a" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── Category Table ── */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <SectionTitle title="Full Category Breakdown" />
              <ExportCSV
                filename="category-report.csv"
                headers={['Category','Revenue','COGS','Profit','Margin','Units Sold','Transactions']}
                rows={exportRows}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {['#','Category','Revenue','COGS','Profit','Margin','Units','Txns','Share'].map((h, i) => (
                      <th key={h} className={`text-[11px] font-semibold uppercase tracking-wide px-3 py-2.5 ${i <= 1 ? 'text-left' : 'text-right'}`} style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c: any, i: number) => (
                    <tr key={i} className="transition-colors hover:bg-white/2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td className="px-3 py-2.5">
                        <span className="text-[11px] font-mono w-5 inline-block" style={{ color: 'var(--text-muted)' }}>{i + 1}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{c.category}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-right font-semibold text-violet-600 dark:text-violet-400">{formatCurrency(c.revenue)}</td>
                      <td className="px-3 py-2.5 text-xs text-right text-red-600 dark:text-red-400">{formatCurrency(c.cogs)}</td>
                      <td className="px-3 py-2.5 text-xs text-right font-semibold text-green-600 dark:text-green-400">{formatCurrency(c.profit)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={`text-xs font-semibold ${c.margin >= 20 ? 'text-green-600 dark:text-green-400' : c.margin >= 10 ? 'text-sky-600 dark:text-sky-400' : 'text-red-500'}`}>
                          {c.margin}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-right" style={{ color: 'var(--text-secondary)' }}>{c.unitsSold.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-xs text-right" style={{ color: 'var(--text-secondary)' }}>{c.transactions}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
                            <div className="h-full rounded-full bg-violet-500" style={{ width: `${c.share}%` }} />
                          </div>
                          <span className="text-[10px] w-7 text-right" style={{ color: 'var(--text-muted)' }}>{c.share}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {categories.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-xs" style={{ color: 'var(--text-muted)' }}>
                        No sales data found for this period. Try selecting a wider date range.
                      </td>
                    </tr>
                  )}
                </tbody>
                {categories.length > 0 && (
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border-default)', background: 'var(--bg-subtle)' }}>
                      <td colSpan={2} className="px-3 py-2.5 text-xs font-bold" style={{ color: 'var(--text-primary)' }}>TOTAL</td>
                      <td className="px-3 py-2.5 text-xs text-right font-bold text-violet-600 dark:text-violet-400">{formatCurrency(totals.revenue)}</td>
                      <td className="px-3 py-2.5 text-xs text-right font-bold text-red-600 dark:text-red-400">{formatCurrency(totals.cogs)}</td>
                      <td className="px-3 py-2.5 text-xs text-right font-bold text-green-600 dark:text-green-400">{formatCurrency(totals.profit)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={`text-xs font-bold ${totals.margin >= 20 ? 'text-green-600 dark:text-green-400' : 'text-sky-600 dark:text-sky-400'}`}>{totals.margin}%</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-right font-bold" style={{ color: 'var(--text-primary)' }}>{totals.units.toLocaleString()}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
