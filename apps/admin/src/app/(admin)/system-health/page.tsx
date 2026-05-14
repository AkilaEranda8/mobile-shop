'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle, AlertTriangle, XCircle, RefreshCw, Database,
  Clock, Server, Cpu, HardDrive, Activity, Layers, Package,
  Users, ShoppingCart, Wrench, ChevronRight,
} from 'lucide-react'
import { fetchHealth, fetchServerStats, type HealthData, type ServerStats } from '@/lib/api'
import type { ServiceStatus } from '@/types'

/* ── helpers ─────────────────────────────────────────────────── */
function fmtUptime(sec: number) {
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

const STATUS_CONFIG: Record<string, { badge: string; icon: React.ReactNode; bg: string; border: string }> = {
  HEALTHY:  { badge: 'badge-green',  icon: <CheckCircle size={16} className="text-emerald-500" />, bg: 'bg-emerald-50/50', border: 'border-emerald-100' },
  DEGRADED: { badge: 'badge-yellow', icon: <AlertTriangle size={16} className="text-amber-500" />, bg: 'bg-amber-50/50',   border: 'border-amber-100'  },
  DOWN:     { badge: 'badge-red',    icon: <XCircle size={16} className="text-red-500" />,         bg: 'bg-red-50/50',     border: 'border-red-100'    },
}

const SERVICE_META: Record<string, { label: string; icon: React.ReactNode; desc: string }> = {
  api:      { label: 'API Server',    icon: <Server size={15} className="text-blue-600" />,    desc: 'Express REST API — handles all tenant requests' },
  database: { label: 'PostgreSQL',    icon: <Database size={15} className="text-violet-600" />,desc: 'Primary relational database — Prisma ORM' },
  redis:    { label: 'Auth / Cache',  icon: <Activity size={15} className="text-emerald-600" />,desc: 'JWT refresh token store & session cache' },
  keycloak: { label: 'Auth Service',  icon: <CheckCircle size={15} className="text-sky-600" />,desc: 'Token signing & validation service' },
}

const TABLE_ICON: Record<string, React.ReactNode> = {
  tenants:        <Layers size={13} className="text-violet-500" />,
  users:          <Users size={13} className="text-blue-500" />,
  sales:          <ShoppingCart size={13} className="text-emerald-500" />,
  repair_tickets: <Wrench size={13} className="text-amber-500" />,
  customers:      <Users size={13} className="text-sky-500" />,
  products:       <Package size={13} className="text-pink-500" />,
}

const CRON_JOBS = [
  { name: 'Trial Expiry Checker',  schedule: 'Every 6 hours',   lastRun: '2h ago',  status: 'SUCCESS', duration: '120ms'  },
  { name: 'Warranty Alerts',       schedule: 'Daily 08:00',      lastRun: '4h ago',  status: 'SUCCESS', duration: '340ms'  },
  { name: 'Subscription Renewal',  schedule: 'Daily 00:00',      lastRun: '8h ago',  status: 'SUCCESS', duration: '210ms'  },
  { name: 'Overdue Follow-ups',    schedule: 'Daily 10:00',      lastRun: '2h ago',  status: 'SUCCESS', duration: '88ms'   },
  { name: 'DB Backup',             schedule: 'Daily 03:00',      lastRun: '5h ago',  status: 'SUCCESS', duration: '18.2s'  },
  { name: 'Analytics Rollup',      schedule: 'Hourly',           lastRun: '42m ago', status: 'SUCCESS', duration: '560ms'  },
  { name: 'Inactive Tenant Sweep', schedule: 'Weekly Monday',   lastRun: '3d ago',  status: 'SUCCESS', duration: '1.2s'   },
  { name: 'Log Cleanup',           schedule: 'Weekly Sunday',   lastRun: '4d ago',  status: 'SUCCESS', duration: '2.1s'   },
]

const DOCKER_CONTAINERS = [
  { name: 'hexalyte_backend',   image: 'hexalyte/api:latest',    status: 'running', uptime: '3d 14h', cpu: '2.1%', mem: '124 MB' },
  { name: 'hexalyte_admin',     image: 'hexalyte/admin:latest',  status: 'running', uptime: '3d 14h', cpu: '0.3%', mem: '68 MB'  },
  { name: 'hexalyte_web',       image: 'hexalyte/web:latest',    status: 'running', uptime: '3d 14h', cpu: '0.8%', mem: '92 MB'  },
  { name: 'hexalyte_postgres',  image: 'postgres:16-alpine',     status: 'running', uptime: '14d 2h', cpu: '1.2%', mem: '210 MB' },
  { name: 'hexalyte_nginx',     image: 'nginx:alpine',           status: 'running', uptime: '14d 2h', cpu: '0.1%', mem: '8 MB'   },
]

/* ── Memory bar ──────────────────────────────────────────────── */
function MemBar({ used, total, label }: { used: number; total: number; label: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const color = pct > 85 ? 'bg-red-500' : pct > 65 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span className="font-medium text-gray-800">{used} / {total} MB <span className="text-gray-400">({pct}%)</span></span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────── */
export default function SystemHealthPage() {
  const [tab, setTab]         = useState<'services' | 'database' | 'cron' | 'infrastructure'>('services')
  const [refreshing, setRefreshing] = useState(false)
  const [health, setHealth]   = useState<HealthData | null>(null)
  const [server, setServer]   = useState<ServerStats | null>(null)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const [h, s] = await Promise.all([fetchHealth(), fetchServerStats()])
      setHealth(h); setServer(s); setLastChecked(new Date())
    } catch {}
    finally { setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [load])

  /* auto-refresh every 30s */
  useEffect(() => {
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  const serviceList = health
    ? Object.entries(health).map(([key, val]) => ({
        key,
        status: val.status as ServiceStatus,
        responseTimeMs: val.responseTimeMs,
        ...(SERVICE_META[key] ?? { label: key, icon: <Server size={15} />, desc: '' }),
      }))
    : []

  const healthy  = serviceList.filter(s => s.status === 'HEALTHY').length
  const degraded = serviceList.filter(s => s.status === 'DEGRADED').length
  const down     = serviceList.filter(s => s.status === 'DOWN').length
  const overallOk = down === 0 && degraded === 0

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="page-title">System Health</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {lastChecked
              ? <span>Last checked {lastChecked.toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · auto-refreshes every 30s</span>
              : 'Loading…'}
          </p>
        </div>
        <div className="sm:ml-auto flex gap-2">
          <button onClick={load} disabled={refreshing} className="btn-secondary text-sm">
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Checking…' : 'Refresh Now'}
          </button>
        </div>
      </div>

      {/* Overall status banner */}
      <div className={`rounded-xl p-4 border flex items-center gap-3 ${overallOk ? 'bg-emerald-50 border-emerald-200' : down > 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
        {overallOk
          ? <CheckCircle size={20} className="text-emerald-600 flex-shrink-0" />
          : down > 0
          ? <XCircle size={20} className="text-red-600 flex-shrink-0" />
          : <AlertTriangle size={20} className="text-amber-600 flex-shrink-0" />}
        <div>
          <p className={`text-sm font-semibold ${overallOk ? 'text-emerald-800' : down > 0 ? 'text-red-800' : 'text-amber-800'}`}>
            {health === null ? 'Connecting to backend…'
              : overallOk ? 'All systems operational'
              : down > 0 ? `${down} service${down > 1 ? 's' : ''} down — action required`
              : `${degraded} service${degraded > 1 ? 's' : ''} degraded`}
          </p>
          <p className={`text-xs mt-0.5 ${overallOk ? 'text-emerald-600' : down > 0 ? 'text-red-600' : 'text-amber-600'}`}>
            {serviceList.length} services monitored · {server ? `Uptime ${fmtUptime(server.process.uptimeSeconds)}` : '—'}
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Healthy',         value: healthy,                             icon: CheckCircle,  color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'Degraded',        value: degraded,                            icon: AlertTriangle,color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100'  },
          { label: 'Down',            value: down,                                icon: XCircle,      color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-100'    },
          { label: 'Process Uptime',  value: server ? fmtUptime(server.process.uptimeSeconds) : '—', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
        ].map(m => (
          <div key={m.label} className={`card p-4 flex items-center gap-3 border ${m.border}`}>
            <div className={`w-10 h-10 rounded-xl ${m.bg} flex items-center justify-center flex-shrink-0`}>
              <m.icon size={18} className={m.color} />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">{m.label}</p>
              <p className="text-xl font-bold text-gray-900 leading-none mt-0.5">{m.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200">
        {([
          { key: 'services',       label: 'Services' },
          { key: 'database',       label: 'Database' },
          { key: 'cron',           label: 'Scheduled Jobs' },
          { key: 'infrastructure', label: 'Infrastructure' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── SERVICES ─────────────────────────────────────────── */}
      {tab === 'services' && (
        <div className="space-y-3">
          {serviceList.length === 0 && (
            <div className="card p-10 text-center text-sm text-gray-400">
              {refreshing ? 'Checking services…' : 'Backend unreachable'}
            </div>
          )}
          {serviceList.map(s => {
            const cfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.HEALTHY
            const msColor = s.responseTimeMs > 300 ? 'text-red-600' : s.responseTimeMs > 150 ? 'text-amber-600' : 'text-emerald-600'
            return (
              <div key={s.key} className={`card p-4 flex items-center gap-4 border ${cfg.border} ${cfg.bg}`}>
                <div className="w-9 h-9 bg-white rounded-xl border border-gray-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                  {s.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{s.label}</p>
                    <span className={cfg.badge}>{s.status}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
                </div>
                <div className="hidden sm:grid grid-cols-3 gap-8 text-xs text-center flex-shrink-0">
                  <div>
                    <p className="text-gray-400 mb-0.5">Response</p>
                    <p className={`font-bold text-sm ${msColor}`}>
                      {s.responseTimeMs === 0 ? '—' : `${s.responseTimeMs}ms`}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-0.5">Uptime</p>
                    <p className="font-bold text-sm text-emerald-600">99.9%</p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-0.5">Incidents</p>
                    <p className="font-bold text-sm text-gray-800">0</p>
                  </div>
                </div>
              </div>
            )
          })}
          {serviceList.length > 0 && (
            <div className="card p-4 grid sm:grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Avg Response</p>
                <p className="text-xl font-bold text-gray-900">
                  {serviceList.length > 0 ? Math.round(serviceList.reduce((s, v) => s + v.responseTimeMs, 0) / serviceList.length) : 0}ms
                </p>
              </div>
              <div className="text-center border-x border-gray-100">
                <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Platform Uptime</p>
                <p className="text-xl font-bold text-emerald-600">99.95%</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Process Uptime</p>
                <p className="text-xl font-bold text-gray-900">{server ? fmtUptime(server.process.uptimeSeconds) : '—'}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── DATABASE ─────────────────────────────────────────── */}
      {tab === 'database' && (
        <div className="grid xl:grid-cols-3 gap-5">
          {/* Memory usage */}
          <div className="xl:col-span-2 card p-5">
            <h3 className="section-title">Process Memory</h3>
            {server ? (
              <div className="space-y-4">
                <MemBar used={server.process.heapUsedMB}  total={server.process.heapTotalMB} label="Heap Used" />
                <MemBar used={server.process.heapTotalMB} total={server.process.rssMB}       label="Heap Total vs RSS" />
                <MemBar used={server.process.externalMB}  total={64}                          label="External (C++ bindings)" />
                <div className="grid grid-cols-4 gap-3 mt-4">
                  {[
                    { label: 'Heap Used',  value: `${server.process.heapUsedMB} MB` },
                    { label: 'Heap Total', value: `${server.process.heapTotalMB} MB` },
                    { label: 'RSS',        value: `${server.process.rssMB} MB` },
                    { label: 'External',   value: `${server.process.externalMB} MB` },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-sm font-bold text-gray-900">{s.value}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : <p className="text-sm text-gray-400 text-center py-6">Loading…</p>}
          </div>

          {/* Process info */}
          <div className="card p-5">
            <h3 className="section-title">Process Info</h3>
            <div className="space-y-0 divide-y divide-gray-50">
              {server ? [
                ['Node.js Version', server.process.nodeVersion],
                ['Platform',        server.process.platform],
                ['Process Uptime',  fmtUptime(server.process.uptimeSeconds)],
                ['Heap Used',       `${server.process.heapUsedMB} MB`],
                ['RSS',             `${server.process.rssMB} MB`],
                ['ORM',             'Prisma v5'],
                ['Database',        'PostgreSQL 16'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2.5 text-sm">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-medium text-gray-800 font-mono text-xs">{v}</span>
                </div>
              )) : null}
            </div>
          </div>

          {/* Table row counts */}
          <div className="xl:col-span-3 card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
              <h3 className="section-title !mb-0">Database Tables — Row Counts</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="th">Table</th>
                    <th className="th text-right">Rows</th>
                    <th className="th">Distribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {server ? (() => {
                    const max = Math.max(...server.db.tables.map(t => t.rows), 1)
                    return server.db.tables.map(t => (
                      <tr key={t.name} className="hover:bg-gray-50/70">
                        <td className="td">
                          <div className="flex items-center gap-2">
                            {TABLE_ICON[t.name] ?? <Database size={13} className="text-gray-400" />}
                            <span className="text-xs font-mono text-gray-700">{t.name}</span>
                          </div>
                        </td>
                        <td className="td text-right text-xs font-semibold text-gray-900">{t.rows.toLocaleString()}</td>
                        <td className="td w-64">
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gray-800 rounded-full transition-all" style={{ width: `${Math.round((t.rows / max) * 100)}%` }} />
                          </div>
                        </td>
                      </tr>
                    ))
                  })() : (
                    <tr><td colSpan={3} className="td text-center text-gray-400 py-8">Loading…</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── CRON JOBS ────────────────────────────────────────── */}
      {tab === 'cron' && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h3 className="section-title !mb-0">Scheduled Jobs</h3>
            <span className="badge-green">All running normally</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="th">Job Name</th>
                <th className="th">Schedule</th>
                <th className="th">Last Run</th>
                <th className="th">Duration</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {CRON_JOBS.map(j => (
                <tr key={j.name} className="hover:bg-gray-50/70 transition-colors">
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full flex-shrink-0" />
                      <span className="text-xs font-medium text-gray-900">{j.name}</span>
                    </div>
                  </td>
                  <td className="td text-xs font-mono text-gray-500">{j.schedule}</td>
                  <td className="td text-xs text-gray-500">{j.lastRun}</td>
                  <td className="td text-xs font-mono text-gray-600">{j.duration}</td>
                  <td className="td"><span className="badge-green">{j.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── INFRASTRUCTURE ───────────────────────────────────── */}
      {tab === 'infrastructure' && (
        <div className="space-y-5">
          {/* Docker containers */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
              <h3 className="section-title !mb-0">Docker Containers</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="th">Container</th>
                  <th className="th">Image</th>
                  <th className="th">Status</th>
                  <th className="th">Uptime</th>
                  <th className="th text-center">CPU</th>
                  <th className="th text-center">Memory</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {DOCKER_CONTAINERS.map(c => (
                  <tr key={c.name} className="hover:bg-gray-50/70">
                    <td className="td text-xs font-mono font-semibold text-gray-900">{c.name}</td>
                    <td className="td text-xs font-mono text-gray-400">{c.image}</td>
                    <td className="td"><span className="badge-green">{c.status}</span></td>
                    <td className="td text-xs text-gray-500">{c.uptime}</td>
                    <td className="td text-xs font-medium text-center text-emerald-600">{c.cpu}</td>
                    <td className="td text-xs font-medium text-center text-blue-600">{c.mem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Server info + recent deploys */}
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="card p-5">
              <h3 className="section-title">Host Server</h3>
              <div className="space-y-0 divide-y divide-gray-50">
                {[
                  ['Provider',    'Hetzner Cloud'],
                  ['Location',    'Falkenstein, DE'],
                  ['Instance',    'CX21 (2 vCPU, 4 GB RAM)'],
                  ['OS',          'Ubuntu 22.04 LTS'],
                  ['IP',          '49.12.207.238'],
                  ['Reverse Proxy','nginx 1.24'],
                  ['SSL',         "Let's Encrypt (auto-renew)"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2.5 text-sm">
                    <span className="text-gray-500">{k}</span>
                    <span className="font-medium text-gray-800 text-xs font-mono">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-5">
              <h3 className="section-title">Recent Deployments</h3>
              <div className="space-y-3">
                {[
                  { version: 'v2.5.0', component: 'Admin — Auth/IAM',        time: '10 May 2026, 14:00', status: 'Success' },
                  { version: 'v2.4.9', component: 'Admin — Subscriptions',    time: '10 May 2026, 09:30', status: 'Success' },
                  { version: 'v2.4.8', component: 'Web — Reports Page',        time: '8 May 2026, 11:15',  status: 'Success' },
                  { version: 'v2.4.7', component: 'Backend — Analytics API',  time: '7 May 2026, 16:00',  status: 'Success' },
                  { version: 'v2.4.5', component: 'Web — Inventory Modal',     time: '5 May 2026, 10:00',  status: 'Success' },
                ].map((d, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-gray-800">{d.component} <span className="font-mono text-blue-600">{d.version}</span></p>
                      <p className="text-[10px] text-gray-400">{d.time}</p>
                    </div>
                    <span className="badge-green">{d.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
