'use client'

import { useCallback, useEffect, useMemo, useState, Fragment } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  ArrowDownRight, ArrowUpRight, Download, Calendar, Loader2, Wallet, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useFeatureFlag } from '@/lib/hooks'
import { analyticsApi } from '@/lib/api'
import { useActiveBranchId } from '@/lib/hooks'
import { businessToday, businessPeriodFrom } from '@/lib/business-date'
import { formatCurrency } from '@/lib/utils'
import { DEFAULT_PAYMENT_METHOD_LABELS, usePaymentMethods, type PaymentMethodKey } from '@/lib/payment-methods'

type InBreakdown = {
  sales: number
  repairs: number
  customerCredit: number
  other: number
}

type OutBreakdown = {
  supplierPayments: number
  expenses: number
  refunds: number
  reloadProvider: number
  bankDeposits: number
  creditDiscounts: number
  other: number
}

type MethodRow = {
  method: PaymentMethodKey
  label: string
  in: number
  out: number
  net: number
  inBreakdown: InBreakdown
  outBreakdown: OutBreakdown
}

type ReportData = {
  from: string
  to: string
  methods: MethodRow[]
  totals: { in: number; out: number; net: number }
}

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: '10px',
  fontSize: '12px',
  color: 'var(--text-primary)',
}
const COLORS = ['var(--brand-primary-light)', '#1d4ed8', '#0e7490', '#15803d', '#b45309', '#b91c1c', 'var(--brand-primary)', '#0369a1']
const PERIODS = [
  { label: 'Today', days: '1' },
  { label: '7D', days: '7' },
  { label: '30D', days: '30' },
  { label: '90D', days: '90' },
  { label: '1Y', days: '365' },
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
    <button
      type="button"
      onClick={handle}
      className="flex items-center gap-1.5 text-xs hover:text-violet-600 dark:hover:text-violet-400 border px-3 py-1.5 rounded-lg transition-colors"
      style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}
    >
      <Download size={12} /> Export CSV
    </button>
  )
}

const renderPieLabel = ({ name, percent }: any) =>
  percent > 0.04 ? `${String(name).slice(0, 12)}${String(name).length > 12 ? '…' : ''} ${(percent * 100).toFixed(0)}%` : ''

function BreakdownLine({ label, value }: { label: string; value: number }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-4">
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="tabular-nums font-medium" style={{ color: 'var(--text-primary)' }}>{formatCurrency(value)}</span>
    </div>
  )
}

export default function PaymentMethodsReportPage() {
  const hasAccess = useFeatureFlag('REPORTS')
  const tenantMethods = usePaymentMethods()
  const branchId = useActiveBranchId() ?? ''
  const [period, setPeriod] = useState('30')
  const [isCustom, setIsCustom] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ReportData | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const labelsByKey = useMemo(() => {
    const map: Partial<Record<PaymentMethodKey, string[]>> = {}
    for (const m of tenantMethods) {
      const list = map[m.key] ?? []
      if (!list.includes(m.label)) list.push(m.label)
      map[m.key] = list
    }
    return map
  }, [tenantMethods])

  const cashflowByKey = useMemo(() => {
    const map = new Map<PaymentMethodKey, MethodRow>()
    for (const m of report?.methods ?? []) map.set(m.method, m)
    return map
  }, [report])

  /** One row per Settings method (Genie / eZ Cash etc.), amounts rolled up by accounting key. */
  const displayRows = useMemo(() => {
    const seenKey = new Set<PaymentMethodKey>()
    const rows: Array<{
      id: string
      key: PaymentMethodKey
      label: string
      isPrimaryForKey: boolean
      data: MethodRow | null
    }> = []

    for (const m of tenantMethods) {
      const isPrimaryForKey = !seenKey.has(m.key)
      seenKey.add(m.key)
      rows.push({
        id: m.id,
        key: m.key,
        label: m.label,
        isPrimaryForKey,
        data: cashflowByKey.get(m.key) ?? null,
      })
    }

    // Include activity on keys not configured in Settings
    for (const m of report?.methods ?? []) {
      if (seenKey.has(m.method)) continue
      if (m.in <= 0 && m.out <= 0) continue
      seenKey.add(m.method)
      rows.push({
        id: m.method,
        key: m.method,
        label: m.label || DEFAULT_PAYMENT_METHOD_LABELS[m.method],
        isPrimaryForKey: true,
        data: m,
      })
    }
    return rows
  }, [tenantMethods, cashflowByKey, report])

  /** Chart / CSV: one entry per accounting key, labeled with Settings names. */
  const keyedRows = useMemo(() => {
    const keys: PaymentMethodKey[] = []
    for (const r of displayRows) {
      if (!keys.includes(r.key)) keys.push(r.key)
    }
    return keys.map(key => {
      const data = cashflowByKey.get(key)
      const labels = labelsByKey[key]
      const label = labels?.length
        ? labels.join(' · ')
        : (data?.label || DEFAULT_PAYMENT_METHOD_LABELS[key] || key)
      return {
        method: key,
        label,
        in: data?.in ?? 0,
        out: data?.out ?? 0,
        net: data?.net ?? 0,
        inBreakdown: data?.inBreakdown ?? { sales: 0, repairs: 0, customerCredit: 0, other: 0 },
        outBreakdown: data?.outBreakdown ?? {
          supplierPayments: 0, expenses: 0, refunds: 0, reloadProvider: 0,
          bankDeposits: 0, creditDiscounts: 0, other: 0,
        },
      }
    })
  }, [displayRows, cashflowByKey, labelsByKey])

  const todayStr = useMemo(() => businessToday(), [])
  const toDate = useMemo(() => {
    if (isCustom && customTo) return customTo
    return todayStr
  }, [isCustom, customTo, todayStr])
  const fromDate = useMemo(() => {
    if (isCustom && customFrom) return customFrom
    return businessPeriodFrom(parseInt(period, 10), toDate)
  }, [isCustom, customFrom, period, toDate])

  const params = useMemo(() => {
    const p: Record<string, string> = { from: fromDate, to: toDate }
    if (branchId) p.branchId = branchId
    return p
  }, [fromDate, toDate, branchId])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await analyticsApi.paymentMethodCashflow(params)
      setReport((res?.data ?? res) as ReportData)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load report')
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [params])

  useEffect(() => {
    if (hasAccess) load()
  }, [hasAccess, load])

  const methods = keyedRows
  const activeMethods = methods.filter(m => m.in > 0 || m.out > 0)

  const barData = methods.map(m => ({
    method: m.label.slice(0, 14),
    fullName: m.label,
    In: m.in,
    Out: m.out,
    Net: m.net,
  }))

  const pieData = activeMethods.map((m, i) => ({
    name: m.label,
    value: m.in,
    fill: COLORS[i % COLORS.length],
  }))

  const exportRows = methods.map(m => [
    m.label,
    m.in.toFixed(2),
    m.out.toFixed(2),
    m.net.toFixed(2),
    m.inBreakdown.sales.toFixed(2),
    m.inBreakdown.repairs.toFixed(2),
    m.inBreakdown.customerCredit.toFixed(2),
    m.inBreakdown.other.toFixed(2),
    m.outBreakdown.supplierPayments.toFixed(2),
    m.outBreakdown.expenses.toFixed(2),
    m.outBreakdown.refunds.toFixed(2),
    m.outBreakdown.reloadProvider.toFixed(2),
    m.outBreakdown.bankDeposits.toFixed(2),
    (m.outBreakdown.creditDiscounts ?? 0).toFixed(2),
    m.outBreakdown.other.toFixed(2),
  ])

  if (!hasAccess) {
    return (
      <div className="p-6">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Reports feature is not enabled for this shop.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="page-title">Payment Methods Report</h1>
          <p className="page-subtitle">
            Money in · Money out · Net — by payment method
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-subtle)' }}>
            {PERIODS.map(p => (
              <button
                key={p.days}
                type="button"
                onClick={() => { setPeriod(p.days); setIsCustom(false) }}
                className="px-3 py-1.5 text-xs rounded-lg font-medium transition-colors"
                style={!isCustom && period === p.days ? { background: 'var(--brand-primary-light)', color: '#fff' } : { color: 'var(--text-muted)' }}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setIsCustom(true)}
              className="px-3 py-1.5 text-xs rounded-lg font-medium transition-colors flex items-center gap-1"
              style={isCustom ? { background: 'var(--brand-primary-light)', color: '#fff' } : { color: 'var(--text-muted)' }}
            >
              <Calendar size={11} /> Custom
            </button>
          </div>

          {isCustom && (
            <div className="flex items-center gap-2">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="input-field h-8 text-xs w-36" />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>to</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="input-field h-8 text-xs w-36" />
              {(customFrom || customTo) && (
                <button type="button" onClick={() => { setCustomFrom(''); setCustomTo(''); setIsCustom(false); setPeriod('30') }} className="p-1 rounded hover:bg-red-500/10">
                  <X size={12} style={{ color: 'var(--text-muted)' }} />
                </button>
              )}
            </div>
          )}

          <div className="ml-auto">
            <ExportCSV
              filename={`payment-methods-${fromDate}_${toDate}.csv`}
              headers={[
                'Method', 'In', 'Out', 'Net',
                'Sales In', 'Repairs In', 'Customer Credit In', 'Other In',
                'Supplier Out', 'Expenses Out', 'Refunds Out', 'Reload Provider Out', 'Bank Deposits Out', 'Credit Discounts Out', 'Other Out',
              ]}
              rows={exportRows}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Total Money In" value={formatCurrency(report?.totals.in ?? 0)} icon={ArrowDownRight} color="emerald" />
        <StatCard label="Total Money Out" value={formatCurrency(report?.totals.out ?? 0)} icon={ArrowUpRight} color="red" />
        <StatCard
          label="Net"
          value={formatCurrency(report?.totals.net ?? 0)}
          sub={`${fromDate} → ${toDate}`}
          icon={Wallet}
          color={(report?.totals.net ?? 0) >= 0 ? 'emerald' : 'red'}
        />
      </div>

      {loading && !report ? (
        <div className="card p-16 flex items-center justify-center gap-2" style={{ color: 'var(--text-muted)' }}>
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-4">
              <SectionTitle title="In vs Out by Method" sub="Cash movement comparison" />
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                    <XAxis dataKey="method" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(v: number) => formatCurrency(v)}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
                    />
                    <Legend />
                    <Bar dataKey="In" fill="#16a34a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Out" fill="#dc2626" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-4">
              <SectionTitle title="Money In Share" sub="Share of collections by method" />
              <div className="h-64">
                {pieData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs" style={{ color: 'var(--text-muted)' }}>No money-in data for this period</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={renderPieLabel} labelLine={false}>
                        {pieData.map((d, i) => <Cell key={d.name} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => formatCurrency(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>By Method</h3>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Methods from Settings · click a row for breakdown
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
                    <th className="text-left font-semibold text-[11px] uppercase tracking-wide px-4 py-2.5">Method</th>
                    <th className="text-right font-semibold text-[11px] uppercase tracking-wide px-4 py-2.5">In</th>
                    <th className="text-right font-semibold text-[11px] uppercase tracking-wide px-4 py-2.5">Out</th>
                    <th className="text-right font-semibold text-[11px] uppercase tracking-wide px-4 py-2.5">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map(row => {
                    const open = expanded === row.id
                    const data = row.data
                    const inn = data?.in ?? 0
                    const out = data?.out ?? 0
                    const net = data?.net ?? 0
                    const siblings = labelsByKey[row.key] ?? []
                    return (
                      <Fragment key={row.id}>
                        <tr
                          onClick={() => setExpanded(open ? null : row.id)}
                          className="border-t cursor-pointer transition-colors hover:bg-[var(--bg-subtle)]"
                          style={{ borderColor: 'var(--border-subtle)' }}
                        >
                          <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                            <span className="font-semibold">{row.label}</span>
                            {siblings.length > 1 && (
                              <span className="block text-[10px] font-normal mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                {siblings.filter(l => l !== row.label).join(' · ') || DEFAULT_PAYMENT_METHOD_LABELS[row.key]}
                              </span>
                            )}
                          </td>
                          {row.isPrimaryForKey ? (
                            <>
                              <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(inn)}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-red-500">{formatCurrency(out)}</td>
                              <td className="px-4 py-3 text-right tabular-nums font-semibold" style={{ color: net >= 0 ? '#16a34a' : '#dc2626' }}>{formatCurrency(net)}</td>
                            </>
                          ) : (
                            <>
                              <td colSpan={3} className="px-4 py-3 text-right text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                Included in {siblings[0] || DEFAULT_PAYMENT_METHOD_LABELS[row.key]} totals
                              </td>
                            </>
                          )}
                        </tr>
                        {open && row.isPrimaryForKey && data && (
                          <tr style={{ background: 'var(--bg-subtle)' }}>
                            <td colSpan={4} className="px-4 py-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[12px]">
                                <div className="space-y-1.5">
                                  <p className="font-semibold text-emerald-600 dark:text-emerald-400 mb-1">Money in</p>
                                  <BreakdownLine label="POS sales" value={data.inBreakdown.sales} />
                                  <BreakdownLine label="Repairs" value={data.inBreakdown.repairs} />
                                  <BreakdownLine label="Customer outstanding" value={data.inBreakdown.customerCredit} />
                                  <BreakdownLine label="Other income" value={data.inBreakdown.other} />
                                </div>
                                <div className="space-y-1.5">
                                  <p className="font-semibold text-red-500 mb-1">Money out</p>
                                  <BreakdownLine label="Supplier payments" value={data.outBreakdown.supplierPayments} />
                                  <BreakdownLine label="Expenses" value={data.outBreakdown.expenses} />
                                  <BreakdownLine label="Refunds" value={data.outBreakdown.refunds} />
                                  <BreakdownLine label="Reload provider" value={data.outBreakdown.reloadProvider} />
                                  <BreakdownLine label="Bank deposits" value={data.outBreakdown.bankDeposits} />
                                  <BreakdownLine label="Credit discounts" value={data.outBreakdown.creditDiscounts ?? 0} />
                                  <BreakdownLine label="Other" value={data.outBreakdown.other} />
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                  {report && (
                    <tr className="border-t font-bold" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-subtle)' }}>
                      <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>Total</td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(report.totals.in)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-red-500">{formatCurrency(report.totals.out)}</td>
                      <td className="px-4 py-3 text-right tabular-nums" style={{ color: report.totals.net >= 0 ? '#16a34a' : '#dc2626' }}>{formatCurrency(report.totals.net)}</td>
                    </tr>
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
