'use client'

import { useState } from 'react'
import { Receipt, Plus, Search, TrendingDown, Filter, X, Loader2, Tag, Calendar, DollarSign } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

const categories = ['All', 'Rent', 'Salary', 'Utilities', 'Marketing', 'Inventory', 'Repairs', 'Misc']

const mockExpenses = [
  { id: '1', title: 'Monthly Shop Rent', category: 'Rent', amount: 45000, date: '2024-05-01', paidBy: 'Owner', method: 'Bank Transfer', notes: 'Anna Nagar Branch' },
  { id: '2', title: 'Staff Salaries - April', category: 'Salary', amount: 85000, date: '2024-05-02', paidBy: 'Owner', method: 'Bank Transfer', notes: '4 staff members' },
  { id: '3', title: 'Electricity Bill', category: 'Utilities', amount: 4200, date: '2024-05-05', paidBy: 'Kavitha M', method: 'Cash', notes: 'May 2024' },
  { id: '4', title: 'Google Ads Campaign', category: 'Marketing', amount: 8500, date: '2024-05-07', paidBy: 'Owner', method: 'Credit Card', notes: 'iPhone 14 promo' },
  { id: '5', title: 'Soldering Station', category: 'Repairs', amount: 12000, date: '2024-05-08', paidBy: 'Rajan T', method: 'Cash', notes: 'Repair equipment' },
  { id: '6', title: 'Display Cases', category: 'Inventory', amount: 6800, date: '2024-05-09', paidBy: 'Owner', method: 'Bank Transfer', notes: 'New display racks' },
  { id: '7', title: 'Internet & WiFi', category: 'Utilities', amount: 1800, date: '2024-05-10', paidBy: 'Kavitha M', method: 'Cash', notes: 'Monthly bill' },
]

const categoryColors: Record<string, string> = {
  Rent: 'text-red-400 bg-red-500/10 border-red-500/20',
  Salary: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  Utilities: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  Marketing: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  Inventory: 'text-green-400 bg-green-500/10 border-green-500/20',
  Repairs: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  Misc: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
}

function AddExpenseModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ title: '', category: 'Misc', amount: '', date: new Date().toISOString().split('T')[0], paidBy: '', method: 'Cash', notes: '' })
  const [loading, setLoading] = useState(false)
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    await new Promise(r => setTimeout(r, 600)); setLoading(false); onClose()
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
              <label className="block text-xs text-slate-400 mb-1.5">Expense Title *</label>
              <input required className="input-field" placeholder="Monthly Rent" value={form.title} onChange={f('title')} />
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
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Date</label>
              <input type="date" className="input-field" value={form.date} onChange={f('date')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Payment Method</label>
              <select className="input-field" value={form.method} onChange={f('method')}>
                <option>Cash</option>
                <option>Bank Transfer</option>
                <option>Credit Card</option>
                <option>UPI</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Paid By</label>
              <input className="input-field" placeholder="Staff name or self" value={form.paidBy} onChange={f('paidBy')} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Notes</label>
              <textarea className="input-field min-h-[60px] resize-none" placeholder="Additional details..." value={form.notes} onChange={f('notes')} />
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

  const filtered = mockExpenses.filter(e => {
    const q = search.toLowerCase()
    return (
      (e.title.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)) &&
      (category === 'All' || e.category === category)
    )
  })

  const totalExpenses = mockExpenses.reduce((s, e) => s + e.amount, 0)
  const categoryTotals = categories.filter(c => c !== 'All').map(c => ({
    cat: c,
    total: mockExpenses.filter(e => e.category === c).reduce((s, e) => s + e.amount, 0),
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total)

  return (
    <div className="space-y-6">
      {showAdd && <AddExpenseModal onClose={() => setShowAdd(false)} />}

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
          <p className="text-xs text-slate-500 mb-1">Total This Month</p>
          <p className="text-xl font-bold text-red-400">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500 mb-1">Largest Category</p>
          <p className="text-xl font-bold text-white">{categoryTotals[0]?.cat ?? '—'}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500 mb-1">Total Entries</p>
          <p className="text-xl font-bold text-white">{mockExpenses.length}</p>
        </div>
        <div className="card p-4 border-green-500/20 bg-green-500/5">
          <p className="text-xs text-slate-500 mb-1">Net Profit Est.</p>
          <p className="text-xl font-bold text-green-400">{formatCurrency(634000 - totalExpenses)}</p>
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
              {filtered.map(e => (
                <div key={e.id} className="flex items-center gap-4 p-4 hover:bg-white/2 transition-colors">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${categoryColors[e.category] ?? 'text-slate-400 bg-slate-500/10 border-slate-500/20'}`}>
                    <Receipt size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{e.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${categoryColors[e.category]}`}>{e.category}</span>
                      <span className="text-xs text-slate-500">{e.date}</span>
                      <span className="text-xs text-slate-600">· {e.method}</span>
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
