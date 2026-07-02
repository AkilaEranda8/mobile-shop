'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Receipt, Plus, X, Loader2, TrendingDown, ArrowDownRight, Tag, CreditCard } from 'lucide-react'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useTransactions, useFinanceSummary } from '@/lib/hooks'
import { financeApi } from '@/lib/api'
import toast from 'react-hot-toast'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const categories = ['All', 'Rent', 'Salary', 'Utilities', 'Marketing', 'Inventory', 'Repairs', 'Misc']

const CAT_COLORS: Record<string, string> = {
  Rent:      '#b91c1c',
  Salary:    '#6d28d9',
  Utilities: '#1d4ed8',
  Marketing: '#b45309',
  Inventory: '#15803d',
  Repairs:   '#c2410c',
  Misc:      '#475569',
}
const CHART_COLORS = ['#b91c1c','#6d28d9','#1d4ed8','#b45309','#15803d','#c2410c','#475569']

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: '10px',
  fontSize: '12px',
  color: 'var(--text-primary)',
}

function AddExpenseModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    description: '', category: 'Misc', amount: '',
    paymentMethod: 'CASH', type: 'EXPENSE',
  })
  const [loading, setLoading] = useState(false)
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await financeApi.create({
        type: 'EXPENSE',
        category: form.category,
        amount: parseFloat(form.amount),
        description: form.description,
        paymentMethod: form.paymentMethod,
      })
      toast.success('Expense recorded')
      onSaved()
      onClose()
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save expense')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl shadow-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(185,28,28,0.10)', border: '1px solid rgba(185,28,28,0.25)' }}>
              <TrendingDown size={14} style={{ color: '#b91c1c' }} />
            </div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Add Expense</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}><X size={15} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Description *</label>
              <input required className="input-field" placeholder="Monthly Rent" value={form.description} onChange={f('description')} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Category</label>
              <select className="input-field" value={form.category} onChange={f('category')}>
                {categories.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Amount (LKR) *</label>
              <input required type="number" min="0" className="input-field" placeholder="5000" value={form.amount} onChange={f('amount')} />
            </div>
            <div className="col-span-2">
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
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}Add Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ExpensesPage() {
  const searchParams = useSearchParams()
  const [search, setSearch]   = useState('')
  const [category, setCategory] = useState('All')
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    const action = searchParams.get('action')
    if (action === 'add' || action === 'add-expense' || searchParams.get('new') === '1') setShowAdd(true)
  }, [searchParams])

  const txParams: Record<string, string> = { type: 'EXPENSE' }
  if (category !== 'All') txParams.category = category

  const { data, loading, refetch }  = useTransactions(txParams)
  const { data: summaryData }       = useFinanceSummary()
  const summary                     = summaryData as any

  const allExpenses: any[] = (data?.data ?? []) as any[]

  const filtered = useMemo(() => search
    ? allExpenses.filter((e: any) =>
        e.description?.toLowerCase().includes(search.toLowerCase()) ||
        e.category?.toLowerCase().includes(search.toLowerCase())
      )
    : allExpenses
  , [allExpenses, search])

  const totalExpenses = summary?.totalExpense ?? allExpenses.reduce((s: number, e: any) => s + (e.amount ?? 0), 0)
  const totalIncome   = summary?.totalIncome  ?? 0

  const categoryTotals = useMemo(() =>
    categories.filter(c => c !== 'All').map(c => ({
      cat: c,
      total: allExpenses.filter((e: any) => e.category === c).reduce((s: number, e: any) => s + (e.amount ?? 0), 0),
      color: CAT_COLORS[c] ?? '#475569',
    })).filter(c => c.total > 0).sort((a, b) => b.total - a.total)
  , [allExpenses])

  const pieData = categoryTotals.map((c, i) => ({ name: c.cat, value: c.total, fill: CHART_COLORS[i % CHART_COLORS.length] }))

  return (
    <div className="space-y-6">
      {showAdd && <AddExpenseModal onClose={() => setShowAdd(false)} onSaved={refetch} />}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">Track and manage all business expenses</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 sm:ml-auto">
          <Plus size={14} />Add Expense
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Expenses', value: formatCurrency(totalExpenses), icon: <TrendingDown size={16} />, color: '#b91c1c', bg: 'rgba(185,28,28,0.08)', border: 'rgba(185,28,28,0.20)' },
          { label: 'Largest Category', value: categoryTotals[0]?.cat ?? '—', icon: <Tag size={16} />, color: '#c2410c', bg: 'rgba(194,65,12,0.08)', border: 'rgba(194,65,12,0.20)' },
          { label: 'Total Records', value: String(allExpenses.length), icon: <Receipt size={16} />, color: '#6d28d9', bg: 'rgba(109,40,217,0.08)', border: 'rgba(109,40,217,0.20)' },
          { label: 'Net Profit', value: formatCurrency(totalIncome - totalExpenses), icon: <ArrowDownRight size={16} />, color: totalIncome - totalExpenses >= 0 ? '#15803d' : '#b91c1c', bg: totalIncome - totalExpenses >= 0 ? 'rgba(21,128,61,0.08)' : 'rgba(185,28,28,0.08)', border: totalIncome - totalExpenses >= 0 ? 'rgba(21,128,61,0.20)' : 'rgba(185,28,28,0.20)' },
        ].map(({ label, value, icon, color, bg, border }) => (
          <div key={label} className="card p-4" style={{ borderColor: border, background: bg }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color, background: bg, border: `1px solid ${border}` }}>{icon}</div>
            </div>
            <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* ── Category Breakdown ── */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>By Category</h3>
          {categoryTotals.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>No expense data yet</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={38} outerRadius={58} dataKey="value" strokeWidth={0}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-2">
                {categoryTotals.map((c, i) => (
                  <div key={c.cat}>
                    <div className="flex justify-between text-xs mb-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{c.cat}</span>
                      </div>
                      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(c.total)}</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
                      <div className="h-full rounded-full" style={{ width: `${totalExpenses > 0 ? (c.total / totalExpenses) * 100 : 0}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Expense List ── */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <ToolbarSearch
              value={search}
              onChange={setSearch}
              placeholder="Search expenses…"
              className="flex-1"
            />
            <div className="flex gap-1.5 overflow-x-auto flex-wrap">
              {categories.map(c => (
                <button key={c} onClick={() => setCategory(c)}
                  className="px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors"
                  style={category === c
                    ? { background: '#6d28d9', color: '#fff', border: '1px solid #6d28d9' }
                    : { background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="card overflow-hidden">
            {loading ? (
              <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-violet-400" size={22} /></div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center">
                <Receipt size={28} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No expenses found</p>
              </div>
            ) : (
              <div>
                {filtered.map((e: any) => (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/2"
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: `${CAT_COLORS[e.category] ?? '#475569'}15`,
                        border: `1px solid ${CAT_COLORS[e.category] ?? '#475569'}35`,
                        color: CAT_COLORS[e.category] ?? '#475569',
                      }}>
                      <Receipt size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{e.description}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: `${CAT_COLORS[e.category] ?? '#475569'}15`, color: CAT_COLORS[e.category] ?? '#475569', border: `1px solid ${CAT_COLORS[e.category] ?? '#475569'}30` }}>
                          {e.category}
                        </span>
                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{formatDate(e.createdAt)}</span>
                        <span className="text-[11px] flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                          <CreditCard size={9} />{e.paymentMethod?.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <span className="text-sm font-bold flex-shrink-0" style={{ color: '#b91c1c' }}>−{formatCurrency(e.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
