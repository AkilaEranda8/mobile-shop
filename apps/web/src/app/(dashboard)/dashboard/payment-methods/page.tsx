'use client'

import { useCallback, useEffect, useMemo, useState, Fragment } from 'react'
import {
  ArrowDownRight, ArrowUpRight, Download, Loader2, RefreshCw, Wallet,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useFeatureFlag } from '@/lib/hooks'
import { financeApi } from '@/lib/api'
import { getActiveBranchId } from '@/lib/active-branch'
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

const PERIODS = [
  { label: 'Today', days: '1' },
  { label: '7D', days: '7' },
  { label: '30D', days: '30' },
  { label: 'MTD', days: 'mtd' },
  { label: '90D', days: '90' },
]

function StatCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string
  value: string
  tone: 'green' | 'red' | 'neutral'
  icon: typeof Wallet
}) {
  const color =
    tone === 'green' ? '#16a34a' : tone === 'red' ? '#dc2626' : 'var(--text-primary)'
  return (
    <div className="card p-4 flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border"
        style={{
          background: tone === 'green' ? 'rgba(22,163,74,0.12)' : tone === 'red' ? 'rgba(220,38,38,0.12)' : 'var(--bg-subtle)',
          borderColor: tone === 'green' ? 'rgba(22,163,74,0.25)' : tone === 'red' ? 'rgba(220,38,38,0.25)' : 'var(--border-subtle)',
        }}
      >
        <Icon size={16} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold truncate" style={{ color }}>{value}</p>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
      </div>
    </div>
  )
}

export default function PaymentMethodsReportPage() {
  const hasAccess = useFeatureFlag('FINANCE')
  const tenantMethods = usePaymentMethods()
  const labelsByKey = useMemo(() => {
    const map: Partial<Record<PaymentMethodKey, string[]>> = {}
    for (const m of tenantMethods) {
      const list = map[m.key] ?? []
      if (!list.includes(m.label)) list.push(m.label)
      map[m.key] = list
    }
    return map
  }, [tenantMethods])
  const [period, setPeriod] = useState('mtd')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ReportData | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const branchId = getActiveBranchId() ?? ''
  const todayStr = useMemo(() => businessToday(), [])
  const toDate = todayStr
  const fromDate = useMemo(() => {
    if (period === 'mtd') return `${toDate.slice(0, 7)}-01`
    return businessPeriodFrom(parseInt(period, 10), toDate)
  }, [period, toDate])

  const params = useMemo(() => {
    const p: Record<string, string> = { from: fromDate, to: toDate }
    if (branchId) p.branchId = branchId
    return p
  }, [fromDate, toDate, branchId])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await financeApi.paymentMethodCashflow(params)
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

  function downloadCsv() {
    if (!report) return
    const rows: string[][] = [
      ['Method', 'Money In', 'Money Out', 'Net',
        'Sales In', 'Repairs In', 'Customer Credit In', 'Other In',
        'Supplier Out', 'Expenses Out', 'Refunds Out', 'Reload Provider Out', 'Bank Deposits Out', 'Credit Discounts Out', 'Other Out'],
      ...report.methods.map(m => [
        m.label || DEFAULT_PAYMENT_METHOD_LABELS[m.method] || m.method,
        String(m.in), String(m.out), String(m.net),
        String(m.inBreakdown.sales), String(m.inBreakdown.repairs),
        String(m.inBreakdown.customerCredit), String(m.inBreakdown.other),
        String(m.outBreakdown.supplierPayments), String(m.outBreakdown.expenses),
        String(m.outBreakdown.refunds), String(m.outBreakdown.reloadProvider),
        String(m.outBreakdown.bankDeposits), String(m.outBreakdown.creditDiscounts ?? 0),
        String(m.outBreakdown.other),
      ]),
      ['Total', String(report.totals.in), String(report.totals.out), String(report.totals.net),
        '', '', '', '', '', '', '', '', '', '', ''],
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payment-methods-${report.from}_${report.to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!hasAccess) {
    return (
      <div className="p-6">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Finance feature is not enabled for this shop.</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Payment Methods</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Money in and money out by payment method for the selected period
            {fromDate && toDate ? ` · ${fromDate} → ${toDate}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-default)' }}>
            {PERIODS.map(p => (
              <button
                key={p.days}
                type="button"
                onClick={() => setPeriod(p.days)}
                className="px-2.5 py-1.5 text-[11px] font-semibold transition-colors"
                style={period === p.days
                  ? { background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }
                  : { color: 'var(--text-muted)' }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={load} className="btn-secondary text-xs flex items-center gap-1.5 h-8 px-3">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={!report}
            className="btn-secondary text-xs flex items-center gap-1.5 h-8 px-3 disabled:opacity-50"
          >
            <Download size={12} /> CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Total Money In"
          value={formatCurrency(report?.totals.in ?? 0)}
          tone="green"
          icon={ArrowDownRight}
        />
        <StatCard
          label="Total Money Out"
          value={formatCurrency(report?.totals.out ?? 0)}
          tone="red"
          icon={ArrowUpRight}
        />
        <StatCard
          label="Net"
          value={formatCurrency(report?.totals.net ?? 0)}
          tone={(report?.totals.net ?? 0) >= 0 ? 'green' : 'red'}
          icon={Wallet}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>By method</p>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Click a row for breakdown</p>
        </div>

        {loading && !report ? (
          <div className="flex items-center justify-center py-16 gap-2" style={{ color: 'var(--text-muted)' }}>
            <Loader2 size={16} className="animate-spin" /> Loading…
          </div>
        ) : (
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
                {(report?.methods ?? []).map(m => {
                  const open = expanded === m.method
                  const label = m.label || DEFAULT_PAYMENT_METHOD_LABELS[m.method] || m.method
                  const configured = labelsByKey[m.method] ?? []
                  const configuredNote = configured.length > 1
                    ? configured.join(' · ')
                    : configured.length === 1 && configured[0] !== label
                      ? configured[0]
                      : null
                  return (
                    <Fragment key={m.method}>
                      <tr
                        onClick={() => setExpanded(open ? null : m.method)}
                        className="border-t cursor-pointer transition-colors hover:bg-[var(--bg-subtle)]"
                        style={{ borderColor: 'var(--border-subtle)' }}
                      >
                        <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                          <span className="font-semibold">{label}</span>
                          {configuredNote && (
                            <span className="block text-[10px] font-normal mt-0.5" style={{ color: 'var(--text-muted)' }}>
                              {configuredNote}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(m.in)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-red-500">
                          {formatCurrency(m.out)}
                        </td>
                        <td
                          className="px-4 py-3 text-right tabular-nums font-semibold"
                          style={{ color: m.net >= 0 ? '#16a34a' : '#dc2626' }}
                        >
                          {formatCurrency(m.net)}
                        </td>
                      </tr>
                      {open && (
                        <tr style={{ background: 'var(--bg-subtle)' }}>
                          <td colSpan={4} className="px-4 py-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[12px]">
                              <div className="space-y-1.5">
                                <p className="font-semibold text-emerald-600 dark:text-emerald-400 mb-1">Money in</p>
                                <BreakdownLine label="POS sales" value={m.inBreakdown.sales} />
                                <BreakdownLine label="Repairs" value={m.inBreakdown.repairs} />
                                <BreakdownLine label="Customer outstanding" value={m.inBreakdown.customerCredit} />
                                <BreakdownLine label="Other income" value={m.inBreakdown.other} />
                              </div>
                              <div className="space-y-1.5">
                                <p className="font-semibold text-red-500 mb-1">Money out</p>
                                <BreakdownLine label="Supplier payments" value={m.outBreakdown.supplierPayments} />
                                <BreakdownLine label="Expenses" value={m.outBreakdown.expenses} />
                                <BreakdownLine label="Refunds" value={m.outBreakdown.refunds} />
                                <BreakdownLine label="Reload provider" value={m.outBreakdown.reloadProvider} />
                                <BreakdownLine label="Bank deposits" value={m.outBreakdown.bankDeposits} />
                                <BreakdownLine label="Credit discounts" value={m.outBreakdown.creditDiscounts ?? 0} />
                                <BreakdownLine label="Other" value={m.outBreakdown.other} />
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
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(report.totals.in)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-500">
                      {formatCurrency(report.totals.out)}
                    </td>
                    <td
                      className="px-4 py-3 text-right tabular-nums"
                      style={{ color: report.totals.net >= 0 ? '#16a34a' : '#dc2626' }}
                    >
                      {formatCurrency(report.totals.net)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
        Sales tenders come from POS payments. Repair and customer outstanding collections come from finance transactions
        (same rules as Daily Closing — no double counting). Credit / on-account is excluded.
      </p>
    </div>
  )
}

function BreakdownLine({ label, value }: { label: string; value: number }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-4">
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="tabular-nums font-medium" style={{ color: 'var(--text-primary)' }}>{formatCurrency(value)}</span>
    </div>
  )
}
