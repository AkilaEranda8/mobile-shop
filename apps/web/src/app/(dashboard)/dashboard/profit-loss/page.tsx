'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import {
  TrendingUp, TrendingDown, DollarSign, Calendar, Download,
  AlertTriangle, Lightbulb, Receipt, PieChart as PieChartIcon,
  CheckCircle, Wallet, BarChart3, Lock, Wrench,
} from 'lucide-react'
import { usePlStatement, useCategorySales, useFeatureFlag } from '@/lib/hooks'
import { getActiveBranchId } from '@/lib/active-branch'
import { formatCurrency } from '@/lib/utils'
import { businessToday, businessPeriodFrom, formatBusinessDateLabel } from '@/lib/business-date'
import { PlStatementBody, type PlStatementLine } from '@/components/finance/PlStatementBody'

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: '10px',
  fontSize: '12px',
  color: 'var(--text-primary)',
}

const COLORS = ['#6d28d9', '#1d4ed8', '#0e7490', '#15803d', '#b45309', '#b91c1c', '#7c3aed', '#0369a1']
const PERIODS = [
  { label: 'Today', days: '1' },
  { label: '7D', days: '7' },
  { label: '30D', days: '30' },
  { label: '90D', days: '90' },
  { label: '1Y', days: '365' },
  { label: 'MTD', days: 'mtd' },
]

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
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
  }
  return (
    <button type="button" onClick={handle} className="flex items-center gap-1.5 text-xs hover:text-violet-600 dark:hover:text-violet-400 border px-3 py-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
      <Download size={12} /> Export CSV
    </button>
  )
}

function DeltaBadge({ d }: { d: { pct: number; up: boolean } | null }) {
  if (!d) return null
  return (
    <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${d.up ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
      {d.up ? '▲' : '▼'} {Math.abs(d.pct)}%
    </span>
  )
}

const renderPieLabel = ({ name, percent }: any) =>
  percent > 0.04 ? `${name} ${(percent * 100).toFixed(0)}%` : ''

export default function ProfitLossPage() {
  const hasDailyClosing = useFeatureFlag('DAILY_CLOSING')
  const [period, setPeriod] = useState('30')
  const [isCustom, setIsCustom] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const branchId = getActiveBranchId() ?? ''
  const todayStr = useMemo(() => businessToday(), [])

  const toDate = useMemo(() => {
    if (isCustom && customTo) return customTo
    return todayStr
  }, [isCustom, customTo, todayStr])

  const fromDate = useMemo(() => {
    if (isCustom && customFrom) return customFrom
    if (period === 'mtd') return `${toDate.slice(0, 7)}-01`
    return businessPeriodFrom(parseInt(period), toDate)
  }, [isCustom, customFrom, period, toDate])

  const apiParams: Record<string, string> = { from: fromDate, to: toDate }
  if (branchId) apiParams.branchId = branchId

  const { data: raw, loading, error, refetch } = usePlStatement(apiParams)
  const { data: rawCat, loading: catLoading } = useCategorySales(apiParams)
  const d = raw as any
  const catData = rawCat as any

  const summary = d?.summary ?? {}
  const previous = d?.previous ?? {}
  const margins = d?.margins ?? { gross: 0, net: 0 }
  const incomeBreakdown: any[] = d?.incomeBreakdown ?? []
  const expenseBreakdown: any[] = d?.expenseBreakdown ?? []
  const insights: string[] = d?.insights ?? []
  const dailyTrend: any[] = d?.dailyTrend ?? []
  const categories: any[] = catData?.categories ?? []
  const statement: PlStatementLine[] = d?.statement ?? []
  const repairAccrual = d?.repairAccrual ?? { jobs: 0 }

  const salesRevenue = summary.salesRevenue ?? 0
  const otherIncome = summary.otherIncome ?? 0
  const totalIncome = summary.totalIncome ?? 0
  const cogs = summary.cogs ?? 0
  const grossProfit = summary.grossProfit ?? 0
  const opExpenses = summary.opExpenses ?? 0
  const netProfit = summary.profit ?? 0
  const refundsTotal = summary.refundsTotal ?? 0
  const repairIncome = summary.repairIncome ?? 0
  const repairPartsCogs = summary.repairPartsCogs ?? 0
  const posCogs = summary.posCogs ?? (cogs - repairPartsCogs)
  const isLoss = netProfit < 0

  const grossMargin = margins.gross ?? 0
  const netMargin = margins.net ?? 0
  const cogsRatio = salesRevenue > 0 ? Math.round((cogs / salesRevenue) * 100) : 0
  const opexRatio = totalIncome > 0 ? Math.round((opExpenses / totalIncome) * 100) : 0

  const delta = (curr: number, p: number) => {
    if (!p) return null
    const pct = Math.round(((curr - p) / Math.abs(p)) * 100)
    return { pct, up: curr >= p }
  }

  const waterfallData = [
    { name: 'POS Sales', value: salesRevenue, fill: '#16a34a' },
    { name: 'Repairs', value: repairIncome, fill: '#7c3aed' },
    { name: 'Other', value: Math.max(0, otherIncome - (summary.reloadCommission ?? 0)), fill: '#0e7490' },
    { name: 'POS COGS', value: -posCogs, fill: '#dc2626' },
    { name: 'Parts', value: -repairPartsCogs, fill: '#b91c1c' },
    { name: 'OpEx', value: -opExpenses, fill: '#f97316' },
    { name: 'Net', value: netProfit, fill: isLoss ? '#dc2626' : '#7c3aed' },
  ]

  const chartTrend = useMemo(() => dailyTrend.map(row => ({
    date: formatBusinessDateLabel(row.date),
    Revenue: row.totalRevenue ?? 0,
    Profit: row.profit ?? 0,
    Expenses: (row.cogs ?? 0) + (row.totalExpenses ?? 0) + (row.refundsTotal ?? 0),
  })), [dailyTrend])

  const incomePie = incomeBreakdown.map((item, i) => ({
    name: item.label,
    value: item.amount,
    fill: COLORS[i % COLORS.length],
  }))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="page-title">Profit &amp; Loss Statement</h1>
          <p className="page-subtitle">
            Complete business P&amp;L — income, costs, expenses &amp; net profit/loss
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-subtle)' }}>
            {PERIODS.map(p => (
              <button key={p.days} type="button" onClick={() => { setPeriod(p.days); setIsCustom(false) }}
                className="px-3 py-1.5 text-xs rounded-lg font-medium transition-colors"
                style={!isCustom && period === p.days ? { background: '#6d28d9', color: '#fff' } : { color: 'var(--text-muted)' }}>
                {p.label}
              </button>
            ))}
            <button type="button" onClick={() => setIsCustom(true)}
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

          <span className="text-[11px] px-2 py-1 rounded-lg" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
            {fromDate} → {toDate}
          </span>
        </div>
      </div>

      {hasDailyClosing && (
        <Link href="/dashboard/daily-closing" className="card p-4 flex items-center justify-between border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/10 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center">
              <Lock size={18} className="text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Daily Closing</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Day-by-day breakdown uses the same P&amp;L math as this page</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-violet-400">Open →</span>
        </Link>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-sm" style={{ color: 'var(--text-muted)' }}>
          Loading Profit &amp; Loss statement…
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button type="button" onClick={refetch} className="text-xs px-4 py-2 rounded-lg border" style={{ borderColor: 'var(--border-subtle)' }}>Retry</button>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard label="Sales Revenue" value={formatCurrency(salesRevenue)} icon={DollarSign} color="violet" sub={`${summary.salesCount ?? 0} transactions`} />
            <StatCard label="Gross Profit" value={formatCurrency(grossProfit)} icon={TrendingUp} color="green" sub={`${grossMargin}% margin`} />
            <StatCard label="Operating Expenses" value={formatCurrency(opExpenses)} icon={TrendingDown} color="red" />
            <StatCard label="Total Income" value={formatCurrency(totalIncome)} icon={BarChart3} color="blue" sub={`+ ${formatCurrency(otherIncome)} other`} />
            <StatCard
              label={isLoss ? 'Net Loss' : 'Net Profit'}
              value={`${isLoss ? '−' : ''}${formatCurrency(Math.abs(netProfit))}`}
              icon={Wallet}
              color={isLoss ? 'red' : 'green'}
              sub={`${netMargin}% net margin`}
            />
          </div>

          {/* Period comparison cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Sales Revenue', val: salesRevenue, d: delta(salesRevenue, previous.salesRevenue ?? 0), color: 'text-green-600 dark:text-green-400' },
              { label: 'Gross Profit', val: grossProfit, d: delta(grossProfit, previous.grossProfit ?? 0), color: 'text-cyan-600 dark:text-cyan-400', sub: `${grossMargin}% margin` },
              { label: 'Op. Expenses', val: opExpenses, d: delta(opExpenses, previous.opExpenses ?? 0), color: 'text-orange-500 dark:text-orange-400' },
              { label: 'Net Profit', val: netProfit, d: delta(netProfit, previous.profit ?? 0), color: netProfit >= 0 ? 'text-violet-600 dark:text-violet-400' : 'text-red-500', sub: `${netMargin}% net margin` },
            ].map(({ label, val, d, color, sub }) => (
              <div key={label} className="card p-4">
                <p className="text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>{label} · vs prev period</p>
                <div className="flex items-baseline gap-1 flex-wrap">
                  <p className={`text-lg font-bold ${color}`}>{formatCurrency(val)}</p>
                  <DeltaBadge d={d} />
                </div>
                {sub && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
              </div>
            ))}
          </div>

          {/* Insights */}
          {insights.length > 0 && (
            <div className="card p-5">
              <SectionTitle title="Business Insights" sub="Key points about this period" />
              <div className="space-y-2">
                {insights.map((text, i) => (
                  <div key={i} className="flex gap-2 items-start text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <Lightbulb size={14} className="flex-shrink-0 mt-0.5 text-amber-500" />
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Repair accrual summary */}
          {repairAccrual.jobs > 0 && (
            <div className="card p-5">
              <SectionTitle title="Repair Business (Accrual)" sub={`${repairAccrual.jobs} jobs completed in period`} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Collected" value={formatCurrency(repairAccrual.collected)} icon={DollarSign} color="violet" />
                <StatCard label="Parts Cost" value={formatCurrency(repairAccrual.partsBuy)} icon={Wrench} color="red" />
                <StatCard label="Repair Net Profit" value={formatCurrency(repairAccrual.netProfit)} icon={TrendingUp} color="green" />
                <StatCard label="Credit Outstanding" value={formatCurrency(repairAccrual.creditDue)} icon={Wallet} color="amber" />
              </div>
            </div>
          )}

          {/* Waterfall */}
          <div className="card p-5">
            <SectionTitle title="P&amp;L Waterfall" sub="Revenue flow → costs → profit" />
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={waterfallData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} tickFormatter={v => formatCurrency(v)} width={72} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => formatCurrency(Math.abs(Number(v)))} />
                <ReferenceLine y={0} stroke="var(--border-default)" strokeWidth={1.5} />
                <Bar dataKey="value" radius={[4, 4, 4, 4]}>
                  {waterfallData.map((entry, i) => <Cell key={i} fill={entry.fill} opacity={0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* P&L Statement */}
          <div className="card p-5">
            <SectionTitle title="Profit &amp; Loss Statement" sub={`${fromDate} → ${toDate}`} />
            <PlStatementBody
              lines={statement}
              exportFilename={`pl-statement-${fromDate}-${toDate}.csv`}
              footer={previous ? (
                <p className="text-[11px] mt-3 pt-3" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)' }}>
                  Previous period: Revenue {formatCurrency(previous.salesRevenue ?? 0)} · Net {formatCurrency(previous.profit ?? 0)}
                  {' · '}Gross margin {grossMargin}% · Net margin {netMargin}%
                </p>
              ) : undefined}
            />
          </div>

          {/* Status + Efficiency */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="card p-4" style={{ borderColor: netProfit >= 0 ? 'rgba(21,128,61,0.3)' : 'rgba(185,28,28,0.3)', background: netProfit >= 0 ? 'rgba(21,128,61,0.05)' : 'rgba(185,28,28,0.05)' }}>
              <div className="flex items-center gap-2 mb-2">
                {netProfit >= 0 ? <CheckCircle size={14} className="text-green-600 dark:text-green-400" /> : <AlertTriangle size={14} className="text-red-600 dark:text-red-400" />}
                <span className={`text-xs font-semibold ${netProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {netProfit >= 0 ? 'Profitable Period' : 'Loss Period — Review Expenses'}
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {netProfit >= 0
                  ? `Net profit: ${formatCurrency(netProfit)} · ${netMargin}% margin`
                  : `Net loss: ${formatCurrency(Math.abs(netProfit))}. Review operating expenses and refunds.`}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>Efficiency Ratios</p>
              <div className="space-y-2">
                {[
                  { label: 'COGS % of Revenue', value: cogsRatio, good: cogsRatio < 70 },
                  { label: 'OpEx % of Revenue', value: opexRatio, good: opexRatio < 30 },
                  { label: 'Gross Margin', value: grossMargin, good: grossMargin > 20 },
                  { label: 'Net Margin', value: netMargin, good: netMargin > 10 },
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

          {/* Daily trend */}
          <div className="card p-5">
            <SectionTitle title="Daily Profit Trend" sub="Revenue, expenses &amp; net profit by day" />
            {chartTrend.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>No data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartTrend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="plProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} tickFormatter={v => formatCurrency(v)} width={72} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => formatCurrency(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={0} stroke="var(--border-default)" strokeDasharray="4 2" />
                  <Area type="monotone" dataKey="Profit" stroke="#7c3aed" fill="url(#plProfit)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="Revenue" stroke="#16a34a" fill="none" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                  <Area type="monotone" dataKey="Expenses" stroke="#dc2626" fill="none" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            {/* Income breakdown */}
            <div className="card p-5">
              <SectionTitle title="Income Breakdown" sub="Revenue sources this period" />
              {incomeBreakdown.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>No income recorded</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={incomePie} dataKey="value" nameKey="name" cx="50%" cy="50%"
                        outerRadius={100} label={renderPieLabel} labelLine={false} fontSize={10}>
                        {incomePie.map((e, i) => <Cell key={i} fill={e.fill} />)}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => formatCurrency(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-3">
                    {incomeBreakdown.map((item, i) => (
                      <div key={item.key} className="flex justify-between text-xs py-1.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <span className="flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                          <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          {item.label}
                        </span>
                        <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(item.amount)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Expense breakdown */}
            <div className="card p-5">
              <SectionTitle title="Expense Breakdown" sub="Operating costs by category" />
              {expenseBreakdown.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>No expenses recorded</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={expenseBreakdown.slice(0, 8)} layout="vertical" margin={{ left: 4, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={v => formatCurrency(v)} />
                      <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 9, fill: 'var(--text-muted)' }} tickLine={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => formatCurrency(v)} />
                      <Bar dataKey="amount" fill="#dc2626" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-3">
                    {expenseBreakdown.map(item => {
                      const pct = opExpenses > 0 ? Math.round((item.amount / opExpenses) * 100) : 0
                      return (
                        <div key={item.key} className="flex justify-between text-xs py-1.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <span style={{ color: 'var(--text-primary)' }}>{item.label}</span>
                          <span>
                            <span className="font-semibold text-red-600 dark:text-red-400">{formatCurrency(item.amount)}</span>
                            <span className="ml-1.5" style={{ color: 'var(--text-muted)' }}>({pct}%)</span>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Product categories */}
          {!catLoading && categories.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <SectionTitle title="Sales by Product Category" sub="Revenue, COGS &amp; profit by category" />
                <ExportCSV
                  filename={`pl-categories-${fromDate}-${toDate}.csv`}
                  headers={['Category', 'Revenue', 'COGS', 'Profit', 'Margin', 'Share']}
                  rows={categories.map((c: any) => [c.category, c.revenue.toFixed(2), c.cogs.toFixed(2), c.profit.toFixed(2), `${c.margin}%`, `${c.share}%`])}
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      {['Category', 'Revenue', 'COGS', 'Profit', 'Margin', 'Share'].map((h, i) => (
                        <th key={h} className={`text-[11px] font-semibold uppercase tracking-wide px-3 py-2.5 ${i === 0 ? 'text-left' : 'text-right'}`} style={{ color: 'var(--text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {categories.slice(0, 12).map((c: any) => (
                      <tr key={c.category} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td className="px-3 py-2.5 text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{c.category}</td>
                        <td className="px-3 py-2.5 text-xs text-right font-semibold text-violet-600 dark:text-violet-400">{formatCurrency(c.revenue)}</td>
                        <td className="px-3 py-2.5 text-xs text-right text-red-600 dark:text-red-400">{formatCurrency(c.cogs)}</td>
                        <td className={`px-3 py-2.5 text-xs text-right font-semibold ${c.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{formatCurrency(c.profit)}</td>
                        <td className="px-3 py-2.5 text-xs text-right" style={{ color: 'var(--text-muted)' }}>{c.margin}%</td>
                        <td className="px-3 py-2.5 text-xs text-right" style={{ color: 'var(--text-muted)' }}>{c.share}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Related */}
          <div className="grid sm:grid-cols-2 gap-3">
            <Link href="/dashboard/profit-allocation" className="card p-4 flex items-center justify-between hover:border-violet-500/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center">
                  <PieChartIcon size={16} className="text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Profit Allocation</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Fund distribution from daily profit</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-violet-400">Open →</span>
            </Link>
            <Link href="/dashboard/reports?tab=pl" className="card p-4 flex items-center justify-between hover:border-violet-500/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center">
                  <Receipt size={16} className="text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Reports P&amp;L Tab</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Charts &amp; export in Reports</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-violet-400">Open →</span>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
