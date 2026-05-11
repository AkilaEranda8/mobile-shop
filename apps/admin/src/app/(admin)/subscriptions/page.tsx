'use client'

import { useState, useEffect } from 'react'
import { DollarSign, TrendingUp, Users, AlertTriangle, CreditCard, Send, Percent, XCircle, ArrowUpDown, ChevronDown, type LucideIcon } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { fetchSubscriptions, fetchStats, type SubscriptionRow, type PlatformStats } from '@/lib/api'

const PLAN_BADGE: Record<string, string> = {
  STARTER: 'badge-gray', PRO: 'badge-blue', ENTERPRISE: 'badge-purple',
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: '2-digit' })
}
function fmt(n: number) {
  if (n >= 100000) return `Rs.${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `Rs.${(n / 1000).toFixed(1)}K`
  return `Rs.${n}`
}

const plans = [
  { id: 'STARTER', name: 'Starter', price: 1199, desc: '3 users · 1 branch · Basic POS & Repairs', color: 'bg-gray-100', tenants: 112 },
  { id: 'PRO',     name: 'Pro',     price: 4799, desc: '10 users · 3 branches · Analytics + Warranty', color: 'bg-blue-50', tenants: 78 },
  { id: 'ENTERPRISE', name: 'Enterprise', price: 14399, desc: 'Unlimited · API access · White-label', color: 'bg-purple-50', tenants: 24 },
]

export default function SubscriptionsPage() {
  const [tab, setTab] = useState<'overview' | 'subscriptions' | 'plans' | 'overdue'>('overview')
  const [search, setSearch] = useState('')
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [subs, setSubs] = useState<SubscriptionRow[]>([])
  const [overdue, setOverdue] = useState<SubscriptionRow[]>([])
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchSubscriptions(),
      fetchSubscriptions('OVERDUE'),
      fetchStats(),
    ])
      .then(([all, ov, st]) => { setSubs(all.data); setOverdue(ov.data); setStats(st) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const mrr = stats?.mrr ?? 0
  const metrics: { label: string; value: string; sub: string; icon: LucideIcon; color: string; bg: string }[] = [
    { label: 'MRR', value: fmt(mrr), sub: stats ? `+${stats.mrrDelta}% vs last month` : '—', icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'ARR', value: fmt(mrr * 12), sub: 'Annualised', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'ARPU', value: fmt(Math.round(mrr / (stats?.activeTenants || 1))), sub: 'Per active tenant', icon: Users, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Churn MRR', value: fmt(Math.round(mrr * (stats?.churnRate ?? 0) / 100)), sub: `${stats?.churnRate ?? 0}% churn rate`, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
  ]

  const filtered = subs.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Subscriptions & Billing</h1>
          <p className="text-sm text-gray-500">{subs.length} active · {overdue.length} overdue</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowInvoiceModal(true)} className="btn-secondary text-sm">
            <CreditCard size={14} />Generate Invoice
          </button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {metrics.map(m => (
          <div key={m.label} className="stat-card flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl ${m.bg} flex items-center justify-center flex-shrink-0`}>
              <m.icon size={18} className={m.color} />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 mb-0.5">{m.label}</p>
              <p className="text-xl font-bold text-gray-900">{m.value}</p>
              <p className="text-[10px] text-gray-400">{m.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-0">
        {(['overview', 'subscriptions', 'plans', 'overdue'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'overdue' ? `Overdue (${overdue.length})` : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <h2 className="section-title">Revenue by Plan (Rs.k)</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[]} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => [fmt(v)]} />
                <Bar dataKey="Starter" fill="#9ca3af" stackId="a" name="Starter" />
                <Bar dataKey="Pro" fill="#374151" stackId="a" name="Pro" />
                <Bar dataKey="Enterprise" fill="#f59e0b" stackId="a" name="Enterprise" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-5">
            <h2 className="section-title">Revenue Metrics</h2>
            <div className="space-y-3">
              {[
                { label: 'Net Revenue Retention (NRR)', value: '108%', up: true },
                { label: 'MRR Growth Rate',             value: stats ? `+${stats.mrrDelta}%` : '—', up: true },
                { label: 'Avg Revenue Per User (ARPU)', value: stats ? fmt(Math.round(stats.mrr / (stats.activeTenants || 1))) : '—', up: true },
                { label: 'Churn Rate (Monthly)',        value: stats ? `${stats.churnRate}%` : '—', up: false },
                { label: 'Trial-to-Paid Conversion',   value: '68%', up: true },
                { label: 'Failed Payments (Month)',     value: '3', up: false },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-600">{r.label}</span>
                  <span className={`text-sm font-bold ${r.up ? 'text-emerald-600' : 'text-red-500'}`}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Subscriptions table */}
      {tab === 'subscriptions' && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
            <input className="input flex-1 max-w-xs" placeholder="Search shop..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="th">Shop</th>
                <th className="th">Plan</th>
                <th className="th">MRR</th>
                <th className="th">Status</th>
                <th className="th">Next Billing</th>
                <th className="th">Payment</th>
                <th className="th text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="td font-medium text-xs text-gray-900">{s.name}</td>
                  <td className="td"><span className={PLAN_BADGE[s.plan] ?? 'badge-gray'}>{s.plan}</span></td>
                  <td className="td font-semibold text-xs text-gray-800">{s.mrr != null ? `Rs.${s.mrr.toLocaleString()}` : '—'}</td>
                  <td className="td"><span className={s.status === 'ACTIVE' ? 'badge-green' : 'badge-red'}>{s.status}</span></td>
                  <td className="td text-xs text-gray-500">{s.subscriptionEndsAt ? fmtDate(s.subscriptionEndsAt) : '—'}</td>
                  <td className="td text-xs text-gray-500">—</td>
                  <td className="td">
                    <div className="flex items-center justify-center gap-1">
                      <button title="Send reminder" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Send size={13} />
                      </button>
                      <button title="Change plan" className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                        <ArrowUpDown size={13} />
                      </button>
                      <button title="Apply discount" className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                        <Percent size={13} />
                      </button>
                      <button title="Cancel" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <XCircle size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Plans management */}
      {tab === 'plans' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Manage plan features, limits, and pricing.</p>
          <div className="grid sm:grid-cols-3 gap-4">
            {plans.map(p => (
              <div key={p.id} className={`card p-5 ${p.color}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-900">{p.name}</h3>
                  <span className={PLAN_BADGE[p.id] ?? 'badge-gray'}>{p.id}</span>
                </div>
                <p className="text-3xl font-bold text-gray-900 mb-1">Rs.{p.price.toLocaleString()}<span className="text-sm font-normal text-gray-500">/mo</span></p>
                <p className="text-xs text-gray-500 mb-4">{p.desc}</p>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-4 pb-4 border-b border-white/60">
                  <span>Active tenants</span>
                  <span className="font-semibold text-gray-800">{p.tenants}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                  <span>Monthly revenue</span>
                  <span className="font-semibold text-gray-800">{fmt(p.price * p.tenants)}</span>
                </div>
                <button className="btn-secondary w-full text-xs justify-center">Edit Plan</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overdue */}
      {tab === 'overdue' && (
        <div className="space-y-4">
          {overdue.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">{loading ? 'Loading...' : 'No overdue subscriptions.'}</p>
          ) : (
            <div className="card overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 bg-red-50">
                <AlertTriangle size={15} className="text-red-500" />
                <p className="text-sm font-semibold text-red-700">{overdue.length} overdue subscriptions</p>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="th">Shop</th>
                    <th className="th">Plan</th>
                    <th className="th">MRR</th>
                    <th className="th">Overdue Since</th>
                    <th className="th">Days Overdue</th>
                    <th className="th text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {overdue.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="td font-medium text-xs text-gray-900">{s.name}</td>
                      <td className="td"><span className={PLAN_BADGE[s.plan] ?? 'badge-gray'}>{s.plan}</span></td>
                      <td className="td font-semibold text-xs text-gray-800">{s.mrr != null ? `Rs.${s.mrr.toLocaleString()}` : '—'}</td>
                      <td className="td text-xs text-gray-500">{s.subscriptionEndsAt ? fmtDate(s.subscriptionEndsAt) : '—'}</td>
                      <td className="td">
                        <span className="badge-red">Overdue</span>
                      </td>
                      <td className="td">
                        <div className="flex items-center justify-center gap-2">
                          <button className="btn-secondary text-xs py-1 px-2">
                            <Send size={11} />Remind
                          </button>
                          <button className="btn-secondary text-xs py-1 px-2">
                            <CreditCard size={11} />Retry
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Generate invoice modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Generate Invoice</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Select Tenant</label>
                <select className="input text-sm">
                  {subs.map(s => <option key={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Amount</label>
                <input className="input" placeholder="Rs.4,799" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Due Date</label>
                <input type="date" className="input" />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => setShowInvoiceModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => setShowInvoiceModal(false)} className="btn-primary">Generate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
