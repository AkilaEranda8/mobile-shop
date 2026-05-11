'use client'

import { useState, useEffect } from 'react'
import { Download, TrendingUp, FileText, Wrench, Shield, BarChart3 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from 'recharts'
import { fetchAnalytics, fetchMrrChart, type AnalyticsData, type MrrPoint } from '@/lib/api'

function fmt(n: number) {
  if (n >= 10000000) return `Rs.${(n / 10000000).toFixed(1)}Cr`
  if (n >= 100000)   return `Rs.${(n / 100000).toFixed(1)}L`
  if (n >= 1000)     return `Rs.${(n / 1000).toFixed(1)}K`
  return `Rs.${n}`
}

const PERIOD_OPTS = ['Last 30 days', 'Last 90 days', 'Last 12 months', 'All time']

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('Last 30 days')
  const [d, setD] = useState<AnalyticsData | null>(null)
  const [mrrChart, setMrrChart] = useState<MrrPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchAnalytics(), fetchMrrChart()])
      .then(([analytics, chart]) => { setD(analytics); setMrrChart(chart) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [period])

  const kpis = d ? [
    { label: 'Total GMV', value: fmt(d.totalGMV), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Total Invoices', value: d.totalInvoices.toLocaleString(), icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Total Repairs', value: d.totalRepairs.toLocaleString(), icon: Wrench, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Total Customers', value: d.totalCustomers.toLocaleString(), icon: Shield, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Top Tenants', value: (d.topTenantsByRevenue?.length ?? 0).toString(), icon: BarChart3, color: 'text-cyan-600', bg: 'bg-cyan-50' },
  ] : []

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="page-header">
        <h1 className="page-title">Platform Analytics</h1>
        <div className="flex items-center gap-2">
          <select className="input w-auto text-sm" value={period} onChange={e => setPeriod(e.target.value)}>
            {PERIOD_OPTS.map(o => <option key={o}>{o}</option>)}
          </select>
          <button className="btn-secondary text-sm">
            <Download size={14} />Export CSV
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="stat-card flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${k.bg} flex items-center justify-center flex-shrink-0`}>
              <k.icon size={16} className={k.color} />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 leading-tight mb-0.5">{k.label}</p>
              <p className="text-lg font-bold text-gray-900">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* MRR line */}
        <div className="card p-5">
          <h3 className="section-title">Platform MRR Growth</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={mrrChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                tickFormatter={v => `Rs.${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number) => [fmt(v), 'MRR']} />
              <Line type="monotone" dataKey="mrr" stroke="#111827" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top tenants by invoice */}
        <div className="card p-5">
          <h3 className="section-title">Most Active Tenants (by Invoices)</h3>
          <p className="text-sm text-gray-400 py-6 text-center">Per-tenant invoice breakdown not yet available from backend.</p>
        </div>
      </div>

      {/* API usage + inactive tenants */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* API call volume */}
        <div className="card p-5">
          <h3 className="section-title">API Call Volume by Tenant</h3>
          <p className="text-sm text-gray-400 py-6 text-center">API call metrics not yet available from backend.</p>
        </div>

        {/* Inactive tenants */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="section-title !mb-0">Inactive Tenants (7+ days)</h3>
          </div>
          <p className="px-5 py-6 text-sm text-gray-400">Inactive tenant data not yet available from backend.</p>
        </div>
      </div>

      {/* Highest MRR + Storage growth */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="section-title !mb-0">Highest MRR Tenants</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {(d?.topTenantsByRevenue ?? []).length === 0
              ? <p className="px-5 py-6 text-sm text-gray-400">No revenue data yet.</p>
              : (d?.topTenantsByRevenue as Record<string, unknown>[] ?? []).slice(0, 5).map((t, i) => (
                <div key={String(t.id ?? i)} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-xs text-gray-400 w-4 font-mono">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{String(t.name ?? t.tenantName ?? '—')}</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900">Rs.{Number(t.mrr ?? 0).toLocaleString()}</p>
                </div>
              ))
            }
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="section-title !mb-0">Storage Usage by Tenant</h3>
          </div>
          <p className="px-5 py-6 text-sm text-gray-400">Storage usage data not yet available from backend.</p>
        </div>
      </div>
    </div>
  )
}
