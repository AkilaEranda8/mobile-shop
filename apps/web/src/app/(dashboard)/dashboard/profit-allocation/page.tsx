'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  PieChart, TrendingUp, Wallet, Banknote, RefreshCw, Save, Plus, Search,
  Download, FileSpreadsheet, FileText, X, Loader2, Edit2, Trash2, ArrowDownRight,
  ArrowUpRight, SlidersHorizontal, ChevronDown,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency, formatDate } from '@/lib/utils'
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

function KpiCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color: string }) {
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}18`, border: `1px solid ${color}33` }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <p className="text-xl font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>{value}</p>
      </div>
    </div>
  )
}

function FundTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    FIXED_AMOUNT: 'bg-violet-500/15 text-violet-600 border-violet-500/30',
    PERCENTAGE: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
    MANUAL: 'bg-sky-500/15 text-sky-600 border-sky-500/30',
  }
  const labels: Record<string, string> = {
    FIXED_AMOUNT: 'Fixed',
    PERCENTAGE: 'Percentage',
    MANUAL: 'Manual',
  }
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${styles[type] ?? 'bg-gray-500/10 text-gray-600'}`}>
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
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{titles[mode]} — {fund.name}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}><X size={15} /></button>
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
          <button onClick={submit} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading ? <Loader2 size={14} className="animate-spin" /> : titles[mode]}
          </button>
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
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
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
        <PieChart size={40} style={{ color: 'var(--text-muted)' }} />
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Profit Allocation not enabled</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Enable in Settings → Shop Features, or contact your platform admin.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Profit Allocation & Fund Management</h1>
          <p className="page-subtitle">Allocate today&apos;s profit to different funds and manage balances</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {branches.length > 1 && (
            <select className="input-field h-9 text-sm w-40" value={branchId} onChange={e => setBranchId(e.target.value)}>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <input type="date" className="input-field h-9 text-sm w-40" value={date} onChange={e => { setDate(e.target.value); setDashboardOverride(null) }} />
          {canManageFunds && (
            <button onClick={handleRecalculate} disabled={calcLoading || dashboard?.saved} className="btn-secondary h-9 text-xs flex items-center gap-1.5">
              {calcLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Recalculate
            </button>
          )}
          {isOwner && !dashboard?.saved && (
            <button onClick={handleSave} disabled={saveLoading || !dashboard} className="btn-primary h-9 text-xs flex items-center gap-1.5">
              {saveLoading ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save Allocation
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Today's Sales" value={formatCurrency(dashboard?.todaySales ?? 0)} icon={Banknote} color="#6366f1" />
        <KpiCard label="Today's Profit" value={formatCurrency(dashboard?.todayProfit ?? 0)} icon={TrendingUp} color="#10b981" />
        <KpiCard label="Total Allocated" value={formatCurrency(dashboard?.totalAllocated ?? 0)} icon={PieChart} color="#3b82f6" />
        <KpiCard label="Remaining Profit" value={formatCurrency(dashboard?.remainingProfit ?? 0)} icon={Wallet} color="#f59e0b" />
      </div>

      {/* Allocation Table */}
      <div className="card overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Allocation Details</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input className="input-field h-8 pl-8 text-xs w-44" placeholder="Search funds…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input-field h-8 text-xs w-32" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="ALL">All Types</option>
              <option value="FIXED_AMOUNT">Fixed</option>
              <option value="PERCENTAGE">Percentage</option>
              <option value="MANUAL">Manual</option>
            </select>
            {exportMeta && (
              <>
                <button onClick={() => exportAllocationCsv(filteredLines, exportMeta)} className="btn-secondary h-8 text-xs px-2.5 flex items-center gap-1"><Download size={12} /> CSV</button>
                <button onClick={() => exportAllocationExcel(filteredLines, exportMeta)} className="btn-secondary h-8 text-xs px-2.5 flex items-center gap-1"><FileSpreadsheet size={12} /> Excel</button>
                <button onClick={() => exportAllocationPdf(filteredLines, exportMeta)} className="btn-secondary h-8 text-xs px-2.5 flex items-center gap-1"><FileText size={12} /> PDF</button>
              </>
            )}
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'var(--bg-subtle)' }}>
                  {['Fund Name', 'Type', 'Value', 'Today Allocation', 'Yesterday Balance', 'Total Balance', 'Withdrawn', 'Remaining Balance', 'Actions'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLines.map(line => {
                  const fund = funds.find(f => f.id === line.fundId)
                  const valueLabel = line.fundType === 'FIXED_AMOUNT'
                    ? formatCurrency(line.value)
                    : line.fundType === 'PERCENTAGE' ? `${line.value}%` : '—'
                  return (
                    <tr key={line.fundId} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                      <td className="px-3 py-2.5 font-semibold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{line.fundName}</td>
                      <td className="px-3 py-2.5"><FundTypeBadge type={line.fundType} /></td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{valueLabel}</td>
                      <td className="px-3 py-2.5 font-medium">{formatCurrency(line.todayAllocation)}</td>
                      <td className="px-3 py-2.5">{formatCurrency(line.yesterdayBalance)}</td>
                      <td className="px-3 py-2.5 font-semibold">{formatCurrency(line.totalBalance)}</td>
                      <td className="px-3 py-2.5 text-red-500">{formatCurrency(line.withdrawn)}</td>
                      <td className="px-3 py-2.5 font-bold">{formatCurrency(line.remainingBalance)}</td>
                      <td className="px-3 py-2.5">
                        {canWithdraw && fund && (
                          <div className="flex items-center gap-1">
                            <button title="Withdraw" onClick={() => setMovement({ mode: 'withdraw', fund })} className="p-1 rounded hover:bg-red-500/10 text-red-500"><ArrowDownRight size={13} /></button>
                            <button title="Deposit" onClick={() => setMovement({ mode: 'deposit', fund })} className="p-1 rounded hover:bg-emerald-500/10 text-emerald-600"><ArrowUpRight size={13} /></button>
                            <button title="Adjust" onClick={() => setMovement({ mode: 'adjustment', fund })} className="p-1 rounded hover:bg-sky-500/10 text-sky-600"><SlidersHorizontal size={13} /></button>
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
          <div className="px-4 py-3 border-t flex flex-wrap items-center justify-between gap-2 text-xs" style={{ borderColor: 'var(--border-subtle)' }}>
            <span style={{ color: dashboard.percentageValid ? '#10b981' : '#ef4444' }}>
              Percentage funds total: {dashboard.percentageTotal}% {dashboard.percentageValid ? '(valid)' : '(must equal 100%)'}
            </span>
            {dashboard.saved && <span className="text-emerald-600 font-semibold">✓ Saved for {formatDate(date)}</span>}
          </div>
        )}
      </div>

      {/* Bottom 3-column section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Fund settings list */}
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Allocation Settings</h3>
            {canManageFunds && (
              <button onClick={() => { setEditingFund(null); setFundForm({ name: '', type: 'MANUAL', fixedAmount: '0', percentage: '0', sortOrder: String(funds.length), description: '', isActive: true }) }} className="text-xs flex items-center gap-1 text-violet-600 font-semibold">
                <Plus size={12} /> Add
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {['ALL', 'FIXED_AMOUNT', 'PERCENTAGE', 'MANUAL'].map(t => (
              <button key={t} onClick={() => setFundTab(t)} className={`text-[10px] px-2 py-1 rounded-lg font-semibold border ${fundTab === t ? 'bg-violet-600 text-white border-violet-600' : ''}`}
                style={fundTab !== t ? { borderColor: 'var(--border-default)', color: 'var(--text-muted)' } : undefined}>
                {t === 'ALL' ? 'All' : t === 'FIXED_AMOUNT' ? 'Fixed' : t === 'PERCENTAGE' ? '%' : 'Manual'}
              </button>
            ))}
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {filteredFundsForSettings.map(f => (
              <div key={f.id} className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-black/5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{f.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <FundTypeBadge type={f.type} />
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{f.isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
                {canManageFunds && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEditFund(f)} className="p-1 rounded hover:bg-violet-500/10"><Edit2 size={12} className="text-violet-600" /></button>
                    <button onClick={() => deleteFund(f.id)} className="p-1 rounded hover:bg-red-500/10"><Trash2 size={12} className="text-red-500" /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Fund configuration form */}
        <div className="card p-4 space-y-3">
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{editingFund ? 'Edit Fund' : 'Fund Configuration'}</h3>
          {!canManageFunds ? (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Only owners can manage fund configuration.</p>
          ) : (
            <div className="space-y-2">
              <input className="input-field text-sm" placeholder="Fund name" value={fundForm.name} onChange={e => setFundForm(p => ({ ...p, name: e.target.value }))} />
              <select className="input-field text-sm" value={fundForm.type} onChange={e => setFundForm(p => ({ ...p, type: e.target.value }))}>
                <option value="FIXED_AMOUNT">Fixed Amount</option>
                <option value="PERCENTAGE">Percentage</option>
                <option value="MANUAL">Manual</option>
              </select>
              {fundForm.type === 'FIXED_AMOUNT' && (
                <input className="input-field text-sm" type="number" placeholder="Fixed amount (Rs.)" value={fundForm.fixedAmount} onChange={e => setFundForm(p => ({ ...p, fixedAmount: e.target.value }))} />
              )}
              {fundForm.type === 'PERCENTAGE' && (
                <input className="input-field text-sm" type="number" placeholder="Percentage %" value={fundForm.percentage} onChange={e => setFundForm(p => ({ ...p, percentage: e.target.value }))} />
              )}
              <input className="input-field text-sm" type="number" placeholder="Sort order" value={fundForm.sortOrder} onChange={e => setFundForm(p => ({ ...p, sortOrder: e.target.value }))} />
              <textarea className="input-field text-sm min-h-[60px]" placeholder="Description" value={fundForm.description} onChange={e => setFundForm(p => ({ ...p, description: e.target.value }))} />
              <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <input type="checkbox" checked={fundForm.isActive} onChange={e => setFundForm(p => ({ ...p, isActive: e.target.checked }))} />
                Active
              </label>
              <div className="flex gap-2 pt-1">
                <button onClick={() => { setEditingFund(null); setFundForm({ name: '', type: 'MANUAL', fixedAmount: '0', percentage: '0', sortOrder: '0', description: '', isActive: true }) }} className="btn-secondary flex-1 text-xs">Cancel</button>
                <button onClick={saveFund} disabled={fundSaving} className="btn-primary flex-1 text-xs flex items-center justify-center gap-1">
                  {fundSaving ? <Loader2 size={12} className="animate-spin" /> : (editingFund ? 'Update Fund' : 'Add Fund')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Recent transactions */}
        <div className="card p-4 space-y-3">
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Recent Transactions</h3>
          {txLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin" size={20} style={{ color: 'var(--text-muted)' }} /></div>
          ) : transactions.length === 0 ? (
            <p className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>No transactions yet</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {transactions.map(tx => (
                <div key={tx.id} className="px-2 py-2 rounded-lg text-xs" style={{ background: 'var(--bg-subtle)' }}>
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{tx.fund?.name}</span>
                    <span className={tx.amount < 0 ? 'text-red-500 font-bold' : 'text-emerald-600 font-bold'}>
                      {tx.amount < 0 ? '' : '+'}{formatCurrency(tx.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between mt-1" style={{ color: 'var(--text-muted)' }}>
                    <span>{formatDate(tx.createdAt)} · {tx.type}</span>
                    <span>Bal {formatCurrency(tx.balanceAfter)}</span>
                  </div>
                  {tx.notes && <p className="mt-1 truncate" style={{ color: 'var(--text-muted)' }}>{tx.notes}</p>}
                </div>
              ))}
            </div>
          )}
          {txTotal > 10 && (
            <div className="flex justify-center gap-2">
              <button disabled={txPage <= 1} onClick={() => setTxPage(p => p - 1)} className="btn-secondary text-xs px-3 py-1">Prev</button>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Page {txPage}</span>
              <button disabled={txPage * 10 >= txTotal} onClick={() => setTxPage(p => p + 1)} className="btn-secondary text-xs px-3 py-1">Next</button>
            </div>
          )}
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Monthly Summary</h3>
          <input type="month" className="input-field h-8 text-xs w-36" value={monthlyMonth} onChange={e => setMonthlyMonth(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'var(--bg-subtle)' }}>
                {['Fund', 'Opening', 'Allocated', 'Withdrawn', 'Deposited', 'Closing'].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(monthlyData as Array<Record<string, unknown>>).map((row, i) => (
                <tr key={i} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <td className="px-3 py-2 font-semibold">{String(row.fundName)}</td>
                  <td className="px-3 py-2">{formatCurrency(Number(row.openingBalance ?? 0))}</td>
                  <td className="px-3 py-2">{formatCurrency(Number(row.allocatedAmount ?? 0))}</td>
                  <td className="px-3 py-2 text-red-500">{formatCurrency(Number(row.withdrawnAmount ?? 0))}</td>
                  <td className="px-3 py-2 text-emerald-600">{formatCurrency(Number(row.depositedAmount ?? 0))}</td>
                  <td className="px-3 py-2 font-bold">{formatCurrency(Number(row.closingBalance ?? 0))}</td>
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
