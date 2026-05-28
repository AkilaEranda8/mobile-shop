'use client'
import { useState, useMemo } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, Package,
  ShoppingCart, Download, Calendar, Building2, Tag,
} from 'lucide-react'
import { useCategorySales, useBranches } from '@/lib/hooks'
import { formatCurrency } from '@/lib/utils'

/* ── constants ─────────────────────────────────────────────────── */
const TOOLTIP_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: '10px',
  fontSize: '12px',
  color: 'var(--text-primary)',
}
const COLORS = ['#6d28d9','#1d4ed8','#0e7490','#15803d','#b45309','#b91c1c','#7c3aed','#0369a1','#065f46','#92400e']
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
  const [period, setPeriod]         = useState('30')
  const [branchId, setBranchId]     = useState('')
  const [isCustom, setIsCustom]     = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]     = useState('')

  const { data: branchesData } = useBranches()
  const branches: any[] = Array.isArray(branchesData) ? branchesData : []
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])

  const toDate = useMemo(() => {
    if (isCustom && customTo) return customTo
    return todayStr
  }, [isCustom, customTo, todayStr])

  const fromDate = useMemo(() => {
    if (isCustom && customFrom) return customFrom
    const d = new Date()
    d.setDate(d.getDate() - parseInt(period) + 1)
    return d.toISOString().split('T')[0]
  }, [isCustom, customFrom, period])

  const apiParams: Record<string, string> = { from: fromDate, to: toDate }
  if (branchId) apiParams.branchId = branchId

  const { data: rawData, loading } = useCategorySales(apiParams)
  const d = rawData as any

  const categories: any[] = d?.categories ?? []
  const totals = d?.totals ?? { revenue: 0, cogs: 0, profit: 0, margin: 0, units: 0 }

  const bestCat = categories[0]

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
          <p className="page-subtitle">Revenue · COGS · Profit · Margin — broken down by product category</p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* Period presets */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-subtle)' }}>
            {PERIODS.map(p => (
              <button key={p.days} onClick={() => { setPeriod(p.days); setIsCustom(false) }}
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

          {isCustom && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: 'var(--bg-subtle)' }}>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} max={customTo || todayStr}
                className="text-xs bg-transparent outline-none cursor-pointer" style={{ color: 'var(--text-primary)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>→</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} min={customFrom} max={todayStr}
                className="text-xs bg-transparent outline-none cursor-pointer" style={{ color: 'var(--text-primary)' }} />
            </div>
          )}

          {branches.length > 1 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: 'var(--bg-subtle)' }}>
              <Building2 size={13} style={{ color: 'var(--text-muted)' }} />
              <select value={branchId} onChange={e => setBranchId(e.target.value)}
                className="bg-transparent text-xs outline-none cursor-pointer" style={{ color: 'var(--text-primary)' }}>
                <option value="">All Branches</option>
                {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          <span className="text-[11px] px-2 py-1 rounded-lg" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
            {fromDate} → {toDate}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-sm" style={{ color: 'var(--text-muted)' }}>
          Loading category data…
        </div>
      ) : (
        <>
          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard label="Total Revenue"   value={formatCurrency(totals.revenue)} icon={DollarSign}  color="violet" />
            <StatCard label="Total COGS"      value={formatCurrency(totals.cogs)}    icon={TrendingDown} color="red"   />
            <StatCard label="Total Profit"    value={formatCurrency(totals.profit)}  icon={TrendingUp}   color="green" sub={`${totals.margin}% margin`} />
            <StatCard label="Units Sold"      value={totals.units.toLocaleString()}  icon={Package}      color="blue"  />
            <StatCard label="Best Category"   value={bestCat?.category ?? '—'}       icon={Tag}          color="orange" sub={bestCat ? formatCurrency(bestCat.revenue) : ''} />
          </div>

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
                    <Bar dataKey="Revenue" fill="#6d28d9" radius={[3, 3, 0, 0]} />
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
                        <span className={`text-xs font-semibold ${c.margin >= 20 ? 'text-green-600 dark:text-green-400' : c.margin >= 10 ? 'text-yellow-500' : 'text-red-500'}`}>
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
                        <span className={`text-xs font-bold ${totals.margin >= 20 ? 'text-green-600 dark:text-green-400' : 'text-yellow-500'}`}>{totals.margin}%</span>
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
