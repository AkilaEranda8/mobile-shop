'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart3, DollarSign, Landmark, Loader2,
  RefreshCw, Scale, TrendingUp, Download,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useFeatureFlag } from '@/lib/hooks'
import { accountingApi } from '@/lib/api'
import { getActiveBranchId } from '@/lib/active-branch'
import { businessToday, businessPeriodFrom } from '@/lib/business-date'
import { formatCurrency } from '@/lib/utils'
import {
  AccountingPageShell,
  AccountingFeatureGate,
  AccountingPageHeader,
  AccountingPanel,
  AccountingTable,
  AccountingTd,
  AccountingTh,
  AccountingTabs,
} from '@/components/accounting/accounting-ui'

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

  function downloadCsv() {
    if (!report) return
    let rows: string[][] = []
    const filename = `gl-${tab}-${toDate}.csv`

    if (tab === 'trial-balance') {
      const d = report as TrialBalanceData
      rows = [['Code', 'Account', 'Type', 'Debit', 'Credit'], ...d.lines.map(l => [
        l.code, l.name, l.type, String(l.debitBalance), String(l.creditBalance),
      ]), ['', 'Total', '', String(d.totals.debit), String(d.totals.credit)]]
    } else if (tab === 'profit-loss') {
      const d = report as PlData
      rows = [['Code', 'Account', 'Amount'],
        ...d.revenue.lines.map(l => [l.code, l.name, String(l.amount)]),
        ['', 'Total Revenue', String(d.revenue.total)],
        ...d.cogs.lines.map(l => [l.code, l.name, String(l.amount)]),
        ['', 'Total COGS', String(d.cogs.total)],
        ['', 'Gross Profit', String(d.grossProfit)],
        ...d.operatingExpenses.lines.map(l => [l.code, l.name, String(l.amount)]),
        ['', 'Net Income', String(d.netIncome)]]
    } else if (tab === 'balance-sheet') {
      const d = report as BsData
      rows = [['Code', 'Account', 'Balance'],
        ...d.assets.lines.map(l => [l.code, l.name, String(l.balance)]),
        ['', 'Total Assets', String(d.assets.total)],
        ...d.liabilities.lines.map(l => [l.code, l.name, String(l.balance)]),
        ...d.equity.lines.map(l => [l.code, l.name, String(l.balance)]),
        ['', 'Total L+E', String(d.totals.liabilitiesAndEquity)]]
    } else {
      const d = report as CfData
      rows = [['Section', 'Item', 'Amount'],
        ['Operating', 'Net', String(d.operating.net)],
        ['Investing', 'Net', String(d.investing.net)],
        ['Financing', 'Net', String(d.financing.net)],
        ['', 'Net Change', String(d.netChangeInCash)],
        ['', 'Closing Cash', String(d.closingCash)]]
    }

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!hasAccess) return <AccountingFeatureGate />

  return (
    <AccountingPageShell>
      <AccountingPageHeader
        title="GL Reports"
        subtitle="Generated from posted journal entries only"
        icon={BarChart3}
        actions={
          <>
            <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border-default)' }}>
              {PERIODS.map(p => (
                <button
                  key={p.days}
                  type="button"
                  onClick={() => setPeriod(p.days)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${period === p.days ? 'bg-violet-600 text-white' : ''}`}
                  style={period !== p.days ? { color: 'var(--text-muted)' } : undefined}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button type="button" onClick={load} disabled={loading} className="btn-secondary flex items-center gap-2 text-sm">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            {report && (
              <button type="button" onClick={downloadCsv} className="btn-secondary flex items-center gap-2 text-sm">
                <Download size={14} />
                Export CSV
              </button>
            )}
          </>
        }
      />

      <AccountingTabs
        tabs={TABS.map(t => ({ id: t.id, label: t.label }))}
        value={tab}
        onChange={(id) => {
          setTab(id)
          setReport(null)
          setLoading(true)
        }}
      />

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {tab === 'balance-sheet' ? `As of ${toDate}` : `${fromDate} → ${toDate}`}
        {' · '}Accrual basis
      </p>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-violet-400" size={28} />
        </div>
      ) : !report ? (
        <div className="card p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          No report data. Initialize accounting and post journals via Integration sync.
        </div>
      ) : (
        <>
          {tab === 'trial-balance' && isTrialBalanceData(report) && <TrialBalanceView data={report} />}
          {tab === 'profit-loss' && isPlData(report) && <ProfitLossView data={report} />}
          {tab === 'balance-sheet' && isBsData(report) && <BalanceSheetView data={report} />}
          {tab === 'cash-flow' && isCfData(report) && <CashFlowView data={report} />}
        </>
      )}
    </AccountingPageShell>
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
  const assets = data.assets?.lines ?? []
  const liabilities = data.liabilities?.lines ?? []
  const equityLines = data.equity?.lines ?? []
  const openEarnings = data.equity?.openEarnings ?? 0
  const rows: (string | number)[][] = [
    ['—', 'Assets', ''],
    ...assets.map(l => [l.code, l.name, formatCurrency(l.balance ?? 0)]),
    ['', 'Total Assets', formatCurrency(data.assets?.total ?? 0)],
    ['', '', ''],
    ['—', 'Liabilities', ''],
    ...liabilities.map(l => [l.code, l.name, formatCurrency(l.balance ?? 0)]),
    ['', 'Total Liabilities', formatCurrency(data.liabilities?.total ?? 0)],
    ['', '', ''],
    ['—', 'Equity', ''],
    ...equityLines.map(l => [l.code, l.name, formatCurrency(l.balance ?? 0)]),
    ...(openEarnings !== 0
      ? [['', 'Current Earnings (unclosed)', formatCurrency(openEarnings)]]
      : []),
    ['', 'Total Equity', formatCurrency(data.equity?.total ?? 0)],
    ['', 'Liabilities + Equity', formatCurrency(data.totals?.liabilitiesAndEquity ?? 0)],
  ]
  return (
    <ReportTable
      headers={['Code', 'Account', 'Balance']}
      rows={rows}
      balanced={data.totals?.balanced}
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
  const operating = data.operating ?? { inflows: 0, outflows: 0, net: 0 }
  const investing = data.investing ?? { inflows: 0, outflows: 0, net: 0 }
  const financing = data.financing ?? { inflows: 0, outflows: 0, net: 0 }
  const rows: (string | number)[][] = [
    ['Operating', 'Inflows', formatCurrency(operating.inflows)],
    ['', 'Outflows', formatCurrency(operating.outflows)],
    ['', 'Net Operating', formatCurrency(operating.net)],
    ['', '', ''],
    ['Investing', 'Inflows', formatCurrency(investing.inflows)],
    ['', 'Outflows', formatCurrency(investing.outflows)],
    ['', 'Net Investing', formatCurrency(investing.net)],
    ['', '', ''],
    ['Financing', 'Inflows', formatCurrency(financing.inflows)],
    ['', 'Outflows', formatCurrency(financing.outflows)],
    ['', 'Net Financing', formatCurrency(financing.net)],
    ['', '', ''],
    ['', 'Net Change in Cash', formatCurrency(data.netChangeInCash ?? 0)],
    ['', 'Opening Cash', formatCurrency(data.openingCash ?? 0)],
    ['', 'Closing Cash', formatCurrency(data.closingCash ?? 0)],
  ]
  return <ReportTable headers={['Section', 'Item', 'Amount']} rows={rows} highlightLast />
}

function isTrialBalanceData(data: unknown): data is TrialBalanceData {
  return !!data && typeof data === 'object' && Array.isArray((data as TrialBalanceData).lines)
}

function isPlData(data: unknown): data is PlData {
  return !!data && typeof data === 'object' && !!(data as PlData).revenue?.lines
}

function isBsData(data: unknown): data is BsData {
  return !!data && typeof data === 'object' && !!(data as BsData).assets?.lines
}

function isCfData(data: unknown): data is CfData {
  return !!data && typeof data === 'object' && !!(data as CfData).operating
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
    <AccountingPanel>
      {balanced !== undefined && (
        <div className={`px-4 py-2 text-xs border-b ${balanced ? 'text-emerald-400 bg-emerald-500/5' : 'text-amber-400 bg-amber-500/5'}`}
          style={{ borderColor: 'var(--border-subtle)' }}>
          {balanced ? '✓ Books balanced' : '⚠ Trial balance / sheet out of balance — check journals'}
        </div>
      )}
      <AccountingTable>
        <thead>
          <tr>
            {headers.map(h => <AccountingTh key={h}>{h}</AccountingTh>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={highlightLast && i === rows.length - 1 ? 'bg-violet-500/10 font-semibold' : ''}>
              {row.map((cell, j) => (
                <AccountingTd key={j} align={j === row.length - 1 ? 'right' : 'left'} mono={j === row.length - 1}>
                  {cell}
                </AccountingTd>
              ))}
            </tr>
          ))}
          {footer && (
            <tr className="font-semibold" style={{ background: 'var(--bg-subtle)' }}>
              {footer.map((cell, j) => (
                <AccountingTd key={j} align={j === footer.length - 1 ? 'right' : 'left'} mono={j === footer.length - 1}
                  className={j === footer.length - 1 ? 'font-medium' : ''}
                  style={j === footer.length - 1 ? { color: 'var(--text-primary)' } : undefined}>
                  {cell}
                </AccountingTd>
              ))}
            </tr>
          )}
        </tbody>
      </AccountingTable>
    </AccountingPanel>
  )
}
