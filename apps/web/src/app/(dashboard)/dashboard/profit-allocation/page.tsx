'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  PieChart as PieChartIcon, TrendingUp, Wallet, Banknote, RefreshCw, Save, Plus, Search,
  Download, FileSpreadsheet, FileText, X, Loader2, Edit2, Trash2, ArrowDownRight,
  ArrowUpRight, SlidersHorizontal, Calendar, Layers,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { businessToday } from '@/lib/business-date'
import { authStorage } from '@/lib/auth'
import { profitAllocationApi } from '@/lib/api'
import { useBranches, useFeatureFlag, useProfitAllocationDashboard, useProfitFunds } from '@/lib/hooks'
import {
  exportAllocationCsv, exportAllocationExcel, exportAllocationPdf,
  type AllocationLine,
} from '@/lib/profit-allocation-export'

type FundLine = AllocationLine & {
  fundId: string
  fundType: string
  sortOrder: number
  isActive: boolean
  description: string | null
}

type DashboardData = {
  date: string
  todaySales: number
  todayProfit: number
  totalAllocated: number
  remainingProfit: number
  percentageTotal: number
  percentageValid: boolean
  lines: FundLine[]
  saved: boolean
  allocationId: string | null
}

type Fund = {
  id: string
  name: string
  type: string
  fixedAmount: number
  percentage: number
  sortOrder: number
  isActive: boolean
  description: string | null
  balance: number
}

type TxRow = {
  id: string
  date: string
  type: string
  amount: number
  balanceAfter: number
  notes: string | null
  userName: string | null
  fund: { name: string; type: string }
  createdAt: string
}

const FUND_TYPE_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  FIXED_AMOUNT: { color: '#6d28d9', bg: 'rgba(109,40,217,0.08)', border: 'rgba(109,40,217,0.20)' },
  PERCENTAGE:   { color: '#15803d', bg: 'rgba(21,128,61,0.08)', border: 'rgba(21,128,61,0.20)' },
  MANUAL:       { color: '#0284c7', bg: 'rgba(2,132,199,0.08)', border: 'rgba(2,132,199,0.20)' },
}

const TYPE_FILTER_OPTIONS = [
  { id: 'ALL', label: 'All' },
  { id: 'FIXED_AMOUNT', label: 'Fixed' },
  { id: 'PERCENTAGE', label: 'Percentage' },
  { id: 'MANUAL', label: 'Manual' },
] as const

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

function FundTypeBadge({ type }: { type: string }) {
  const c = FUND_TYPE_COLORS[type] ?? { color: '#475569', bg: 'rgba(71,85,105,0.08)', border: 'rgba(71,85,105,0.20)' }
  const labels: Record<string, string> = {
    FIXED_AMOUNT: 'Fixed',
    PERCENTAGE: 'Percentage',
    MANUAL: 'Manual',
  }
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
      style={{ color: c.color, background: c.bg, borderColor: c.border }}>
      {labels[type] ?? type}
    </span>
  )
}

function MovementModal({
  mode, fund, branchId, date, onClose, onDone,
}: {
  mode: 'withdraw' | 'deposit' | 'adjustment'
  fund: Fund
  branchId: string
  date: string
  onClose: () => void
  onDone: () => void
}) {
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const titles = { withdraw: 'Withdraw', deposit: 'Deposit', adjustment: 'Adjustment' }

  const submit = async () => {
    const amt = parseFloat(amount)
    if (!amt || (mode !== 'adjustment' && amt <= 0)) {
      toast.error('Enter a valid amount')
      return
    }
    setLoading(true)
    try {
      const body = { branchId, fundId: fund.id, amount: mode === 'adjustment' ? amt : amt, notes, date }
      if (mode === 'withdraw') await profitAllocationApi.withdraw(body)
      else if (mode === 'deposit') await profitAllocationApi.deposit(body)
      else await profitAllocationApi.adjustment(body)
      toast.success(`${titles[mode]} recorded`)
      onDone()
      onClose()
    } catch (e: unknown) {
      toast.error((e as { message?: string })?.message ?? 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl shadow-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(109,40,217,0.10)', border: '1px solid rgba(109,40,217,0.25)' }}>
              <Wallet size={14} style={{ color: '#6d28d9' }} />
            </div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{titles[mode]} — {fund.name}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}><X size={15} /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Current balance: {formatCurrency(fund.balance)}</p>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Amount (Rs.)</label>
            <input className="input-field" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Notes</label>
            <input className="input-field" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional note" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button onClick={submit} disabled={loading} className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin" /> : titles[mode]}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProfitAllocationPage() {
  const hasAccess = useFeatureFlag('PROFIT_ALLOCATION')
  const role = authStorage.getUser()?.role ?? ''
  const isOwner = role === 'OWNER' || role === 'PLATFORM_ADMIN'
  const canWithdraw = isOwner || role === 'MANAGER'
  const canManageFunds = isOwner

  const { data: branchesRaw } = useBranches()
  const branches = (branchesRaw as { id: string; name: string }[] | null) ?? []
  const [branchId, setBranchId] = useState('')
  const [date, setDate] = useState(businessToday())
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [fundTab, setFundTab] = useState('ALL')
  const [txPage, setTxPage] = useState(1)
  const [transactions, setTransactions] = useState<TxRow[]>([])
  const [txTotal, setTxTotal] = useState(0)
  const [txLoading, setTxLoading] = useState(false)
  const [monthlyMonth, setMonthlyMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [monthlyData, setMonthlyData] = useState<unknown[]>([])
  const [calcLoading, setCalcLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [dashboardOverride, setDashboardOverride] = useState<DashboardData | null>(null)
  const [movement, setMovement] = useState<{ mode: 'withdraw' | 'deposit' | 'adjustment'; fund: Fund } | null>(null)
  const [editingFund, setEditingFund] = useState<Fund | null>(null)
  const [fundForm, setFundForm] = useState({
    name: '', type: 'MANUAL', fixedAmount: '0', percentage: '0', sortOrder: '0', description: '', isActive: true,
  })
  const [fundSaving, setFundSaving] = useState(false)

  useEffect(() => {
    if (branches.length && !branchId) setBranchId(branches[0].id)
  }, [branches, branchId])

  const { data: dashRaw, loading, refetch } = useProfitAllocationDashboard(branchId, date, hasAccess && !!branchId)
  const dashboard = (dashboardOverride ?? dashRaw) as DashboardData | null
  const { data: fundsRaw, refetch: refetchFunds } = useProfitFunds(branchId, hasAccess && !!branchId)
  const funds = (fundsRaw as Fund[] | null) ?? []

  const loadTransactions = useCallback(async () => {
    if (!branchId) return
    setTxLoading(true)
    try {
      const res = await profitAllocationApi.transactions({
        branchId, page: String(txPage), limit: '10',
      }) as { data: TxRow[]; meta?: { total: number } }
      setTransactions(res.data ?? [])
      setTxTotal(res.meta?.total ?? res.data?.length ?? 0)
    } catch {
      toast.error('Failed to load transactions')
    } finally {
      setTxLoading(false)
    }
  }, [branchId, txPage])

  const loadMonthly = useCallback(async () => {
    if (!branchId) return
    try {
      const res = await profitAllocationApi.monthlySummary({ branchId, month: monthlyMonth }) as { data: { summaries: unknown[] } }
      setMonthlyData(res.data?.summaries ?? (res as { summaries?: unknown[] }).summaries ?? [])
    } catch { /* noop */ }
  }, [branchId, monthlyMonth])

  useEffect(() => { loadTransactions() }, [loadTransactions])
  useEffect(() => { loadMonthly() }, [loadMonthly])

  const filteredLines = useMemo(() => {
    if (!dashboard?.lines) return []
    return dashboard.lines.filter(l => {
      if (typeFilter !== 'ALL' && l.fundType !== typeFilter) return false
      if (search && !l.fundName.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [dashboard, search, typeFilter])

  const filteredFundsForSettings = useMemo(() => {
    return funds.filter(f => {
      if (fundTab === 'FIXED_AMOUNT') return f.type === 'FIXED_AMOUNT'
      if (fundTab === 'PERCENTAGE') return f.type === 'PERCENTAGE'
      if (fundTab === 'MANUAL') return f.type === 'MANUAL'
      return true
    })
  }, [funds, fundTab])

  const handleRecalculate = async () => {
    if (!branchId) return
    setCalcLoading(true)
    try {
      const res = await profitAllocationApi.calculate({ branchId, date }) as { data: DashboardData }
      setDashboardOverride(res.data)
      toast.success('Allocation recalculated')
    } catch (e: unknown) {
      toast.error((e as { message?: string })?.message ?? 'Recalculate failed')
    } finally {
      setCalcLoading(false)
    }
  }

  const handleSave = async () => {
    if (!branchId || !dashboard) return
    if (!dashboard.percentageValid) {
      toast.error(`Percentage funds must total 100%. Current: ${dashboard.percentageTotal}%`)
      return
    }
    setSaveLoading(true)
    try {
      await profitAllocationApi.save({ branchId, date })
      toast.success('Allocation saved')
      setDashboardOverride(null)
      refetch()
      refetchFunds()
      loadTransactions()
    } catch (e: unknown) {
      toast.error((e as { message?: string })?.message ?? 'Save failed')
    } finally {
      setSaveLoading(false)
    }
  }

  const openEditFund = (f: Fund) => {
    setEditingFund(f)
    setFundForm({
      name: f.name,
      type: f.type,
      fixedAmount: String(f.fixedAmount),
      percentage: String(f.percentage),
      sortOrder: String(f.sortOrder),
      description: f.description ?? '',
      isActive: f.isActive,
    })
  }

  const saveFund = async () => {
    if (!branchId || !fundForm.name.trim()) return toast.error('Fund name required')
    setFundSaving(true)
    try {
      const body = {
        branchId,
        name: fundForm.name.trim(),
        type: fundForm.type,
        fixedAmount: parseFloat(fundForm.fixedAmount) || 0,
        percentage: parseFloat(fundForm.percentage) || 0,
        sortOrder: parseInt(fundForm.sortOrder, 10) || 0,
        description: fundForm.description || undefined,
        isActive: fundForm.isActive,
      }
      if (editingFund) {
        await profitAllocationApi.updateFund(editingFund.id, body)
        toast.success('Fund updated')
      } else {
        await profitAllocationApi.createFund(body)
        toast.success('Fund created')
      }
      setEditingFund(null)
      setFundForm({ name: '', type: 'MANUAL', fixedAmount: '0', percentage: '0', sortOrder: '0', description: '', isActive: true })
      refetchFunds()
      refetch()
    } catch (e: unknown) {
      toast.error((e as { message?: string })?.message ?? 'Failed')
    } finally {
      setFundSaving(false)
    }
  }

  const deleteFund = async (id: string) => {
    if (!confirm('Delete this fund?')) return
    try {
      await profitAllocationApi.deleteFund(id)
      toast.success('Fund deleted')
      refetchFunds()
    } catch (e: unknown) {
      toast.error((e as { message?: string })?.message ?? 'Delete failed')
    }
  }

  const exportMeta = dashboard ? {
    date,
    todaySales: dashboard.todaySales,
    todayProfit: dashboard.todayProfit,
    totalAllocated: dashboard.totalAllocated,
    remainingProfit: dashboard.remainingProfit,
  } : null

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(109,40,217,0.10)', border: '1px solid rgba(109,40,217,0.25)' }}>
          <PieChartIcon size={24} style={{ color: '#6d28d9' }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Profit Allocation not enabled</p>
        <p className="text-xs text-center max-w-sm" style={{ color: 'var(--text-muted)' }}>
          Enable in Settings → Shop Features → Profit Allocation, or contact your platform admin.
        </p>
      </div>
    )
  }

  const kpiCards = [
    { label: 'Today\'s Sales', value: formatCurrency(dashboard?.todaySales ?? 0), icon: <Banknote size={16} />, color: '#6d28d9', bg: 'rgba(109,40,217,0.08)', border: 'rgba(109,40,217,0.20)' },
    { label: 'Today\'s Profit', value: formatCurrency(dashboard?.todayProfit ?? 0), icon: <TrendingUp size={16} />, color: '#15803d', bg: 'rgba(21,128,61,0.08)', border: 'rgba(21,128,61,0.20)' },
    { label: 'Total Allocated', value: formatCurrency(dashboard?.totalAllocated ?? 0), icon: <PieChartIcon size={16} />, color: '#1d4ed8', bg: 'rgba(29,78,216,0.08)', border: 'rgba(29,78,216,0.20)' },
    { label: 'Remaining Profit', value: formatCurrency(dashboard?.remainingProfit ?? 0), icon: <Wallet size={16} />, color: '#d97706', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.20)' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Profit Allocation & Fund Management</h1>
          <p className="page-subtitle flex items-center gap-1.5">
            <Calendar size={12} />
            Allocate daily profit to funds · {formatDate(date)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {branches.length > 1 && (
            <select className="input-field text-sm max-w-[160px]" value={branchId} onChange={e => setBranchId(e.target.value)}>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <input type="date" className="input-field text-sm max-w-[160px]" value={date} onChange={e => { setDate(e.target.value); setDashboardOverride(null) }} />
          {canManageFunds && (
            <button onClick={handleRecalculate} disabled={calcLoading || dashboard?.saved} className="btn-secondary flex items-center gap-2 text-sm">
              {calcLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Recalculate
            </button>
          )}
          {isOwner && !dashboard?.saved && (
            <button onClick={handleSave} disabled={saveLoading || !dashboard} className="btn-primary flex items-center gap-2 text-sm">
              {saveLoading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Allocation
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map(({ label, value, icon, color, bg, border }) => (
          <div key={label} className="card p-4" style={{ borderColor: border, background: bg }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color, background: bg, border: `1px solid ${border}` }}>{icon}</div>
            </div>
            <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Allocation Table */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <SectionTitle title="Allocation Details" sub="Daily fund allocation breakdown" />
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input className="input-field pl-9" placeholder="Search funds…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-1 p-1 rounded-xl flex-wrap" style={{ background: 'var(--bg-subtle)' }}>
              {TYPE_FILTER_OPTIONS.map(f => (
                <button key={f.id} onClick={() => setTypeFilter(f.id)}
                  className="px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors"
                  style={typeFilter === f.id
                    ? { background: '#6d28d9', color: '#fff' }
                    : { color: 'var(--text-muted)' }}>
                  {f.label}
                </button>
              ))}
            </div>
            {exportMeta && (
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => exportAllocationCsv(filteredLines, exportMeta)} className="btn-secondary text-xs flex items-center gap-1.5"><Download size={12} /> CSV</button>
                <button onClick={() => exportAllocationExcel(filteredLines, exportMeta)} className="btn-secondary text-xs flex items-center gap-1.5"><FileSpreadsheet size={12} /> Excel</button>
                <button onClick={() => exportAllocationPdf(filteredLines, exportMeta)} className="btn-secondary text-xs flex items-center gap-1.5"><FileText size={12} /> PDF</button>
              </div>
            )}
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-400" size={24} /></div>
        ) : filteredLines.length === 0 ? (
          <div className="py-12 text-center">
            <Layers size={28} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No funds match your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Fund', 'Type', 'Value', 'Today', 'Yesterday', 'Total', 'Withdrawn', 'Remaining', 'Actions'].map((h, i) => (
                    <th key={h} className={`table-header whitespace-nowrap${i >= 3 ? ' text-right' : ''}${i === 8 ? ' text-center' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLines.map(line => {
                  const fund = funds.find(f => f.id === line.fundId)
                  const tc = FUND_TYPE_COLORS[line.fundType] ?? FUND_TYPE_COLORS.MANUAL
                  const valueLabel = line.fundType === 'FIXED_AMOUNT'
                    ? formatCurrency(line.value)
                    : line.fundType === 'PERCENTAGE' ? `${line.value}%` : '—'
                  return (
                    <tr key={line.fundId} className="transition-colors hover:bg-white/2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td className="table-cell">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: tc.bg, border: `1px solid ${tc.border}`, color: tc.color }}>
                            <Wallet size={12} />
                          </div>
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{line.fundName}</span>
                        </div>
                      </td>
                      <td className="table-cell"><FundTypeBadge type={line.fundType} /></td>
                      <td className="table-cell"><span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{valueLabel}</span></td>
                      <td className="table-cell text-right"><span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(line.todayAllocation)}</span></td>
                      <td className="table-cell text-right"><span className="text-sm" style={{ color: 'var(--text-muted)' }}>{formatCurrency(line.yesterdayBalance)}</span></td>
                      <td className="table-cell text-right"><span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(line.totalBalance)}</span></td>
                      <td className="table-cell text-right"><span className="text-sm font-semibold" style={{ color: '#b91c1c' }}>{formatCurrency(line.withdrawn)}</span></td>
                      <td className="table-cell text-right"><span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(line.remainingBalance)}</span></td>
                      <td className="table-cell text-center">
                        {canWithdraw && fund && (
                          <div className="flex items-center justify-center gap-1">
                            <button title="Withdraw" onClick={() => setMovement({ mode: 'withdraw', fund })} className="p-1.5 rounded-lg hover:bg-red-500/10" style={{ color: '#b91c1c' }}><ArrowDownRight size={13} /></button>
                            <button title="Deposit" onClick={() => setMovement({ mode: 'deposit', fund })} className="p-1.5 rounded-lg hover:bg-emerald-500/10" style={{ color: '#15803d' }}><ArrowUpRight size={13} /></button>
                            <button title="Adjust" onClick={() => setMovement({ mode: 'adjustment', fund })} className="p-1.5 rounded-lg hover:bg-sky-500/10" style={{ color: '#0284c7' }}><SlidersHorizontal size={13} /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {dashboard && (
          <div className="px-5 py-3 border-t flex flex-wrap items-center justify-between gap-2 text-xs" style={{ borderColor: 'var(--border-subtle)' }}>
            <span style={{ color: dashboard.percentageValid ? '#15803d' : '#b91c1c' }}>
              Percentage funds total: {dashboard.percentageTotal}% {dashboard.percentageValid ? '(valid)' : '(must equal 100%)'}
            </span>
            {dashboard.saved && <span className="font-semibold" style={{ color: '#15803d' }}>✓ Saved for {formatDate(date)}</span>}
          </div>
        )}
      </div>

      {/* Bottom 3-column section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Fund settings list */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Allocation Settings</h3>
            {canManageFunds && (
              <button onClick={() => { setEditingFund(null); setFundForm({ name: '', type: 'MANUAL', fixedAmount: '0', percentage: '0', sortOrder: String(funds.length), description: '', isActive: true }) }}
                className="text-xs flex items-center gap-1 font-semibold" style={{ color: '#6d28d9' }}>
                <Plus size={12} /> Add Fund
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {['ALL', 'FIXED_AMOUNT', 'PERCENTAGE', 'MANUAL'].map(t => (
              <button key={t} onClick={() => setFundTab(t)}
                className="px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors"
                style={fundTab === t
                  ? { background: '#6d28d9', color: '#fff', border: '1px solid #6d28d9' }
                  : { background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                {t === 'ALL' ? 'All Funds' : t === 'FIXED_AMOUNT' ? 'Fixed' : t === 'PERCENTAGE' ? 'Percentage' : 'Manual'}
              </button>
            ))}
          </div>
          <div className="space-y-0 max-h-64 overflow-y-auto">
            {filteredFundsForSettings.map(f => {
              const tc = FUND_TYPE_COLORS[f.type] ?? FUND_TYPE_COLORS.MANUAL
              return (
              <div key={f.id} className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/2"
                style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: tc.bg, border: `1px solid ${tc.border}`, color: tc.color }}>
                  <Wallet size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{f.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <FundTypeBadge type={f.type} />
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{f.isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
                {canManageFunds && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEditFund(f)} className="p-1.5 rounded-lg hover:bg-violet-500/10"><Edit2 size={13} style={{ color: '#6d28d9' }} /></button>
                    <button onClick={() => deleteFund(f.id)} className="p-1.5 rounded-lg hover:bg-red-500/10"><Trash2 size={13} style={{ color: '#b91c1c' }} /></button>
                  </div>
                )}
              </div>
              )
            })}
          </div>
        </div>

        {/* Fund configuration form */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{editingFund ? 'Edit Fund' : 'Fund Configuration'}</h3>
          {!canManageFunds ? (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Only owners can manage fund configuration.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Fund Name</label>
                <input className="input-field" placeholder="Fund name" value={fundForm.name} onChange={e => setFundForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Fund Type</label>
                <select className="input-field" value={fundForm.type} onChange={e => setFundForm(p => ({ ...p, type: e.target.value }))}>
                  <option value="FIXED_AMOUNT">Fixed Amount</option>
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="MANUAL">Manual</option>
                </select>
              </div>
              {fundForm.type === 'FIXED_AMOUNT' && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Fixed Amount (Rs.)</label>
                  <input className="input-field" type="number" placeholder="0" value={fundForm.fixedAmount} onChange={e => setFundForm(p => ({ ...p, fixedAmount: e.target.value }))} />
                </div>
              )}
              {fundForm.type === 'PERCENTAGE' && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Percentage (%)</label>
                  <input className="input-field" type="number" placeholder="0" value={fundForm.percentage} onChange={e => setFundForm(p => ({ ...p, percentage: e.target.value }))} />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Sort Order</label>
                <input className="input-field" type="number" placeholder="0" value={fundForm.sortOrder} onChange={e => setFundForm(p => ({ ...p, sortOrder: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Description</label>
                <textarea className="input-field min-h-[72px]" placeholder="Optional description" value={fundForm.description} onChange={e => setFundForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <input type="checkbox" checked={fundForm.isActive} onChange={e => setFundForm(p => ({ ...p, isActive: e.target.checked }))} />
                Active
              </label>
              <div className="flex gap-3 pt-1">
                <button onClick={() => { setEditingFund(null); setFundForm({ name: '', type: 'MANUAL', fixedAmount: '0', percentage: '0', sortOrder: '0', description: '', isActive: true }) }} className="btn-secondary flex-1 text-sm">Cancel</button>
                <button onClick={saveFund} disabled={fundSaving} className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                  {fundSaving ? <Loader2 size={14} className="animate-spin" /> : (editingFund ? 'Update Fund' : 'Add Fund')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Recent transactions */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Recent Transactions</h3>
          {txLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-violet-400" size={22} /></div>
          ) : transactions.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>No transactions yet</p>
          ) : (
            <div className="space-y-0 max-h-72 overflow-y-auto">
              {transactions.map(tx => (
                <div key={tx.id} className="flex items-center gap-3 px-2 py-3 transition-colors hover:bg-white/2"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={tx.amount < 0 || tx.type === 'WITHDRAW'
                      ? { background: 'rgba(185,28,28,0.10)', border: '1px solid rgba(185,28,28,0.25)', color: '#b91c1c' }
                      : { background: 'rgba(21,128,61,0.10)', border: '1px solid rgba(21,128,61,0.25)', color: '#15803d' }}>
                    {tx.amount < 0 || tx.type === 'WITHDRAW' ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{tx.fund?.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                        style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                        {tx.type}
                      </span>
                      <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{formatDate(tx.createdAt)}</span>
                    </div>
                    {tx.notes && <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{tx.notes}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold" style={{ color: tx.amount < 0 ? '#b91c1c' : '#15803d' }}>
                      {tx.amount < 0 ? '' : '+'}{formatCurrency(tx.amount)}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Bal {formatCurrency(tx.balanceAfter)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {txTotal > 10 && (
            <div className="flex justify-center gap-2 mt-4">
              <button disabled={txPage <= 1} onClick={() => setTxPage(p => p - 1)} className="btn-secondary text-xs px-3 py-1.5">Prev</button>
              <span className="text-xs self-center" style={{ color: 'var(--text-muted)' }}>Page {txPage}</span>
              <button disabled={txPage * 10 >= txTotal} onClick={() => setTxPage(p => p + 1)} className="btn-secondary text-xs px-3 py-1.5">Next</button>
            </div>
          )}
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Monthly Summary</h3>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Opening, allocated, withdrawn & closing balances</p>
          </div>
          <input type="month" className="input-field text-sm max-w-[160px]" value={monthlyMonth} onChange={e => setMonthlyMonth(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {['Fund', 'Opening', 'Allocated', 'Withdrawn', 'Deposited', 'Closing'].map((h, i) => (
                  <th key={h} className={`table-header${i > 0 ? ' text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(monthlyData as Array<Record<string, unknown>>).map((row, i) => (
                <tr key={i} className="transition-colors hover:bg-white/2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="table-cell"><span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{String(row.fundName)}</span></td>
                  <td className="table-cell text-right"><span className="text-sm" style={{ color: 'var(--text-muted)' }}>{formatCurrency(Number(row.openingBalance ?? 0))}</span></td>
                  <td className="table-cell text-right"><span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(Number(row.allocatedAmount ?? 0))}</span></td>
                  <td className="table-cell text-right"><span className="text-sm font-semibold" style={{ color: '#b91c1c' }}>{formatCurrency(Number(row.withdrawnAmount ?? 0))}</span></td>
                  <td className="table-cell text-right"><span className="text-sm font-semibold" style={{ color: '#15803d' }}>{formatCurrency(Number(row.depositedAmount ?? 0))}</span></td>
                  <td className="table-cell text-right"><span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(Number(row.closingBalance ?? 0))}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {movement && (
        <MovementModal
          mode={movement.mode}
          fund={movement.fund}
          branchId={branchId}
          date={date}
          onClose={() => setMovement(null)}
          onDone={() => { refetch(); refetchFunds(); loadTransactions(); setDashboardOverride(null) }}
        />
      )}
    </div>
  )
}
