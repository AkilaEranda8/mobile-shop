'use client'

import { useState } from 'react'
import { Receipt, Plus, Search, X, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useTransactions, useFinanceSummary } from '@/lib/hooks'
import { financeApi } from '@/lib/api'
import toast from 'react-hot-toast'

const categories = ['All', 'Rent', 'Salary', 'Utilities', 'Marketing', 'Inventory', 'Repairs', 'Misc']

const categoryColors: Record<string, string> = {
  Rent:      'text-red-400 bg-red-500/10 border-red-500/20',
  Salary:    'text-violet-400 bg-violet-500/10 border-violet-500/20',
  Utilities: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  Marketing: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  Inventory: 'text-green-400 bg-green-500/10 border-green-500/20',
  Repairs:   'text-orange-400 bg-orange-500/10 border-orange-500/20',
  Misc:      'text-slate-400 bg-slate-500/10 border-slate-500/20',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h3 className="text-base font-semibold text-white">Add Expense</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Description *</label>
              <input required className="input-field" placeholder="Monthly Rent" value={form.description} onChange={f('description')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Category</label>
              <select className="input-field" value={form.category} onChange={f('category')}>
                {categories.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Amount (₹) *</label>
              <input required type="number" min="0" className="input-field" placeholder="5000" value={form.amount} onChange={f('amount')} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Payment Method</label>
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
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [showAdd, setShowAdd] = useState(false)

  const txParams: Record<string, string> = { type: 'EXPENSE' }
  if (category !== 'All') txParams.category = category

  const { data, loading, refetch } = useTransactions(txParams)
  const { data: summaryData } = useFinanceSummary()
  const summary = summaryData as any

  const allExpenses: any[] = (data?.data ?? []) as any[]
  const filtered = search
    ? allExpenses.filter((e: any) =>
        e.description?.toLowerCase().includes(search.toLowerCase()) ||
        e.category?.toLowerCase().includes(search.toLowerCase())
      )
    : allExpenses

  const totalExpenses = summary?.totalExpense ?? allExpenses.reduce((s: number, e: any) => s + (e.amount ?? 0), 0)
  const totalIncome = summary?.totalIncome ?? 0

  const categoryTotals = categories.filter(c => c !== 'All').map(c => ({
    cat: c,
    total: allExpenses.filter((e: any) => e.category === c).reduce((s: number, e: any) => s + (e.amount ?? 0), 0),
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total)

  return (
    <div className="space-y-6">
      {showAdd && <AddExpenseModal onClose={() => setShowAdd(false)} onSaved={refetch} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">Track and manage all business expenses</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-sm flex items-center gap-2 sm:ml-auto">
          <Plus size={14} />Add Expense
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 border-red-500/20 bg-red-500/5">
          <p className="text-xs text-slate-500 mb-1">Total Expenses</p>
          <p className="text-xl font-bold text-red-400">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500 mb-1">Largest Category</p>
          <p className="text-xl font-bold text-white">{categoryTotals[0]?.cat ?? '—'}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500 mb-1">Total Entries</p>
          <p className="text-xl font-bold text-white">{allExpenses.length}</p>
        </div>
        <div className="card p-4 border-green-500/20 bg-green-500/5">
          <p className="text-xs text-slate-500 mb-1">Net Profit</p>
          <p className="text-xl font-bold text-green-400">{formatCurrency(totalIncome - totalExpenses)}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Category Breakdown */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">By Category</h3>
          <div className="space-y-3">
            {categoryTotals.map(c => (
              <div key={c.cat}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">{c.cat}</span>
                  <span className="text-slate-300 font-medium">{formatCurrency(c.total)}</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-red-500/60 to-orange-500/60 rounded-full" style={{ width: `${(c.total / totalExpenses) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Expense List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input className="input-field pl-9" placeholder="Search expenses..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {categories.map(c => (
                <button key={c} onClick={() => setCategory(c)}
                  className={`px-3 py-2 text-xs rounded-lg border whitespace-nowrap transition-colors ${category === c ? 'border-violet-500 bg-violet-500/15 text-violet-300' : 'border-white/10 text-slate-400 hover:border-white/20'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="divide-y divide-white/5">
              {loading && <div className="py-10 text-center text-sm text-slate-500">Loading...</div>}
              {!loading && filtered.map((e: any) => (
                <div key={e.id} className="flex items-center gap-4 p-4 hover:bg-white/2 transition-colors">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${categoryColors[e.category] ?? 'text-slate-400 bg-slate-500/10 border-slate-500/20'}`}>
                    <Receipt size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{e.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${categoryColors[e.category] ?? 'text-slate-400 bg-slate-500/10 border-slate-500/20'}`}>{e.category}</span>
                      <span className="text-xs text-slate-500">{new Date(e.createdAt).toLocaleDateString('en-IN')}</span>
                      <span className="text-xs text-slate-600">· {e.paymentMethod?.replace('_', ' ')}</span>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-red-400 flex-shrink-0">−{formatCurrency(e.amount)}</span>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="py-12 text-center">
                  <Receipt size={28} className="text-slate-700 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No expenses found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
