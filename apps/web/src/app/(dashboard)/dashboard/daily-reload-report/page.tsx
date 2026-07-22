'use client'

import { useMemo, useState } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  PhoneCall, DollarSign, TrendingUp, CheckCircle, Download, Calendar,
  Search, Wallet, CreditCard,
} from 'lucide-react'
import { useActiveBranchId, useDailyReloadReport, useFeatureFlag } from '@/lib/hooks'
import { formatCurrency } from '@/lib/utils'
import { businessToday, businessPeriodFrom, formatBusinessDateLabel } from '@/lib/business-date'
import { notFound } from 'next/navigation'

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: '10px',
  fontSize: '12px',
  color: 'var(--text-primary)',
}
const COLORS = ['var(--brand-primary-light)', '#1d4ed8', '#0e7490', '#15803d', '#b45309', '#b91c1c', 'var(--brand-primary)', '#0369a1', '#065f46', '#92400e']
const PERIODS = [
  { label: 'Today', days: '1' },
  { label: '7D', days: '7' },
  { label: '30D', days: '30' },
  { label: '90D', days: '90' },
  { label: '1Y', days: '365' },
]

type ProviderRow = {
  provider: string
  count: number
  totalAmount: number
  commission: number
  netPayable: number
  successCount: number
  share: number
}

type TypeRow = {
  type: string
  label: string
  count: number
  totalAmount: number
  commission: number
  netPayable: number
  successCount: number
  share: number
}

type DayRow = {
  date: string
  count: number
  totalAmount: number
  commission: number
  successCount: number
}

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
    <button onClick={handle} className="flex items-center gap-1.5 text-xs hover:text-violet-600 dark:hover:text-violet-400 border px-3 py-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
      <Download size={12} /> Export CSV
    </button>
  )
}

const renderPieLabel = ({ name, percent }: any) =>
  percent > 0.04 ? `${String(name).slice(0, 12)}${String(name).length > 12 ? '…' : ''} ${(percent * 100).toFixed(0)}%` : ''

export default function DailyReloadReportPage() {
  const hasDailyReload = useFeatureFlag('DAILY_RELOAD')

  const [period, setPeriod] = useState('30')
  const branchId = useActiveBranchId() ?? ''
  const [search, setSearch] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

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

  const { data: rawData, loading, error, refetch } = useDailyReloadReport(apiParams)

  if (!hasDailyReload) notFound()

  const d = rawData as any

  const totalCount = d?.totalCount ?? 0
  const totalAmount = d?.totalAmount ?? 0
  const commission = d?.commission ?? 0
  const netPayable = d?.netPayable ?? Math.round((totalAmount - commission) * 100) / 100
  const successCount = d?.successCount ?? 0
  const failCount = d?.failCount ?? 0
  const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0

  const providers: ProviderRow[] = d?.providerBreakdown ?? []
  const types: TypeRow[] = d?.typeBreakdown ?? []
  const days: DayRow[] = d?.dailyBreakdown ?? []

  const filteredProviders = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return providers
    return providers.filter(p => p.provider.toLowerCase().includes(q))
  }, [providers, search])

  const chartData = days.map((r) => ({
    date: formatBusinessDateLabel(r.date),
    Amount: r.totalAmount,
    Commission: r.commission,
  }))

  const pieData = filteredProviders.slice(0, 8).map((p, i) => ({
    name: p.provider,
    value: p.totalAmount,
    fill: COLORS[i % COLORS.length],
  }))

  const typePie = types.map((t, i) => ({
    name: t.label,
    value: t.totalAmount,
    fill: COLORS[i % COLORS.length],
  }))

  const providerExport = filteredProviders.map(p => [
    p.provider, p.count, p.totalAmount.toFixed(2), p.commission.toFixed(2), p.netPayable.toFixed(2), p.successCount, p.share,
  ])
  const dayExport = days.map(r => [
    r.date, r.count, r.totalAmount.toFixed(2), r.commission.toFixed(2), r.successCount, r.count - r.successCount,
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="page-title">Daily Reload Report</h1>
          <p className="page-subtitle">Reload sales · commission · provider & type breakdown</p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-subtle)' }}>
            {PERIODS.map(p => (
              <button key={p.days} onClick={() => { setIsCustom(false); setPeriod(p.days) }}
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
        </div>
      </div>

      {loading && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading reload report…</p>}
      {error && (
        <div className="card p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-red-500">{error}</p>
          <button onClick={refetch} className="btn-secondary text-xs">Retry</button>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard label="Total Reloads" value={String(totalCount)} icon={PhoneCall} color="violet" />
            <StatCard label="Total Amount" value={formatCurrency(totalAmount)} icon={DollarSign} color="blue" />
            <StatCard label="Commission" value={formatCurrency(commission)} icon={TrendingUp} color="green" sub="Shop profit" />
            <StatCard label="Net to Providers" value={formatCurrency(netPayable)} icon={Wallet} color="amber" />
            <StatCard label="Success Rate" value={`${successRate}%`} icon={CheckCircle} color="green" sub={`${failCount} failed`} />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="card p-5">
              <SectionTitle title="Daily Revenue & Commission" sub={`${fromDate} → ${toDate}`} />
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
                    <Bar dataKey="Amount" fill="var(--brand-primary-light)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Commission" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card p-5">
              <SectionTitle title="Provider Share" sub="By reload amount" />
              {pieData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>No provider data</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={renderPieLabel} labelLine={false}>
                      {pieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {types.length > 0 && (
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="card p-5">
                <SectionTitle title="By Service Type" />
                <div className="space-y-3">
                  {types.map(t => (
                    <div key={t.type} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-subtle)' }}>
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-violet-500/10 border border-violet-500/20">
                        {t.type === 'RECHARGE_CARD' ? <CreditCard size={14} className="text-violet-500" /> : <PhoneCall size={14} className="text-violet-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t.label}</p>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t.count} txns · {t.share}% of volume</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(t.totalAmount)}</p>
                        <p className="text-[11px] text-green-600 dark:text-green-400">{formatCurrency(t.commission)} commission</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card p-5">
                <SectionTitle title="Type Mix" />
                {typePie.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>—</div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={typePie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} label={renderPieLabel} labelLine={false}>
                        {typePie.map((e, i) => <Cell key={i} fill={e.fill} />)}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => formatCurrency(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          <div className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <SectionTitle title="Provider Breakdown" />
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search provider…"
                    className="text-xs pl-7 pr-3 py-1.5 rounded-lg border outline-none"
                    style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                  />
                </div>
                <ExportCSV filename="reload-providers.csv" headers={['Provider', 'Reloads', 'Amount', 'Commission', 'Net', 'Success', 'Share %']} rows={providerExport} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {['Provider', 'Reloads', 'Amount', 'Commission', 'Net to Provider', 'Success', 'Share'].map((h, i) => (
                      <th key={h} className={`text-[11px] font-semibold uppercase tracking-wide px-3 py-2 ${i === 0 ? 'text-left' : 'text-right'}`} style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredProviders.map(p => (
                    <tr key={p.provider} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{p.provider}</td>
                      <td className="px-3 py-2.5 text-xs text-right" style={{ color: 'var(--text-secondary)' }}>{p.count}</td>
                      <td className="px-3 py-2.5 text-xs text-right font-semibold text-violet-600 dark:text-violet-400">{formatCurrency(p.totalAmount)}</td>
                      <td className="px-3 py-2.5 text-xs text-right font-semibold text-green-600 dark:text-green-400">{formatCurrency(p.commission)}</td>
                      <td className="px-3 py-2.5 text-xs text-right" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(p.netPayable)}</td>
                      <td className="px-3 py-2.5 text-xs text-right text-green-600 dark:text-green-400">{p.successCount}</td>
                      <td className="px-3 py-2.5 text-xs text-right" style={{ color: 'var(--text-muted)' }}>{p.share}%</td>
                    </tr>
                  ))}
                  {filteredProviders.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-8 text-xs" style={{ color: 'var(--text-muted)' }}>No provider data for this period</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <SectionTitle title="Daily Breakdown" />
              <ExportCSV filename="reload-daily.csv" headers={['Date', 'Reloads', 'Amount', 'Commission', 'Success', 'Failed']} rows={dayExport} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {['Date', 'Reloads', 'Total Amount', 'Commission', 'Success', 'Failed'].map((h, i) => (
                      <th key={h} className={`text-[11px] font-semibold uppercase tracking-wide px-3 py-2 ${i === 0 ? 'text-left' : 'text-right'}`} style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {days.map(r => (
                    <tr key={r.date} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td className="px-3 py-2.5 text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{r.date}</td>
                      <td className="px-3 py-2.5 text-xs text-right" style={{ color: 'var(--text-secondary)' }}>{r.count}</td>
                      <td className="px-3 py-2.5 text-xs text-right font-semibold text-violet-600 dark:text-violet-400">{formatCurrency(r.totalAmount)}</td>
                      <td className="px-3 py-2.5 text-xs text-right font-semibold text-green-600 dark:text-green-400">{formatCurrency(r.commission)}</td>
                      <td className="px-3 py-2.5 text-xs text-right text-green-600 dark:text-green-400">{r.successCount}</td>
                      <td className="px-3 py-2.5 text-xs text-right text-red-600 dark:text-red-400">{r.count - r.successCount}</td>
                    </tr>
                  ))}
                  {days.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-xs" style={{ color: 'var(--text-muted)' }}>No reload data for this period</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
