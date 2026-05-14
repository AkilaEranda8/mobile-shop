'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, Users, Building2, Clock, DollarSign,
  ArrowUpRight, ArrowDownRight, AlertTriangle, RefreshCw,
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  fetchStats, fetchTenants, fetchMrrChart, fetchAnalytics, fetchActivityLogs,
  type PlatformStats, type TenantRow, type MrrPoint, type AnalyticsData, type ActivityLog,
} from '@/lib/api'

function fmt(n: number) {
  if (n >= 100000) return `Rs.${(n / 100000).toFixed(1)}L`
  if (n >= 1000)   return `Rs.${(n / 1000).toFixed(1)}K`
  return `Rs.${n}`
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: '2-digit' })
}
function relTime(s: string) {
  const diff = (Date.now() - new Date(s).getTime()) / 1000
  if (diff < 60)   return `${Math.round(diff)}s ago`
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return fmtDate(s)
}

const SEV_DOT: Record<string, string> = {
  INFO: 'bg-blue-400', WARN: 'bg-amber-400', ERROR: 'bg-red-500', CRITICAL: 'bg-red-700',
}
const SEV_TEXT: Record<string, string> = {
  INFO: 'text-blue-600', WARN: 'text-amber-600', ERROR: 'text-red-600', CRITICAL: 'text-red-700',
}
const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'badge-green', TRIAL: 'badge-blue', SUSPENDED: 'badge-yellow', CANCELLED: 'badge-gray',
}
const PLAN_BADGE: Record<string, string> = {
  STARTER: 'badge-gray', PRO: 'badge-blue', ENTERPRISE: 'badge-purple', TRIAL: 'badge-gray',
}
const PLAN_COLORS: Record<string, string> = {
  TRIAL: '#9ca3af', STARTER: '#6b7280', PRO: '#374151', ENTERPRISE: '#f59e0b',
}

function Skeleton({ h = 'h-8', w = 'w-full' }: { h?: string; w?: string }) {
  return <div className={`${h} ${w} bg-gray-100 rounded-lg animate-pulse`} />
}

export default function DashboardPage() {
  const [s,        setS]        = useState<PlatformStats | null>(null)
  const [mrrChart, setMrrChart] = useState<MrrPoint[]>([])
  const [tenants,  setTenants]  = useState<TenantRow[]>([])
  const [analytics,setAnalytics]= useState<AnalyticsData | null>(null)
  const [feed,     setFeed]     = useState<ActivityLog[]>([])
  const [loading,  setLoading]  = useState(true)
  const [feedLoading, setFeedLoading] = useState(false)
  const [error,    setError]    = useState('')
  const [lastRefresh, setLastRefresh] = useState(Date.now())

  const loadFeed = useCallback(async () => {
    setFeedLoading(true)
    try {
      const r = await fetchActivityLogs({ limit: 15 })
      setFeed(r.data)
    } catch { /* silent */ } finally { setFeedLoading(false) }
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchStats(),
      fetchMrrChart(),
      fetchTenants({ limit: '20' }),
      fetchAnalytics(),
    ])
      .then(([stats, chart, tRes, an]) => {
        setS(stats); setMrrChart(chart); setTenants(tRes.data); setAnalytics(an)
      })
      .catch(e => setError(e.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadFeed() }, [loadFeed])
  useEffect(() => {
    const id = setInterval(() => { loadFeed(); setLastRefresh(Date.now()) }, 30_000)
    return () => clearInterval(id)
  }, [loadFeed])

  const recentTenants = [...tenants]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6)

  const trialExpiring = tenants
    .filter(t => t.status === 'TRIAL' && t.trialEndsAt)
    .filter(t => (new Date(t.trialEndsAt!).getTime() - Date.now()) / 86400000 <= 7)
    .sort((a, b) => new Date(a.trialEndsAt!).getTime() - new Date(b.trialEndsAt!).getTime())

  // Plan donut — from analytics.tenantsByPlan
  const planDonut = (analytics?.tenantsByPlan ?? []).map(p => ({
    name: p.plan, value: p._count, mrr: p._sum.mrr ?? 0,
  }))

  // YTD MRR delta
  const mrrFirst = mrrChart[0]?.mrr ?? 0
  const mrrLast  = mrrChart[mrrChart.length - 1]?.mrr ?? 0
  const ytdPct   = mrrFirst > 0 ? (((mrrLast - mrrFirst) / mrrFirst) * 100).toFixed(1) : '—'

  const statCards = s ? [
    { label: 'Monthly Recurring Revenue', value: fmt(s.mrr),                      delta: `${s.mrrDelta >= 0 ? '+' : ''}${s.mrrDelta}% vs last month`, up: s.mrrDelta >= 0,     icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Active Tenants',            value: s.activeTenants.toString(),       delta: `+${s.newTenantsThisMonth} this month`,                       up: true,                icon: Building2,  color: 'text-blue-600',   bg: 'bg-blue-50'    },
    { label: 'Trial Accounts',            value: s.trialTenants.toString(),        delta: `${trialExpiring.length} expiring this week`,                 up: false,               icon: Clock,      color: 'text-amber-600',  bg: 'bg-amber-50'   },
    { label: 'Total Platform Users',      value: s.totalUsers.toLocaleString(),    delta: 'across all tenants',                                         up: true,                icon: Users,      color: 'text-violet-600', bg: 'bg-violet-50'  },
    { label: 'New Tenants (Month)',       value: s.newTenantsThisMonth.toString(), delta: 'joined this month',                                          up: s.newTenantsThisMonth > 0, icon: TrendingUp,  color: 'text-cyan-600',   bg: 'bg-cyan-50'    },
    { label: 'Churn Rate',               value: `${s.churnRate}%`,                delta: 'monthly churn',                                              up: s.churnRate < 3,     icon: TrendingDown,color: 'text-red-600',    bg: 'bg-red-50'     },
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
    <div className="space-y-6">

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="stat-card space-y-2">
            <Skeleton h="h-4" w="w-1/2" /><Skeleton h="h-8" /><Skeleton h="h-3" w="w-2/3" />
          </div>
        )) : statCards.map(c => (
          <div key={c.label} className="stat-card flex items-start gap-4">
            <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center flex-shrink-0`}>
              <c.icon size={18} className={c.color} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 mb-0.5">{c.label}</p>
              <p className="text-2xl font-bold text-gray-900">{c.value}</p>
              <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${c.up ? 'text-emerald-600' : 'text-amber-600'}`}>
                {c.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {c.delta}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts row 1: MRR trend + Plan donut ────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title !mb-0">MRR Trend (12 months)</h2>
            {mrrChart.length > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${Number(ytdPct) >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-red-500 bg-red-50'}`}>
                {Number(ytdPct) >= 0 ? '+' : ''}{ytdPct}% YTD
              </span>
            )}
          </div>
          {loading ? <Skeleton h="h-48" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={mrrChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `Rs.${(v / 1000).toFixed(0)}K`} width={52} />
                <Tooltip formatter={(v: number) => [fmt(v), 'MRR']} />
                <Line type="monotone" dataKey="mrr" stroke="#111827" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5">
          <h2 className="section-title">Plan Distribution</h2>
          {loading ? <Skeleton h="h-40" /> : planDonut.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-10">No data</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={planDonut} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={42} outerRadius={68} paddingAngle={2}>
                    {planDonut.map(p => (
                      <Cell key={p.name} fill={PLAN_COLORS[p.name] ?? '#9ca3af'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, n: string) => [v + ' tenants', n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {planDonut.map(p => (
                  <div key={p.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: PLAN_COLORS[p.name] ?? '#9ca3af' }} />
                      <span className="text-gray-600">{p.name}</span>
                    </div>
                    <span className="font-medium text-gray-800">{p.value} · {fmt(p.mrr)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Charts row 2: New Tenants + GMV Monthly ──────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="section-title">New Tenants Per Month</h2>
          {loading ? <Skeleton h="h-44" /> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={analytics?.tenantMonths ?? []} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip formatter={(v: number, n: string) => [v, n === 'newTenants' ? 'New' : 'Total']} />
                <Bar dataKey="newTenants" fill="#111827" radius={[3, 3, 0, 0]} name="New" />
                <Bar dataKey="cumulative" fill="#e5e7eb" radius={[3, 3, 0, 0]} name="Cumulative" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5">
          <h2 className="section-title">Monthly GMV (Rs.)</h2>
          {loading ? <Skeleton h="h-44" /> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={analytics?.gmvMonths ?? []} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${(v / 1000).toFixed(0)}K`} width={44} />
                <Tooltip formatter={(v: number) => [fmt(v), 'GMV']} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="gmv"      fill="#111827" radius={[3, 3, 0, 0]} name="GMV (Rs.)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Bottom row: Recent Tenants + Trials + Live Feed ──────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Recently joined */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Recently Joined Tenants</h2>
          </div>
          <table className="w-full">
            <thead><tr className="bg-gray-50">
              <th className="th">Shop</th><th className="th">Plan</th>
              <th className="th">Status</th><th className="th">Joined</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={4} className="td"><Skeleton h="h-24" /></td></tr>
              ) : recentTenants.length === 0 ? (
                <tr><td colSpan={4} className="td text-center text-xs text-gray-400 py-6">No tenants yet</td></tr>
              ) : recentTenants.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="td">
                    <p className="font-semibold text-gray-900 text-xs">{t.name}</p>
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

        <div className="space-y-4">
          {/* Trials expiring */}
          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
              <AlertTriangle size={14} className="text-amber-500" />
              <h2 className="text-sm font-semibold text-gray-900">Trials Expiring This Week</h2>
              {trialExpiring.length > 0 && (
                <span className="ml-auto text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                  {trialExpiring.length}
                </span>
              )}
            </div>
            {loading ? (
              <div className="p-4"><Skeleton h="h-16" /></div>
            ) : trialExpiring.length === 0 ? (
              <p className="px-5 py-4 text-xs text-gray-400">No trials expiring within 7 days.</p>
            ) : trialExpiring.slice(0, 4).map(t => (
              <div key={t.id} className="flex items-center justify-between px-5 py-2.5 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-xs font-medium text-gray-800">{t.name}</p>
                  <p className="text-[10px] text-gray-400">{t.ownerEmail}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-amber-600">
                    {Math.ceil((new Date(t.trialEndsAt!).getTime() - Date.now()) / 86400000)}d left
                  </p>
                  <p className="text-[10px] text-gray-400">{t.plan}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Live Activity Feed */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <h2 className="text-sm font-semibold text-gray-900">Live Platform Events</h2>
              </div>
              <button onClick={loadFeed} className="text-gray-400 hover:text-gray-600 transition-colors">
                <RefreshCw size={13} className={feedLoading ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="divide-y divide-gray-50 max-h-[240px] overflow-y-auto">
              {feed.length === 0 && !feedLoading ? (
                <p className="text-xs text-gray-400 text-center py-8">No events yet</p>
              ) : feed.map(e => (
                <div key={e.id} className="flex items-start gap-3 px-4 py-2.5">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${SEV_DOT[e.severity] ?? 'bg-gray-300'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-gray-800 truncate">{e.target}</p>
                    <p className="text-[10px] text-gray-400 truncate">{e.details}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-[10px] font-medium ${SEV_TEXT[e.severity] ?? 'text-gray-500'}`}>
                      {e.eventType.replace(/_/g, ' ')}
                    </p>
                    <p className="text-[10px] text-gray-400">{relTime(e.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
            {feed.length > 0 && (
              <div className="px-4 py-2 border-t border-gray-50 text-center">
                <p className="text-[10px] text-gray-400">Auto-refreshes every 30s · Last: {new Date(lastRefresh).toLocaleTimeString()}</p>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
