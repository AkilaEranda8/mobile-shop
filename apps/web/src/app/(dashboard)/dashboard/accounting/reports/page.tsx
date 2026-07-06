'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, BarChart3, BookOpen, DollarSign, Landmark, Loader2,
  RefreshCw, Scale, TrendingUp,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useFeatureFlag } from '@/lib/hooks'
import { accountingApi } from '@/lib/api'
import { getActiveBranchId } from '@/lib/active-branch'
import { businessToday, businessPeriodFrom } from '@/lib/business-date'
import { formatCurrency } from '@/lib/utils'

type ReportTab = 'trial-balance' | 'profit-loss' | 'balance-sheet' | 'cash-flow'

const TABS: { id: ReportTab; label: string; icon: typeof Scale }[] = [
  { id: 'trial-balance', label: 'Trial Balance', icon: Scale },
  { id: 'profit-loss', label: 'P&L', icon: TrendingUp },
  { id: 'balance-sheet', label: 'Balance Sheet', icon: Landmark },
  { id: 'cash-flow', label: 'Cash Flow', icon: DollarSign },
]

const PERIODS = [
  { label: 'MTD', days: 'mtd' },
  { label: '30D', days: '30' },
  { label: '90D', days: '90' },
  { label: '1Y', days: '365' },
]

export default function AccountingReportsPage() {
  const hasAccess = useFeatureFlag('ACCOUNTING')
  const [tab, setTab] = useState<ReportTab>('profit-loss')
  const [period, setPeriod] = useState('mtd')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<unknown>(null)
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
      let res: { data: unknown }
      if (tab === 'trial-balance') res = await accountingApi.trialBalance(params) as { data: unknown }
      else if (tab === 'profit-loss') res = await accountingApi.profitLoss(params) as { data: unknown }
      else if (tab === 'balance-sheet') res = await accountingApi.balanceSheet({ asOf: toDate, ...(branchId ? { branchId } : {}) }) as { data: unknown }
      else res = await accountingApi.cashFlow(params) as { data: unknown }
      setReport(res.data)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load report')
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [tab, params, toDate, branchId])

  useEffect(() => { if (hasAccess) load() }, [hasAccess, load])

  if (!hasAccess) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center">
        <p className="text-slate-400">Accounting module is disabled.</p>
        <Link href="/settings" className="text-violet-400 text-sm mt-2 inline-block">Enable in Settings</Link>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <Link href="/dashboard/accounting" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 mb-2">
            <ArrowLeft size={12} /> Accounting
          </Link>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="text-violet-400" size={24} />
            GL Reports
          </h1>
          <p className="text-sm text-slate-400 mt-1">Generated from posted journal entries only</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            {PERIODS.map(p => (
              <button
                key={p.days}
                type="button"
                onClick={() => setPeriod(p.days)}
                className={`px-3 py-1.5 text-xs font-medium ${period === p.days ? 'bg-violet-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-white/10 text-slate-300 hover:bg-white/5"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              tab === t.id
                ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                : 'border-white/10 text-slate-400 hover:bg-white/5'
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="text-xs text-slate-500">
        {tab === 'balance-sheet'
          ? `As of ${toDate}`
          : `${fromDate} → ${toDate}`}
        {' · '}Accrual basis
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-violet-400" size={28} />
        </div>
      ) : !report ? (
        <div className="rounded-xl border border-white/10 p-8 text-center text-slate-500 text-sm">
          No report data. Initialize accounting and post journals via Integration sync.
        </div>
      ) : (
        <>
          {tab === 'trial-balance' && <TrialBalanceView data={report as TrialBalanceData} />}
          {tab === 'profit-loss' && <ProfitLossView data={report as PlData} />}
          {tab === 'balance-sheet' && <BalanceSheetView data={report as BsData} />}
          {tab === 'cash-flow' && <CashFlowView data={report as CfData} />}
        </>
      )}
    </div>
  )
}

type TrialBalanceData = {
  lines: Array<{ code: string; name: string; type: string; debitBalance: number; creditBalance: number }>
  totals: { debit: number; credit: number; balanced: boolean }
}

function TrialBalanceView({ data }: { data: TrialBalanceData }) {
  return (
    <ReportTable
      headers={['Code', 'Account', 'Type', 'Debit', 'Credit']}
      footer={[
        'Total',
        '',
        '',
        formatCurrency(data.totals.debit),
        formatCurrency(data.totals.credit),
      ]}
      balanced={data.totals.balanced}
      rows={data.lines.map(l => [
        l.code,
        l.name,
        l.type,
        l.debitBalance > 0 ? formatCurrency(l.debitBalance) : '—',
        l.creditBalance > 0 ? formatCurrency(l.creditBalance) : '—',
      ])}
    />
  )
}

type PlData = {
  revenue: { lines: Array<{ code: string; name: string; amount: number }>; total: number }
  cogs: { lines: Array<{ code: string; name: string; amount: number }>; total: number }
  grossProfit: number
  operatingExpenses: { lines: Array<{ code: string; name: string; amount: number }>; total: number }
  netIncome: number
}

function ProfitLossView({ data }: { data: PlData }) {
  const rows: (string | number)[][] = [
    ['—', 'Revenue', ''],
    ...data.revenue.lines.map(l => [l.code, l.name, formatCurrency(l.amount)]),
    ['', 'Total Revenue', formatCurrency(data.revenue.total)],
    ['', '', ''],
    ['—', 'Cost of Goods Sold', ''],
    ...data.cogs.lines.map(l => [l.code, l.name, formatCurrency(l.amount)]),
    ['', 'Total COGS', formatCurrency(data.cogs.total)],
    ['', 'Gross Profit', formatCurrency(data.grossProfit)],
    ['', '', ''],
    ['—', 'Operating Expenses', ''],
    ...data.operatingExpenses.lines.map(l => [l.code, l.name, formatCurrency(l.amount)]),
    ['', 'Total Opex', formatCurrency(data.operatingExpenses.total)],
    ['', 'Net Income', formatCurrency(data.netIncome)],
  ]
  return (
    <ReportTable
      headers={['Code', 'Account', 'Amount']}
      rows={rows}
      highlightLast
    />
  )
}

type BsData = {
  assets: { lines: Array<{ code: string; name: string; balance: number }>; total: number }
  liabilities: { lines: Array<{ code: string; name: string; balance: number }>; total: number }
  equity: { lines: Array<{ code: string; name: string; balance: number }>; openEarnings: number; total: number }
  totals: { assets: number; liabilitiesAndEquity: number; balanced: boolean }
}

function BalanceSheetView({ data }: { data: BsData }) {
  const rows: (string | number)[][] = [
    ['—', 'Assets', ''],
    ...data.assets.lines.map(l => [l.code, l.name, formatCurrency(l.balance)]),
    ['', 'Total Assets', formatCurrency(data.assets.total)],
    ['', '', ''],
    ['—', 'Liabilities', ''],
    ...data.liabilities.lines.map(l => [l.code, l.name, formatCurrency(l.balance)]),
    ['', 'Total Liabilities', formatCurrency(data.liabilities.total)],
    ['', '', ''],
    ['—', 'Equity', ''],
    ...data.equity.lines.map(l => [l.code, l.name, formatCurrency(l.balance)]),
    ...(data.equity.openEarnings !== 0
      ? [['', 'Current Earnings (unclosed)', formatCurrency(data.equity.openEarnings)]]
      : []),
    ['', 'Total Equity', formatCurrency(data.equity.total)],
    ['', 'Liabilities + Equity', formatCurrency(data.totals.liabilitiesAndEquity)],
  ]
  return (
    <ReportTable
      headers={['Code', 'Account', 'Balance']}
      rows={rows}
      balanced={data.totals.balanced}
    />
  )
}

type CfData = {
  operating: { inflows: number; outflows: number; net: number }
  investing: { inflows: number; outflows: number; net: number }
  financing: { inflows: number; outflows: number; net: number }
  netChangeInCash: number
  openingCash: number
  closingCash: number
}

function CashFlowView({ data }: { data: CfData }) {
  const rows: (string | number)[][] = [
    ['Operating', 'Inflows', formatCurrency(data.operating.inflows)],
    ['', 'Outflows', formatCurrency(data.operating.outflows)],
    ['', 'Net Operating', formatCurrency(data.operating.net)],
    ['', '', ''],
    ['Investing', 'Inflows', formatCurrency(data.investing.inflows)],
    ['', 'Outflows', formatCurrency(data.investing.outflows)],
    ['', 'Net Investing', formatCurrency(data.investing.net)],
    ['', '', ''],
    ['Financing', 'Inflows', formatCurrency(data.financing.inflows)],
    ['', 'Outflows', formatCurrency(data.financing.outflows)],
    ['', 'Net Financing', formatCurrency(data.financing.net)],
    ['', '', ''],
    ['', 'Net Change in Cash', formatCurrency(data.netChangeInCash)],
    ['', 'Opening Cash', formatCurrency(data.openingCash)],
    ['', 'Closing Cash', formatCurrency(data.closingCash)],
  ]
  return <ReportTable headers={['Section', 'Item', 'Amount']} rows={rows} highlightLast />
}

function ReportTable({
  headers,
  rows,
  footer,
  balanced,
  highlightLast,
}: {
  headers: string[]
  rows: (string | number)[][]
  footer?: (string | number)[]
  balanced?: boolean
  highlightLast?: boolean
}) {
  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      {balanced !== undefined && (
        <div className={`px-4 py-2 text-xs border-b border-white/10 ${balanced ? 'text-emerald-400 bg-emerald-500/5' : 'text-amber-400 bg-amber-500/5'}`}>
          {balanced ? '✓ Books balanced' : '⚠ Trial balance / sheet out of balance — check journals'}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/80 text-left text-xs text-slate-500">
            <tr>
              {headers.map(h => (
                <th key={h} className="px-4 py-2.5 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={`border-t border-white/5 ${
                  highlightLast && i === rows.length - 1 ? 'bg-violet-500/10 font-semibold' : 'hover:bg-white/[0.02]'
                }`}
              >
                {row.map((cell, j) => (
                  <td key={j} className={`px-4 py-2 ${j === row.length - 1 ? 'text-right font-mono text-slate-200' : 'text-slate-300'}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
            {footer && (
              <tr className="border-t border-white/10 bg-white/[0.03] font-semibold">
                {footer.map((cell, j) => (
                  <td key={j} className={`px-4 py-2.5 ${j === footer.length - 1 ? 'text-right font-mono text-white' : 'text-slate-200'}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
