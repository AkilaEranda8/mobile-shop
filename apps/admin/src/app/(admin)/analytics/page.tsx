'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp, FileText, Wrench, Users, RefreshCw,
  ShoppingCart, Building2, AlertCircle, BarChart3,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  fetchAnalytics, fetchMrrChart,
  type AnalyticsData, type MrrPoint,
} from '@/lib/api'

/* ── helpers ─────────────────────────────────────────────────── */
function fmt(n: number) {
  if (n >= 10000000) return `Rs.${(n / 10000000).toFixed(1)}Cr`
  if (n >= 100000)   return `Rs.${(n / 100000).toFixed(1)}L`
  if (n >= 1000)     return `Rs.${(n / 1000).toFixed(1)}K`
  return `Rs.${n}`
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: '2-digit' })
}

const PLAN_COLOR: Record<string, string> = {
  STARTER:    '#6366f1',
  PRO:        '#3b82f6',
  ENTERPRISE: '#111827',
}
const PLAN_BADGE: Record<string, string> = {
  STARTER:    'badge-gray',
  PRO:        'badge-blue',
  ENTERPRISE: 'badge-purple',
}
const STATUS_BADGE: Record<string, string> = {
  ACTIVE:    'badge-green',
  TRIAL:     'badge-yellow',
  SUSPENDED: 'badge-red',
}

const TABS = ['Overview', 'Tenants', 'Revenue', 'Activity'] as const
type Tab = typeof TABS[number]

/* ── Tooltip ──────────────────────────────────────────────────── */
function ChartTooltip({ active, payload, label, prefix = '' }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-bold text-gray-900">{prefix}{typeof p.value === 'number' && p.value > 1000 ? fmt(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────── */
export default function AnalyticsPage() {
  const [tab, setTab]         = useState<Tab>('Overview')
  const [d, setD]             = useState<AnalyticsData | null>(null)
  const [mrr, setMrr]         = useState<MrrPoint[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([fetchAnalytics(), fetchMrrChart()])
      .then(([a, m]) => { setD(a); setMrr(m) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  /* plan distribution bars */
  const planData = (d?.tenantsByPlan ?? []).map(r => ({
    plan: r.plan,
    tenants: r._count,
    mrr: r._sum.mrr ?? 0,
  }))

  /* top tenants by invoices */
  const topByInvoice = [...(d?.topTenantsByRevenue ?? [])]
    .sort((a, b) => b._count.sales - a._count.sales)
    .slice(0, 8)

  const topByMrr = [...(d?.topTenantsByRevenue ?? [])].slice(0, 8)

  const totalMrr = (d?.topTenantsByRevenue ?? []).reduce((s, t) => s + (t.mrr ?? 0), 0)

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="page-title">Platform Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? 'Loading…' : `${d?.activeTenantsCount ?? 0} active tenants · ${(d?.totalInvoices ?? 0).toLocaleString()} invoices · GMV ${fmt(d?.totalGMV ?? 0)}`}
          </p>
        </div>
        <div className="sm:ml-auto flex gap-2">
          <button onClick={load} disabled={loading} className="btn-secondary text-sm">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: 'Total GMV',         value: fmt(d?.totalGMV ?? 0),                         icon: TrendingUp,  color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'Total Invoices',    value: (d?.totalInvoices ?? 0).toLocaleString(),       icon: FileText,    color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-100'    },
          { label: 'Total Repairs',     value: (d?.totalRepairs ?? 0).toLocaleString(),        icon: Wrench,      color: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-100'  },
          { label: 'Total Customers',   value: (d?.totalCustomers ?? 0).toLocaleString(),      icon: Users,       color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100'   },
          { label: 'Active Tenants',    value: (d?.activeTenantsCount ?? 0).toLocaleString(),  icon: Building2,   color: 'text-sky-600',     bg: 'bg-sky-50',     border: 'border-sky-100'     },
          { label: 'New (30d)',          value: (d?.newTenantsThisMonth ?? 0).toLocaleString(), icon: BarChart3,   color: 'text-pink-600',    bg: 'bg-pink-50',    border: 'border-pink-100'    },
        ].map(k => (
          <div key={k.label} className={`card p-4 flex items-center gap-3 border ${k.border}`}>
            <div className={`w-9 h-9 rounded-xl ${k.bg} flex items-center justify-center flex-shrink-0`}>
              <k.icon size={15} className={k.color} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide truncate">{k.label}</p>
              <p className="text-lg font-bold text-gray-900 leading-none mt-0.5">{loading ? '—' : k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ─────────────────────────────────────────── */}
      {tab === 'Overview' && (
        <div className="space-y-5">
          {/* MRR + GMV charts side by side */}
          <div className="grid xl:grid-cols-2 gap-5">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="section-title !mb-0">Platform MRR Growth</h3>
                <span className="text-xs text-gray-400">12 months</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={mrr}>
                  <defs>
                    <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#111827" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#111827" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                    tickFormatter={v => `Rs.${(v / 1000).toFixed(0)}K`} width={55} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="mrr" name="MRR" stroke="#111827" strokeWidth={2.5}
                    fill="url(#mrrGrad)" dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="section-title !mb-0">Monthly GMV</h3>
                <span className="text-xs text-gray-400">12 months</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={d?.gmvMonths ?? []} barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                    tickFormatter={v => fmt(v)} width={55} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="gmv" name="GMV" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Plan distribution + inactive tenants */}
          <div className="grid xl:grid-cols-3 gap-5">
            <div className="card p-5">
              <h3 className="section-title">Plan Distribution</h3>
              <div className="space-y-3 mt-2">
                {planData.map(p => {
                  const totalT = planData.reduce((s, x) => s + x.tenants, 0) || 1
                  const pct = Math.round((p.tenants / totalT) * 100)
                  return (
                    <div key={p.plan}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700">{p.plan}</span>
                        <span className="text-gray-500">{p.tenants} tenants · {fmt(p.mrr)}/mo</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: PLAN_COLOR[p.plan] ?? '#6b7280' }} />
                      </div>
                    </div>
                  )
                })}
                {planData.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No data</p>}
              </div>
            </div>

            <div className="xl:col-span-2 card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <h3 className="section-title !mb-0">Inactive Tenants (no sales 7d)</h3>
                <span className="text-xs font-semibold text-amber-600">{d?.inactiveTenants?.length ?? 0} tenants</span>
              </div>
              {(d?.inactiveTenants?.length ?? 0) === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-emerald-600 font-medium">
                  🎉 All active tenants had sales in the last 7 days
                </div>
              ) : (
                <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                  {d!.inactiveTenants.map(t => (
                    <div key={t.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50">
                      <div className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-600 flex-shrink-0">
                        {t.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{t.name}</p>
                        <p className="text-[10px] text-gray-400">{fmtDate(t.createdAt)}</p>
                      </div>
                      <span className={PLAN_BADGE[t.plan] ?? 'badge-gray'}>{t.plan}</span>
                      <span className={STATUS_BADGE[t.status] ?? 'badge-gray'}>{t.status}</span>
                      <span className="text-xs font-semibold text-gray-700 w-16 text-right">Rs.{(t.mrr ?? 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TENANTS ──────────────────────────────────────────── */}
      {tab === 'Tenants' && (
        <div className="space-y-5">
          {/* New tenants trend */}
          <div className="grid xl:grid-cols-2 gap-5">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="section-title !mb-0">New Tenants per Month</h3>
                <span className="text-xs text-gray-400">12 months</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={d?.tenantMonths ?? []} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="newTenants" name="New Tenants" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="section-title !mb-0">Cumulative Tenant Growth</h3>
                <span className="text-xs text-gray-400">12 months</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={d?.tenantMonths ?? []}>
                  <defs>
                    <linearGradient id="cumulGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="cumulative" name="Total Tenants" stroke="#6366f1" strokeWidth={2.5}
                    fill="url(#cumulGrad)" dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top tenants table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
              <h3 className="section-title !mb-0">Top Tenants by Sales Volume</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="th w-6">#</th>
                  <th className="th">Tenant</th>
                  <th className="th">Plan</th>
                  <th className="th text-right">Sales</th>
                  <th className="th text-right">Users</th>
                  <th className="th text-right">MRR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {topByInvoice.length === 0 && (
                  <tr><td colSpan={6} className="td text-center text-gray-400 py-8">No data</td></tr>
                )}
                {topByInvoice.map((t, i) => (
                  <tr key={t.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="td text-xs text-gray-400 font-mono">{i + 1}</td>
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-600 flex-shrink-0">
                          {t.name.charAt(0)}
                        </div>
                        <span className="text-xs font-semibold text-gray-900">{t.name}</span>
                      </div>
                    </td>
                    <td className="td"><span className={PLAN_BADGE[t.plan] ?? 'badge-gray'}>{t.plan}</span></td>
                    <td className="td text-right text-xs font-bold text-gray-900">{t._count.sales.toLocaleString()}</td>
                    <td className="td text-right text-xs text-gray-600">{t._count.users}</td>
                    <td className="td text-right text-xs font-semibold text-gray-900">Rs.{(t.mrr ?? 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── REVENUE ──────────────────────────────────────────── */}
      {tab === 'Revenue' && (
        <div className="space-y-5">
          {/* GMV + invoices dual axis */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title !mb-0">GMV & Invoice Count — 12 months</h3>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={d?.gmvMonths ?? []} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                  tickFormatter={v => fmt(v)} width={60} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="gmv" name="GMV" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="invoices" name="Invoices" fill="#a5b4fc" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top by MRR + plan revenue */}
          <div className="grid xl:grid-cols-2 gap-5">
            <div className="card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
                <h3 className="section-title !mb-0">Top Tenants by MRR</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {topByMrr.map((t, i) => {
                  const pct = totalMrr > 0 ? Math.round(((t.mrr ?? 0) / totalMrr) * 100) : 0
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/70">
                      <span className="text-xs text-gray-400 font-mono w-4">{i + 1}</span>
                      <div className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-600 flex-shrink-0">
                        {t.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">{t.name}</p>
                        <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden w-full">
                          <div className="h-full rounded-full bg-gray-800" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <span className={PLAN_BADGE[t.plan] ?? 'badge-gray'}>{t.plan}</span>
                      <span className="text-sm font-bold text-gray-900 w-20 text-right">Rs.{(t.mrr ?? 0).toLocaleString()}</span>
                    </div>
                  )
                })}
                {topByMrr.length === 0 && <p className="px-5 py-8 text-sm text-center text-gray-400">No data</p>}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="section-title">Revenue by Plan</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={planData} layout="vertical" barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                  <YAxis type="category" dataKey="plan" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="mrr" name="MRR" radius={[0, 4, 4, 0]}
                    fill="#3b82f6"
                  />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {planData.map(p => (
                  <div key={p.plan} className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-sm font-bold text-gray-900">{fmt(p.mrr)}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{p.plan} · {p.tenants} tenants</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ACTIVITY ─────────────────────────────────────────── */}
      {tab === 'Activity' && (
        <div className="space-y-5">
          {/* Invoices per month line */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title !mb-0">Invoice Activity — 12 months</h3>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={d?.gmvMonths ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="invoices" name="Invoices" stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Inactive tenants full table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 bg-amber-50 flex items-center gap-2">
              <AlertCircle size={14} className="text-amber-600 flex-shrink-0" />
              <h3 className="text-sm font-semibold text-amber-800">Inactive Tenants — No sales in last 7 days</h3>
              <span className="ml-auto text-xs font-bold text-amber-700">{d?.inactiveTenants?.length ?? 0}</span>
            </div>
            {(d?.inactiveTenants?.length ?? 0) === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-emerald-600 font-medium">
                All active tenants had sales in the last 7 days
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="th">Tenant</th>
                    <th className="th">Plan</th>
                    <th className="th">Status</th>
                    <th className="th text-right">MRR</th>
                    <th className="th">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {d!.inactiveTenants.map(t => (
                    <tr key={t.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="td">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-600 flex-shrink-0">
                            {t.name.charAt(0)}
                          </div>
                          <span className="text-xs font-semibold text-gray-900">{t.name}</span>
                        </div>
                      </td>
                      <td className="td"><span className={PLAN_BADGE[t.plan] ?? 'badge-gray'}>{t.plan}</span></td>
                      <td className="td"><span className={STATUS_BADGE[t.status] ?? 'badge-gray'}>{t.status}</span></td>
                      <td className="td text-right text-xs font-semibold text-gray-900">Rs.{(t.mrr ?? 0).toLocaleString()}</td>
                      <td className="td text-xs text-gray-500">{fmtDate(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
