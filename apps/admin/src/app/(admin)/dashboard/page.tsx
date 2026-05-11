'use client'

import { useState, useEffect } from 'react'
import {
  TrendingUp, TrendingDown, Users, Building2, Clock, DollarSign,
  ArrowUpRight, ArrowDownRight, AlertTriangle, RefreshCw
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { fetchStats, fetchTenants, fetchMrrChart, type PlatformStats, type TenantRow, type MrrPoint } from '@/lib/api'

function fmt(n: number) {
  if (n >= 100000) return `Rs.${(n / 100000).toFixed(1)}L`
  if (n >= 1000)   return `Rs.${(n / 1000).toFixed(1)}K`
  return `Rs.${n}`
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: '2-digit' })
}
function fmtTime(s: string) {
  return new Date(s).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit', hour12: true })
}

const SEVERITY_BADGE: Record<string, string> = {
  INFO:     'badge-blue',
  WARN:     'badge-yellow',
  ERROR:    'badge-red',
  CRITICAL: 'bg-red-100 text-red-800 ring-1 ring-red-300 badge',
}
const STATUS_BADGE: Record<string, string> = {
  ACTIVE:    'badge-green',
  TRIAL:     'badge-blue',
  SUSPENDED: 'badge-yellow',
  CANCELLED: 'badge-gray',
}
const PLAN_BADGE: Record<string, string> = {
  STARTER:    'badge-gray',
  PRO:        'badge-blue',
  ENTERPRISE: 'badge-purple',
}

function Skeleton({ h = 'h-8', w = 'w-full' }: { h?: string; w?: string }) {
  return <div className={`${h} ${w} bg-gray-100 rounded-lg animate-pulse`} />
}

export default function DashboardPage() {
  const [s, setS] = useState<PlatformStats | null>(null)
  const [mrrChart, setMrrChart] = useState<MrrPoint[] | null>(null)
  const [tenants, setTenants] = useState<TenantRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchStats(),
      fetchMrrChart(),
      fetchTenants({ limit: '20' }),
    ])
      .then(([stats, chart, tRes]) => {
        setS(stats)
        setMrrChart(chart)
        setTenants(tRes.data)
      })
      .catch(e => setError(e.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  const recentTenants = tenants
    ? [...tenants].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6)
    : []
  const trialExpiring = tenants
    ? tenants.filter(t => t.status === 'TRIAL' && t.trialEndsAt)
        .sort((a, b) => new Date(a.trialEndsAt!).getTime() - new Date(b.trialEndsAt!).getTime())
    : []

  const statCards = s ? [
    { label: 'Monthly Recurring Revenue', value: fmt(s.mrr), delta: `+${s.mrrDelta}%`, up: true, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Active Tenants', value: s.activeTenants.toString(), delta: `+${s.newTenantsThisMonth} this month`, up: true, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Trial Accounts', value: s.trialTenants.toString(), delta: 'active trials', up: false, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Total Platform Users', value: s.totalUsers.toLocaleString(), delta: 'across all tenants', up: true, icon: Users, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'New Tenants (Month)', value: s.newTenantsThisMonth.toString(), delta: 'joined this month', up: true, icon: TrendingUp, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { label: 'Churn Rate', value: `${s.churnRate}%`, delta: 'monthly churn', up: s.churnRate < 3, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
  ] : []

  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
      <AlertTriangle size={32} className="text-amber-400" />
      <p className="text-sm font-medium text-gray-700">Could not load dashboard</p>
      <p className="text-xs text-gray-400">{error}</p>
      <button onClick={() => window.location.reload()} className="btn-secondary text-xs mt-1">
        <RefreshCw size={13} />Retry
      </button>
    </div>
  )

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="stat-card space-y-2"><Skeleton h="h-4" w="w-1/2" /><Skeleton h="h-8" /><Skeleton h="h-3" w="w-2/3" /></div>
        )) : statCards.map(c => (
          <div key={c.label} className="stat-card flex items-start gap-4">
            <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center flex-shrink-0`}>
              <c.icon size={18} className={c.color} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 mb-0.5">{c.label}</p>
              <p className="text-2xl font-bold text-gray-900">{c.value}</p>
              <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${c.up ? 'text-emerald-600' : 'text-red-500'}`}>
                {c.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {c.delta}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* MRR Line Chart */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title !mb-0">MRR Trend (12 months)</h2>
            <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">+55.6% YTD</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={mrrChart ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                tickFormatter={v => `Rs.${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number) => [fmt(v), 'MRR']} />
              <Line type="monotone" dataKey="mrr" stroke="#111827" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Plan distribution donut */}
        <div className="card p-5">
          <h2 className="section-title">Plan Distribution</h2>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
                <Tooltip formatter={(v: number, n: string) => [v, n]} />
            </PieChart>
          </ResponsiveContainer>
          {loading && <Skeleton h="h-20" />}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* New tenants bar chart */}
        <div className="card p-5">
          <h2 className="section-title">New Tenants Per Month</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={[]} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#111827" radius={[3, 3, 0, 0]} name="Tenants" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue by plan stacked bar */}
        <div className="card p-5">
          <h2 className="section-title">Revenue by Plan (Rs.k)</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={[]} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number) => [fmt(v)]} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Starter"    fill="#9ca3af" stackId="a" name="Starter" />
              <Bar dataKey="Pro"        fill="#374151" stackId="a" name="Pro" />
              <Bar dataKey="Enterprise" fill="#f59e0b" stackId="a" name="Enterprise" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tables row */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Recently joined */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Recently Joined Tenants</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="th">Shop</th>
                <th className="th">Plan</th>
                <th className="th">Status</th>
                <th className="th">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={4} className="td"><Skeleton h="h-20" /></td></tr>
              ) : recentTenants.length === 0 ? (
                <tr><td colSpan={4} className="td text-center text-xs text-gray-400 py-6">No tenants yet</td></tr>
              ) : recentTenants.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="td">
                    <p className="font-medium text-gray-900 text-xs">{t.name}</p>
                    <p className="text-[10px] text-gray-400">{t.ownerEmail}</p>
                  </td>
                  <td className="td"><span className={PLAN_BADGE[t.plan] ?? 'badge-gray'}>{t.plan}</span></td>
                  <td className="td"><span className={STATUS_BADGE[t.status] ?? 'badge-gray'}>{t.status}</span></td>
                  <td className="td text-xs text-gray-500">{fmtDate(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Trials expiring + Live feed */}
        <div className="space-y-4">
          {/* Trials expiring */}
          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
              <AlertTriangle size={15} className="text-amber-500" />
              <h2 className="text-sm font-semibold text-gray-900">Trials Expiring This Week</h2>
            </div>
            {trialExpiring.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-400">No trials expiring soon.</p>
            ) : trialExpiring.map(t => (
              <div key={t.id} className="flex items-center justify-between px-5 py-3 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-xs font-medium text-gray-800">{t.name}</p>
                  <p className="text-[10px] text-gray-400">{t.ownerEmail}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-amber-600">
                    {Math.ceil((new Date(t.trialEndsAt!).getTime() - Date.now()) / 86400000)}d left
                  </p>
                  <p className="text-[10px] text-gray-400">{t.plan}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Live activity feed */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <h2 className="text-sm font-semibold text-gray-900">Live Platform Events</h2>
              </div>
              <RefreshCw size={13} className="text-gray-400" />
            </div>
            <div className="divide-y divide-gray-50 max-h-[220px] overflow-y-auto">
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <p className="text-xs text-gray-400">Live events will appear when backend is connected</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
