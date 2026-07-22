'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  TrendingUp, TrendingDown, Download, Plus, ArrowUpRight, ArrowDownRight,
  Loader2, Wallet, Receipt, BarChart2, Calendar, X
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from 'recharts'
import { formatCurrency, formatDate } from '@/lib/utils'
import { businessToday, businessPeriodFrom, formatBusinessDateLabel } from '@/lib/business-date'
import { getActiveBranchId } from '@/lib/active-branch'
import { useTransactions, useRevenue, useFinanceSummary, useFeatureFlag } from '@/lib/hooks'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { financeApi } from '@/lib/api'
import toast from 'react-hot-toast'
import type { Transaction as AppTransaction } from '@/types'
import { useModuleAccess, viewOnlyToast } from '@/lib/module-access'

const COLORS = ['var(--brand-primary)', '#06b6d4', '#10b981', 'var(--status-warn)', '#ef4444']

function AddTransactionModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ type: 'EXPENSE', category: 'Other Expenses', amount: '', description: '', paymentMethod: 'CASH' })
  const [loading, setLoading] = useState(false)
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }))
  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const branchId = getActiveBranchId()
    if (!branchId) {
      toast.error('Select an active branch first')
      return
    }
    const amount = parseFloat(form.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    setLoading(true)
    try {
      await financeApi.create({ ...form, branchId, amount })
      toast.success('Transaction recorded')
      onSaved(); onClose()
    } catch (err: any) { toast.error(err?.message ?? 'Failed') } finally { setLoading(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl shadow-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
              <Receipt size={14} className="text-violet-400" />
            </div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Add Transaction</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}><X size={15} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Type</label>
              <select className="input-field" value={form.type} onChange={f('type')}>
                <option value="INCOME">Income</option>
                <option value="EXPENSE">Expense</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Amount (LKR) *</label>
              <input required type="number" min="0" className="input-field" placeholder="5000" value={form.amount} onChange={f('amount')} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Description *</label>
              <input required className="input-field" placeholder="e.g. Monthly rent" value={form.description} onChange={f('description')} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Category</label>
              {form.type === 'EXPENSE' ? (
                <select className="input-field" value={form.category} onChange={f('category')}>
                  {['Rent', 'Salary', 'Electricity', 'Transport', 'Marketing', 'Other Expenses'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              ) : (
                <input className="input-field" placeholder="Sales, Repair..." value={form.category} onChange={f('category')} />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Payment Method</label>
              <select className="input-field" value={form.paymentMethod} onChange={f('paymentMethod')}>
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CARD">Card</option>
                <option value="UPI">UPI</option>
                <option value="WALLET">Wallet</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: '10px',
  fontSize: '12px',
  color: 'var(--text-primary)',
}

export default function FinancePage() {
  const searchParams = useSearchParams()
  const { canEdit } = useModuleAccess()
  const [tab, setTab]     = useState<'overview' | 'transactions'>('overview')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL')
  const [showAdd, setShowAdd] = useState(false)

  const mtdParams = useMemo(() => {
    const to = businessToday()
    return { from: `${to.slice(0, 7)}-01`, to }
  }, [])
  const revenueParams = useMemo(() => {
    const to = businessToday()
    return { from: businessPeriodFrom(60, to), to }
  }, [])

  const { data: txData,      loading: txLoading, refetch: refetchTx }     = useTransactions()
  const { data: rawRevenue }                                                = useRevenue(revenueParams)
  const { data: summaryData, refetch: refetchSummary }                     = useFinanceSummary(mtdParams)
  const hasDailyClosing = useFeatureFlag('DAILY_CLOSING')

  const transactions: AppTransaction[] = (txData?.data ?? []) as AppTransaction[]
  const revenueArr: any[]  = Array.isArray(rawRevenue) ? rawRevenue : []
  const summary            = summaryData as any

  useEffect(() => {
    const onSale = () => { refetchTx(); refetchSummary() }
    window.addEventListener('pos:sale-complete', onSale)
    return () => window.removeEventListener('pos:sale-complete', onSale)
  }, [refetchTx, refetchSummary])

  useEffect(() => {
    const action = searchParams.get('action')
    if (action === 'add-expense' || action === 'add' || searchParams.get('new') === '1') {
      if (!canEdit) {
        viewOnlyToast('Finance')
        return
      }
      setShowAdd(true)
      setTab('transactions')
    }
  }, [searchParams, canEdit])

  const salesRevenue = summary?.salesRevenue  ?? 0
  const otherIncome  = summary?.otherIncome   ?? 0
  const income       = summary?.totalIncome   ?? (salesRevenue + otherIncome)
  const cogs         = summary?.cogs          ?? 0
  const opExpenses   = summary?.opExpenses    ?? 0
  const expense      = summary?.totalExpense  ?? (cogs + opExpenses)
  const grossProfit  = summary?.grossProfit   ?? (salesRevenue - cogs)
  const profit       = summary?.profit        ?? (income - expense)
  const margin       = income > 0 ? Math.round((profit / income) * 100) : 0

  /* chart data from revenue summaries (last 8 weeks grouped by week) */
  const chartData = useMemo(() => {
    if (!revenueArr.length) return []
    return revenueArr.slice(-10).map((d: any) => ({
      label: formatBusinessDateLabel(d.date),
      revenue:  Math.round((d.totalRevenue  ?? 0)),
      expenses: Math.round((d.totalExpenses ?? 0) + (d.cogs ?? 0)),
      profit:   Math.round((d.profit        ?? 0)),
    }))
  }, [revenueArr])

  /* pie: income by category from transactions */
  const pieData = useMemo(() => {
    const map: Record<string, number> = {}
    transactions.filter(t => t.type === 'INCOME').forEach(t => {
      map[t.category] = (map[t.category] ?? 0) + t.amount
    })
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([name, value], i) => ({ name, value, fill: COLORS[i % COLORS.length] }))
  }, [transactions])

  /* method breakdown */
  const methodData = useMemo(() => {
    const map: Record<string, number> = {}
    transactions.forEach(t => { map[t.paymentMethod] = (map[t.paymentMethod] ?? 0) + t.amount })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ name: name.replace('_', ' '), value, fill: COLORS[i % COLORS.length] }))
  }, [transactions])

  const filtered = useMemo(() =>
    transactions.filter(t =>
      (typeFilter === 'ALL' || t.type === typeFilter) &&
      t.description.toLowerCase().includes(search.toLowerCase())
    ), [transactions, typeFilter, search])

  const handleSaved = () => { refetchTx(); refetchSummary() }

  return (
    <div className="space-y-6">
      {showAdd && <AddTransactionModal onClose={() => setShowAdd(false)} onSaved={handleSaved} />}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Finance & Accounting</h1>
          <p className="page-subtitle flex items-center gap-1.5">
            <Calendar size={12} />
            {new Date(`${businessToday()}T12:00:00+05:30`).toLocaleDateString('en-LK', { month: 'long', year: 'numeric', timeZone: 'Asia/Colombo' })} · Month-to-date
          </p>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          {canEdit && (
            <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
              <Plus size={14} />Add Transaction
            </button>
          )}
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
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>End-of-day summary uses this Finance data automatically</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-violet-400">Open →</span>
        </Link>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Sales Revenue',
            value: formatCurrency(salesRevenue),
            sub: `+ ${formatCurrency(otherIncome)} other income`,
            icon: <ArrowUpRight size={18} />,
            color: '#16a34a',
            bg: 'rgba(21,128,61,0.08)',
            border: 'rgba(21,128,61,0.20)',
          },
          {
            label: 'Gross Profit',
            value: formatCurrency(grossProfit),
            sub: `COGS: ${formatCurrency(cogs)}`,
            icon: <TrendingUp size={18} />,
            color: '#0e7490',
            bg: 'rgba(14,116,144,0.08)',
            border: 'rgba(14,116,144,0.20)',
          },
          {
            label: 'Operating Expenses',
            value: formatCurrency(opExpenses),
            sub: `${transactions.filter(t => t.type === 'EXPENSE').length} expense records`,
            icon: <ArrowDownRight size={18} />,
            color: '#b91c1c',
            bg: 'rgba(185,28,28,0.08)',
            border: 'rgba(185,28,28,0.20)',
          },
          {
            label: 'Net Profit',
            value: formatCurrency(profit),
            sub: `Margin: ${margin}%`,
            icon: <Wallet size={18} />,
            color: profit >= 0 ? 'var(--brand-primary-light)' : '#b91c1c',
            bg: profit >= 0 ? 'var(--brand-glow)' : 'rgba(185,28,28,0.08)',
            border: profit >= 0 ? 'var(--sidebar-active-border)' : 'rgba(185,28,28,0.20)',
          },
        ].map(({ label, value, sub, icon, color, bg, border }) => (
          <div key={label} className="card p-5" style={{ borderColor: border, background: bg }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold" style={{ color }}>{label}</span>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: bg, border: `1px solid ${border}`, color }}>
                {icon}
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--bg-subtle)' }}>
        {[['overview', 'Overview', BarChart2], ['transactions', 'Transactions', Receipt]].map(([key, label, Icon]: any) => (
          <button key={key} onClick={() => setTab(key)}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs rounded-lg font-medium transition-colors"
            style={tab === key
              ? { background: 'var(--brand-primary-light)', color: '#fff' }
              : { color: 'var(--text-muted)' }}>
            <Icon size={12} />{label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid lg:grid-cols-3 gap-4">
            {/* Revenue vs Expense chart */}
            <div className="lg:col-span-2 card p-5">
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                Revenue vs Expenses · Last 10 Days (LKR)
              </h3>
              {chartData.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-xs" style={{ color: 'var(--text-muted)' }}>
                  No revenue data available yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} barSize={16} barGap={3}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="revenue"  fill="var(--brand-primary-light)" name="Revenue"  radius={[3,3,0,0]} />
                    <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[3,3,0,0]} opacity={0.75} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Income by Category Pie */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Income by Category</h3>
              {pieData.length === 0 ? (
                <div className="h-28 flex items-center justify-center text-xs" style={{ color: 'var(--text-muted)' }}>
                  No income transactions yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={130}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={38} outerRadius={58} dataKey="value" strokeWidth={0}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="mt-3 space-y-1.5">
                {pieData.map((cat, i) => (
                  <div key={cat.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.fill }} />
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{cat.name}</span>
                    </div>
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(cat.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Profit trend line */}
          {chartData.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Profit Trend</h3>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey="profit" stroke="var(--brand-primary-light)" strokeWidth={2} dot={{ r: 3, fill: 'var(--brand-primary-light)' }} name="Profit" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Payment Method breakdown */}
          {methodData.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Payment Methods</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {methodData.map((m, i) => (
                  <div key={m.name} className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                      {m.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{m.name}</p>
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{formatCurrency(m.value)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Transactions Tab ── */}
      {tab === 'transactions' && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <input type="text" placeholder="Search transactions…" className="input-field max-w-xs"
              value={search} onChange={e => setSearch(e.target.value)} />
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-subtle)' }}>
              {(['ALL', 'INCOME', 'EXPENSE'] as const).map(f => (
                <button key={f} onClick={() => setTypeFilter(f)}
                  className="px-3 py-1.5 text-xs rounded-lg font-medium transition-colors"
                  style={typeFilter === f
                    ? { background: f === 'INCOME' ? '#15803d' : f === 'EXPENSE' ? '#b91c1c' : 'var(--brand-primary-light)', color: '#fff' }
                    : { color: 'var(--text-muted)' }}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="card overflow-hidden">
            {txLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-violet-400" size={24} /></div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No transactions found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      {['Description', 'Category', 'Date', 'Method', 'Amount'].map((h, i) => (
                        <th key={h} className={`table-header${i === 4 ? ' text-right' : i === 3 ? ' text-center' : ''}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((tx) => (
                      <tr key={tx.id} className="transition-colors hover:bg-white/2"
                        style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td className="table-cell">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={tx.type === 'INCOME'
                                ? { background: 'rgba(21,128,61,0.10)', border: '1px solid rgba(21,128,61,0.25)' }
                                : { background: 'rgba(185,28,28,0.10)', border: '1px solid rgba(185,28,28,0.25)' }}>
                              {tx.type === 'INCOME'
                                ? <TrendingUp size={12} style={{ color: '#15803d' }} />
                                : <TrendingDown size={12} style={{ color: '#b91c1c' }} />}
                            </div>
                            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{tx.description}</span>
                          </div>
                        </td>
                        <td className="table-cell">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                            {tx.category}
                          </span>
                        </td>
                        <td className="table-cell">
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(tx.createdAt)}</span>
                        </td>
                        <td className="table-cell text-center">
                          <span className="text-xs px-2 py-0.5 rounded font-medium"
                            style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
                            {tx.paymentMethod.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="table-cell text-right">
                          <span className="text-sm font-bold"
                            style={{ color: tx.type === 'INCOME' ? '#15803d' : '#b91c1c' }}>
                            {tx.type === 'INCOME' ? '+' : '−'}{formatCurrency(tx.amount)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
