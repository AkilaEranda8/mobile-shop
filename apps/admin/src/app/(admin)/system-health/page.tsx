'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, AlertTriangle, XCircle, RefreshCw, Database, Clock, Play, RotateCcw } from 'lucide-react'
import { fetchHealth, type HealthData } from '@/lib/api'
import type { ServiceStatus } from '@/types'

function fmtDateTime(s: string) {
  return new Date(s).toLocaleString('en-LK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const STATUS_ICON: Record<ServiceStatus, React.ReactNode> = {
  HEALTHY:  <CheckCircle size={15} className="text-emerald-500" />,
  DEGRADED: <AlertTriangle size={15} className="text-amber-500" />,
  DOWN:     <XCircle size={15} className="text-red-500" />,
}
const STATUS_BADGE: Record<ServiceStatus, string> = {
  HEALTHY:  'badge-green',
  DEGRADED: 'badge-yellow',
  DOWN:     'badge-red',
}
const CRON_BADGE: Record<string, string> = {
  SUCCESS: 'badge-green',
  RUNNING: 'badge-blue',
  FAILED:  'badge-red',
  PENDING: 'badge-gray',
}

export default function SystemHealthPage() {
  const [tab, setTab] = useState<'services' | 'databases' | 'cron' | 'infrastructure'>('services')
  const [refreshing, setRefreshing] = useState(false)
  const [health, setHealth] = useState<HealthData | null>(null)

  const loadHealth = useCallback(async () => {
    try {
      const data = await fetchHealth()
      setHealth(data)
    } catch { /* stay null */ }
  }, [])

  useEffect(() => { loadHealth() }, [loadHealth])

  const serviceList = health
    ? Object.entries(health).map(([key, val]) => ({
        name: key.charAt(0).toUpperCase() + key.slice(1),
        status: val.status as ServiceStatus,
        responseTimeMs: val.responseTimeMs,
        uptime: 99.9,
        detail: `Response: ${val.responseTimeMs}ms`,
        lastChecked: new Date().toISOString(),
      }))
    : []
  const healthy  = serviceList.filter(s => s.status === 'HEALTHY').length
  const degraded = serviceList.filter(s => s.status === 'DEGRADED').length
  const down     = serviceList.filter(s => s.status === 'DOWN').length

  function handleRefresh() {
    setRefreshing(true)
    loadHealth().finally(() => setTimeout(() => setRefreshing(false), 600))
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="page-header">
        <h1 className="page-title">System Health</h1>
        <button onClick={handleRefresh} className="btn-secondary text-sm">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Healthy', count: healthy, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Degraded', count: degraded, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Down', count: down, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(s => (
          <div key={s.label} className="stat-card flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.icon size={18} className={s.color} />
            </div>
            <div>
              <p className="text-[11px] text-gray-500">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900">{s.count}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['services', 'databases', 'cron', 'infrastructure'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'cron' ? 'Scheduled Jobs' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Services */}
      {tab === 'services' && (
        <div className="space-y-3">
          {serviceList.length === 0 && <p className="px-5 py-6 text-xs text-center text-gray-400">{refreshing ? 'Refreshing...' : 'No data — backend offline'}</p>}
          {serviceList.map(s => (
            <div key={s.name} className={`card p-4 flex items-center gap-4 ${s.status === 'DOWN' ? 'border-red-200 bg-red-50/30' : s.status === 'DEGRADED' ? 'border-amber-200 bg-amber-50/30' : ''}`}>
              {STATUS_ICON[s.status]}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                  <span className={STATUS_BADGE[s.status]}>{s.status}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{s.detail}</p>
              </div>
              <div className="hidden sm:grid grid-cols-3 gap-6 text-xs text-right">
                <div>
                  <p className="text-gray-400">Uptime</p>
                  <p className={`font-semibold ${s.uptime < 99 ? 'text-red-600' : s.uptime < 99.9 ? 'text-amber-600' : 'text-gray-800'}`}>{s.uptime}%</p>
                </div>
                <div>
                  <p className="text-gray-400">Response</p>
                  <p className={`font-semibold ${s.responseTimeMs > 200 ? 'text-amber-600' : s.responseTimeMs === 0 ? 'text-red-600' : 'text-gray-800'}`}>
                    {s.responseTimeMs === 0 ? '—' : `${s.responseTimeMs}ms`}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Checked</p>
                  <p className="font-medium text-gray-600">{fmtDateTime(s.lastChecked).split(',')[1]?.trim() ?? ''}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Per-tenant DB health */}
      {tab === 'databases' && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="section-title !mb-0">Tenant Schema Health</h3>
            <span className="text-xs text-gray-400">Schema data from backend</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="th">Schema</th>
                <th className="th">Tenant</th>
                <th className="th text-right">Size</th>
                <th className="th">Last Backup</th>
                <th className="th">Backup Status</th>
                <th className="th text-center">Force Backup</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={6} className="td text-center text-xs text-gray-400 py-8">Schema health data not yet available from backend</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Cron jobs */}
      {tab === 'cron' && (
        <div className="space-y-3">
          <div className="card p-6 text-center text-xs text-gray-400">Scheduled job monitoring not yet available from backend</div>
        </div>
      )}

      {/* Infrastructure */}
      {tab === 'infrastructure' && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="card p-5">
            <h3 className="section-title">Kubernetes Pods</h3>
            <div className="space-y-2">
              {[
                { name: 'api-gateway-7d4f9', status: 'Running', restarts: 0 },
                { name: 'keycloak-0', status: 'Running', restarts: 0 },
                { name: 'keycloak-1', status: 'Running', restarts: 0 },
                { name: 'keycloak-2', status: 'Running', restarts: 1 },
                { name: 'analytics-worker', status: 'Running', restarts: 0 },
                { name: 'websocket-server', status: 'Running', restarts: 0 },
                { name: 'scheduler', status: 'Running', restarts: 0 },
              ].map(p => (
                <div key={p.name} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-xs font-mono text-gray-700">{p.name}</span>
                  <div className="flex items-center gap-2">
                    {p.restarts > 0 && <span className="text-[10px] text-amber-600">{p.restarts} restarts</span>}
                    <span className="badge-green text-[10px]">{p.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-5">
            <h3 className="section-title">Recent Deployments</h3>
            <div className="space-y-3">
              {[
                { version: 'v2.4.1', component: 'API Gateway', time: '2026-05-10T14:00:00Z', status: 'Success' },
                { version: 'v2.4.0', component: 'Analytics Worker', time: '2026-05-08T10:00:00Z', status: 'Success' },
                { version: 'v2.3.9', component: 'Admin Console', time: '2026-05-06T16:00:00Z', status: 'Success' },
                { version: 'v2.3.8', component: 'API Gateway', time: '2026-05-03T11:00:00Z', status: 'Rollback' },
              ].map((d, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{d.component} <span className="font-mono text-blue-600">{d.version}</span></p>
                    <p className="text-[10px] text-gray-400">{fmtDateTime(d.time)}</p>
                  </div>
                  <span className={d.status === 'Success' ? 'badge-green' : 'badge-yellow'}>{d.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
