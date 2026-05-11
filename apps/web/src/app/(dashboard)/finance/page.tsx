'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, Download, Plus, ArrowUpRight, ArrowDownRight, SlidersHorizontal, Loader2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useTransactions, useRevenue, useFinanceSummary } from '@/lib/hooks'
import { financeApi } from '@/lib/api'
import toast from 'react-hot-toast'
import type { Transaction as AppTransaction } from '@/types'

const COLORS = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ef4444']

function AddTransactionModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ type: 'EXPENSE', category: 'Misc', amount: '', description: '', paymentMethod: 'CASH' })
  const [loading, setLoading] = useState(false)
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }))
  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setLoading(true)
    try {
      await financeApi.create({ ...form, amount: parseFloat(form.amount) })
      toast.success('Transaction recorded')
      onSaved(); onClose()
    } catch (err: any) { toast.error(err?.message ?? 'Failed') } finally { setLoading(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h3 className="text-base font-semibold text-white">Add Transaction</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><TrendingDown size={14} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Type</label>
              <select className="input-field" value={form.type} onChange={f('type')}>
                <option value="INCOME">Income</option>
                <option value="EXPENSE">Expense</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Amount (₹) *</label>
              <input required type="number" min="0" className="input-field" placeholder="5000" value={form.amount} onChange={f('amount')} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Description *</label>
              <input required className="input-field" placeholder="e.g. Monthly rent" value={form.description} onChange={f('description')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Category</label>
              <input className="input-field" placeholder="Rent, Sales, Repair..." value={form.category} onChange={f('category')} />
            </div>
            <div>
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
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function FinancePage() {
  const [tab, setTab] = useState<'overview' | 'transactions' | 'reports'>('overview')
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const { data: txData, loading: txLoading, refetch: refetchTx } = useTransactions()
  const { data: rawRevenue } = useRevenue()
  const { data: summaryData, refetch: refetchSummary } = useFinanceSummary()
  const transactions: AppTransaction[] = (txData?.data ?? []) as AppTransaction[]
  const revenueArr: any[] = Array.isArray(rawRevenue) ? rawRevenue : []
  const summary = summaryData as any

  const income  = summary?.totalIncome  ?? 0
  const expense = summary?.totalExpense ?? 0

  const monthlyData = revenueArr.slice(-6).map((d: any) => ({
    month:   new Date(d.date).toLocaleDateString('en-IN', { month: 'short' }),
    income:  Math.round((d.totalRevenue  ?? 0) / 1000),
    expense: Math.round((d.totalExpenses ?? 0) / 1000),
    profit:  Math.round((d.profit        ?? 0) / 1000),
  }))

  const categoryMap: Record<string, number> = {}
  transactions.filter((t: AppTransaction) => t.type === 'INCOME').forEach((t: AppTransaction) => {
    categoryMap[t.category] = (categoryMap[t.category] ?? 0) + t.amount
  })
  const pieCategories = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }))

  const filtered = transactions.filter((t: AppTransaction) =>
    t.description.toLowerCase().includes(search.toLowerCase())
  )

  const handleSaved = () => { refetchTx(); refetchSummary() }

  const now = new Date()
  const periodLabel = `${now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} · All Branches`

  return (
    <div className="space-y-6">
      {showAdd && <AddTransactionModal onClose={() => setShowAdd(false)} onSaved={handleSaved} />}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Finance & Accounting</h1>
          <p className="page-subtitle">{periodLabel}</p>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <button className="btn-secondary text-sm flex items-center gap-2">
            <Download size={14} />Export
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-primary text-sm flex items-center gap-2">
            <Plus size={14} />Add Transaction
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 border-green-500/20 bg-green-500/5">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpRight size={16} className="text-green-400" />
            <span className="text-sm text-green-300 font-semibold">Total Income</span>
          </div>
          <p className="text-3xl font-bold text-white">{formatCurrency(income)}</p>
          <p className="text-xs text-slate-500 mt-1">Total income recorded</p>
        </div>
        <div className="card p-5 border-red-500/20 bg-red-500/5">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDownRight size={16} className="text-red-400" />
            <span className="text-sm text-red-300 font-semibold">Total Expenses</span>
          </div>
          <p className="text-3xl font-bold text-white">{formatCurrency(expense)}</p>
          <p className="text-xs text-slate-500 mt-1">Total expenses recorded</p>
        </div>
        <div className="card p-5 border-violet-500/20 bg-violet-500/5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-violet-400" />
            <span className="text-sm text-violet-300 font-semibold">Net Profit</span>
          </div>
          <p className="text-3xl font-bold text-white">{formatCurrency(income - expense)}</p>
          <p className="text-xs text-slate-500 mt-1">Margin: {income > 0 ? Math.round(((income - expense) / income) * 100) : 0}%</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/3 p-1 rounded-xl w-fit">
        {[['overview', 'Overview'], ['transactions', 'Transactions'], ['reports', 'Reports']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key as 'overview' | 'transactions' | 'reports')}
            className={`px-4 py-1.5 text-xs rounded-lg transition-colors ${tab === key ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Monthly Chart */}
          <div className="lg:col-span-2 card p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Monthly Income vs Expense (₹k)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData} barSize={20} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f1623', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }} />
                <Bar dataKey="income" fill="#7c3aed" name="Income" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="#ef4444" name="Expense" radius={[4, 4, 0, 0]} opacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue Breakdown */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Income by Category</h3>
            {pieCategories.length === 0 ? (
              <div className="h-[120px] flex items-center justify-center text-slate-600 text-xs">No income data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={pieCategories} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" strokeWidth={0}>
                    {pieCategories.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="mt-3 space-y-2">
              {pieCategories.map((cat, i) => (
                <div key={cat.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i] }} />
                    <span className="text-xs text-slate-400">{cat.name}</span>
                  </div>
                  <span className="text-xs font-medium text-slate-300">{formatCurrency(cat.value)}</span>
                </div>
              ))}
              {pieCategories.length === 0 && (
                <p className="text-xs text-slate-600 text-center">Add income transactions to see breakdown</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'transactions' && (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <input
              type="text"
              placeholder="Search transactions..."
              className="input-field pl-4"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="table-header">Description</th>
                    <th className="table-header">Category</th>
                    <th className="table-header">Date</th>
                    <th className="table-header text-center">Method</th>
                    <th className="table-header text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/3">
                  {filtered.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/2 transition-colors">
                      <td className="table-cell">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${tx.type === 'INCOME' ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                            {tx.type === 'INCOME' ? <TrendingUp size={12} className="text-green-400" /> : <TrendingDown size={12} className="text-red-400" />}
                          </div>
                          <span className="text-sm text-slate-200">{tx.description}</span>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className="text-xs text-slate-500">{tx.category}</span>
                      </td>
                      <td className="table-cell">
                        <span className="text-xs text-slate-400">{formatDate(tx.createdAt)}</span>
                      </td>
                      <td className="table-cell text-center">
                        <span className="text-xs text-slate-500 bg-white/5 px-2 py-0.5 rounded">{tx.paymentMethod}</span>
                      </td>
                      <td className="table-cell text-right">
                        <span className={`text-sm font-bold ${tx.type === 'INCOME' ? 'text-green-400' : 'text-red-400'}`}>
                          {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'reports' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { title: 'P&L Statement', desc: 'Profit & Loss for current period', icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
            { title: 'Balance Sheet', desc: 'Assets, liabilities & equity', icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
            { title: 'Cash Flow', desc: 'Inflow & outflow summary', icon: ArrowUpRight, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
            { title: 'GST Report', desc: 'Tax collected & payable', icon: Download, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
            { title: 'Sales Report', desc: 'Detailed sales breakdown', icon: TrendingUp, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
            { title: 'Expense Report', desc: 'All expenses by category', icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
          ].map(report => (
            <button key={report.title} className={`card p-5 text-left hover:border-white/20 transition-all border ${report.bg}`}>
              <div className="flex items-center gap-3 mb-2">
                <report.icon size={18} className={report.color} />
                <h3 className="text-sm font-semibold text-slate-200">{report.title}</h3>
              </div>
              <p className="text-xs text-slate-500">{report.desc}</p>
              <div className="flex items-center gap-1.5 mt-3 text-xs text-violet-400">
                <Download size={11} />
                Download PDF / Excel
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
