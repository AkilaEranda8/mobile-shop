'use client'
import { useState, useMemo } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  TrendingUp, DollarSign, Download, Calendar, Users, X, ChevronRight,
  Search, Receipt, Wallet, UserRound,
} from 'lucide-react'
import { useCustomerSales, useCustomerSalesDetail } from '@/lib/hooks'
import { getActiveBranchId } from '@/lib/active-branch'
import { formatCurrency, formatDate } from '@/lib/utils'
import { businessToday, businessPeriodFrom } from '@/lib/business-date'

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

type CustomerRow = {
  customerId: string | null
  customerName: string
  phone: string
  revenue: number
  paid: number
  due: number
  discount: number
  cogs: number
  profit: number
  margin: number
  unitsSold: number
  transactions: number
  avgTicket: number
  currentBalance: number
  share: number
}

function customerKey(c: CustomerRow) {
  return c.customerId ?? '__walkin__'
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

export default function CustomerReportPage() {
  const [period, setPeriod] = useState('30')
  const branchId = getActiveBranchId() ?? ''
  const [selectedKey, setSelectedKey] = useState('')
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

  const { data: rawData, loading } = useCustomerSales(apiParams)
  const d = rawData as any
  const customers: CustomerRow[] = d?.customers ?? []
  const totals = d?.totals ?? {
    revenue: 0, paid: 0, due: 0, cogs: 0, profit: 0, margin: 0, transactions: 0, customers: 0,
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    return customers.filter(c =>
      c.customerName.toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q),
    )
  }, [customers, search])

  const selected = selectedKey
    ? customers.find(c => customerKey(c) === selectedKey) ?? null
    : null

  const detailParams: Record<string, string> | undefined = selectedKey
    ? {
        from: fromDate,
        to: toDate,
        ...(branchId ? { branchId } : {}),
        ...(selectedKey === '__walkin__'
          ? { walkIn: '1' }
          : { customerId: selectedKey }),
      }
    : undefined

  const { data: rawInvoices, loading: invLoading } = useCustomerSalesDetail(detailParams)
  const invoices: any[] = Array.isArray(rawInvoices) ? rawInvoices : []

  const best = filtered[0]

  const barData = filtered.slice(0, 10).map(c => ({
    name: c.customerName.length > 14 ? c.customerName.slice(0, 13) + '…' : c.customerName,
    fullName: c.customerName,
    Revenue: c.revenue,
    Profit: c.profit,
  }))

  const pieData = filtered.slice(0, 8).map((c, i) => ({
    name: c.customerName,
    value: c.revenue,
    fill: COLORS[i % COLORS.length],
  }))

  const exportRows = filtered.map(c => [
    c.customerName,
    c.phone,
    c.revenue.toFixed(2),
    c.paid.toFixed(2),
    c.due.toFixed(2),
    c.profit.toFixed(2),
    `${c.margin}%`,
    c.transactions,
    c.avgTicket.toFixed(2),
    c.currentBalance.toFixed(2),
  ])

  const invoiceExportRows = invoices.map((s: any) => [
    s.invoiceNumber,
    formatDate(s.createdAt),
    s.total.toFixed(2),
    s.paid.toFixed(2),
    s.due.toFixed(2),
    s.status,
  ])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="page-title">Customer Report</h1>
          <p className="page-subtitle">
            Sales · Paid · Due · Profit — by customer for the selected period
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
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

          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search customer…"
              className="text-xs pl-7 pr-3 py-1.5 rounded-xl outline-none border"
              style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', borderColor: 'var(--border-subtle)', minWidth: 160 }}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-sm" style={{ color: 'var(--text-muted)' }}>
          Loading customer data…
        </div>
      ) : (
        <>
          {selected ? (
            <>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                <div className="w-2 h-2 rounded-full bg-violet-500" />
                <span className="text-xs font-semibold text-violet-600 dark:text-violet-400">Customer:</span>
                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{selected.customerName}</span>
                {selected.phone && (
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{selected.phone}</span>
                )}
                <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Invoice breakdown</span>
                <button onClick={() => setSelectedKey('')} className="ml-auto text-[11px] flex items-center gap-1 hover:text-red-500 transition-colors" style={{ color: 'var(--text-muted)' }}>
                  <X size={11} /> Clear
                </button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <StatCard label="Revenue" value={formatCurrency(selected.revenue)} icon={DollarSign} color="violet" />
                <StatCard label="Paid" value={formatCurrency(selected.paid)} icon={Wallet} color="green" />
                <StatCard label="Due (period)" value={formatCurrency(selected.due)} icon={Receipt} color="red" />
                <StatCard label="Profit" value={formatCurrency(selected.profit)} icon={TrendingUp} color="blue" sub={`${selected.margin}% margin`} />
                <StatCard label="Orders" value={String(selected.transactions)} icon={UserRound} color="orange" sub={`Avg ${formatCurrency(selected.avgTicket)}`} />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <StatCard label="Total Revenue" value={formatCurrency(totals.revenue)} icon={DollarSign} color="violet" />
              <StatCard label="Total Paid" value={formatCurrency(totals.paid)} icon={Wallet} color="green" />
              <StatCard label="Period Due" value={formatCurrency(totals.due)} icon={Receipt} color="red" />
              <StatCard label="Total Profit" value={formatCurrency(totals.profit)} icon={TrendingUp} color="blue" sub={`${totals.margin}% margin`} />
              <StatCard label="Customers" value={String(totals.customers)} icon={Users} color="orange" sub={best ? `Top: ${best.customerName}` : ''} />
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-5">
            <div className="card p-5">
              <SectionTitle title="Revenue & Profit by Customer" sub="Top 10 customers" />
              {barData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>No sales data for this period</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={barData} margin={{ top: 4, right: 4, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} tickLine={false} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} tickFormatter={v => formatCurrency(v)} width={72} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, _n: any, p: any) => [formatCurrency(v), p.payload.fullName]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Revenue" fill="var(--brand-primary-light)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Profit" fill="#16a34a" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card p-5">
              <SectionTitle title="Revenue Share by Customer" sub="Top 8 customers" />
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

          {selected && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <SectionTitle
                  title={`Invoices — ${selected.customerName}`}
                  sub={`${fromDate} → ${toDate}`}
                />
                <ExportCSV
                  filename={`${selected.customerName.replace(/\s+/g, '-')}-invoices.csv`}
                  headers={['Invoice', 'Date', 'Total', 'Paid', 'Due', 'Status']}
                  rows={invoiceExportRows}
                />
              </div>
              {invLoading ? (
                <div className="py-10 text-center text-xs" style={{ color: 'var(--text-muted)' }}>Loading invoices…</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        {['#', 'Invoice', 'Date', 'Total', 'Paid', 'Due', 'Status'].map((h, i) => (
                          <th key={h} className={`text-[11px] font-semibold uppercase tracking-wide px-3 py-2.5 ${i <= 2 ? 'text-left' : 'text-right'}`} style={{ color: 'var(--text-muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((s: any, i: number) => (
                        <tr key={s.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td className="px-3 py-2.5 text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                          <td className="px-3 py-2.5 text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{s.invoiceNumber}</td>
                          <td className="px-3 py-2.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>{formatDate(s.createdAt)}</td>
                          <td className="px-3 py-2.5 text-xs text-right font-semibold text-violet-600 dark:text-violet-400">{formatCurrency(s.total)}</td>
                          <td className="px-3 py-2.5 text-xs text-right text-green-600 dark:text-green-400">{formatCurrency(s.paid)}</td>
                          <td className="px-3 py-2.5 text-xs text-right text-red-600 dark:text-red-400">{formatCurrency(s.due)}</td>
                          <td className="px-3 py-2.5 text-xs text-right" style={{ color: 'var(--text-secondary)' }}>{s.status}</td>
                        </tr>
                      ))}
                      {invoices.length === 0 && (
                        <tr><td colSpan={7} className="text-center py-8 text-xs" style={{ color: 'var(--text-muted)' }}>No invoices for this customer in the selected period.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <SectionTitle title="All Customers" sub={`${filtered.length} customers · click a row for invoices`} />
              <ExportCSV
                filename={`customer-report-${fromDate}-to-${toDate}.csv`}
                headers={['Customer', 'Phone', 'Revenue', 'Paid', 'Due', 'Profit', 'Margin', 'Orders', 'Avg Ticket', 'Current Balance']}
                rows={exportRows}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {['#', 'Customer', 'Phone', 'Revenue', 'Paid', 'Due', 'Profit', 'Margin', 'Orders', 'Avg', 'Balance', 'Share'].map((h, i) => (
                      <th key={h} className={`text-[11px] font-semibold uppercase tracking-wide px-3 py-2.5 whitespace-nowrap ${i <= 2 ? 'text-left' : 'text-right'}`} style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => {
                    const key = customerKey(c)
                    const active = selectedKey === key
                    return (
                      <tr
                        key={key}
                        onClick={() => setSelectedKey(active ? '' : key)}
                        className="cursor-pointer transition-colors hover:bg-white/5"
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          background: active ? 'var(--brand-glow)' : undefined,
                        }}
                      >
                        <td className="px-3 py-2.5 text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td className="px-3 py-2.5 text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{c.customerName}</td>
                        <td className="px-3 py-2.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>{c.phone || '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-right font-semibold text-violet-600 dark:text-violet-400">{formatCurrency(c.revenue)}</td>
                        <td className="px-3 py-2.5 text-xs text-right text-green-600 dark:text-green-400">{formatCurrency(c.paid)}</td>
                        <td className="px-3 py-2.5 text-xs text-right text-red-600 dark:text-red-400">{formatCurrency(c.due)}</td>
                        <td className="px-3 py-2.5 text-xs text-right font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(c.profit)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={`text-xs font-semibold ${c.margin >= 20 ? 'text-green-600 dark:text-green-400' : c.margin >= 10 ? 'text-yellow-500' : 'text-red-500'}`}>{c.margin}%</span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-right" style={{ color: 'var(--text-secondary)' }}>{c.transactions}</td>
                        <td className="px-3 py-2.5 text-xs text-right" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(c.avgTicket)}</td>
                        <td className="px-3 py-2.5 text-xs text-right" style={{ color: c.currentBalance > 0 ? '#b91c1c' : 'var(--text-secondary)' }}>{formatCurrency(c.currentBalance)}</td>
                        <td className="px-3 py-2.5 text-xs text-right" style={{ color: 'var(--text-muted)' }}>{c.share}%</td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={12} className="text-center py-8 text-xs" style={{ color: 'var(--text-muted)' }}>No customer sales for this period.</td></tr>
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
