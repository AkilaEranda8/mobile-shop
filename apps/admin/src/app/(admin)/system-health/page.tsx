'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle, AlertTriangle, XCircle, RefreshCw, Database,
  Clock, Server, Activity, Layers, Package,
  Users, ShoppingCart, Wrench, Play, HardDrive, Shield,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  fetchHealth,
  fetchServerStats,
  fetchOpsOverview,
  triggerOpsJob,
  type HealthData,
  type ServerStats,
  type OpsOverview,
  type OpsJobSnapshot,
} from '@/lib/api'
import type { ServiceStatus } from '@/types'
import { hubSession } from '@/lib/hub-session'
import { canManagePlatformAdmins } from '@/lib/platform-admin-role'

/* ── helpers ─────────────────────────────────────────────────── */
function fmtUptime(sec: number) {
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function fmtBytes(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(1)} GB`
}

function fmtAgo(iso: string | null) {
  if (!iso) return 'Never'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return 'just now'
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const STATUS_CONFIG: Record<string, { badge: string; Icon: LucideIcon; iconClass: string; bg: string; border: string }> = {
  HEALTHY:  { badge: 'badge-green',  Icon: CheckCircle,    iconClass: 'text-emerald-500', bg: 'bg-emerald-50/50', border: 'border-emerald-100' },
  DEGRADED: { badge: 'badge-yellow', Icon: AlertTriangle,  iconClass: 'text-amber-500',   bg: 'bg-amber-50/50',   border: 'border-amber-100'  },
  DOWN:     { badge: 'badge-red',    Icon: XCircle,        iconClass: 'text-red-500',     bg: 'bg-red-50/50',     border: 'border-red-100'    },
  DISABLED: { badge: 'badge-gray',   Icon: Shield,         iconClass: 'text-gray-400',    bg: 'bg-gray-50/50',    border: 'border-gray-100'   },
  UNKNOWN:  { badge: 'badge-gray',   Icon: AlertTriangle,  iconClass: 'text-gray-400',    bg: 'bg-gray-50/50',    border: 'border-gray-100'   },
}

const SERVICE_META: Record<string, { label: string; Icon: LucideIcon; iconClass: string; desc: string }> = {
  api:      { label: 'API Server',    Icon: Server,     iconClass: 'text-blue-600',    desc: 'Express REST API — handles all tenant requests' },
  database: { label: 'PostgreSQL',    Icon: Database,   iconClass: 'text-brand-600',  desc: 'Primary relational database — Prisma ORM' },
  redis:    { label: 'Auth / Cache',  Icon: Activity,   iconClass: 'text-emerald-600', desc: 'JWT refresh token store & session cache' },
  keycloak: { label: 'Auth Service',  Icon: CheckCircle, iconClass: 'text-sky-600',    desc: 'Token signing & validation (when enabled)' },
}

const TABLE_ICON: Record<string, LucideIcon> = {
  tenants:        Layers,
  users:          Users,
  sales:          ShoppingCart,
  repair_tickets: Wrench,
  customers:      Users,
  products:       Package,
}

const JOB_BADGE: Record<string, string> = {
  SUCCESS: 'badge-green',
  ERROR: 'badge-red',
  RUNNING: 'badge-yellow',
  NEVER: 'badge-gray',
}

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

function DiskBar({ label, usedPercent, freeBytes, totalBytes, available, detail }: {
  label: string
  usedPercent: number | null
  freeBytes: number | null
  totalBytes: number | null
  available: boolean
  detail?: string
}) {
  if (!available) {
    return (
      <div className="text-xs text-gray-500">
        <p className="font-medium text-gray-700 mb-1">{label}</p>
        <p>{detail || 'Not available from API process'}</p>
      </div>
    )
  }
  const pct = usedPercent ?? 0
  const color = pct >= 95 ? 'bg-red-500' : pct >= 90 ? 'bg-red-400' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span className="font-medium text-gray-800">
          {fmtBytes(freeBytes)} free / {fmtBytes(totalBytes)} <span className="text-gray-400">({pct}%)</span>
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <p className="text-[10px] text-gray-400 mt-1">Thresholds: 80% warn · 90% critical · 95% immediate</p>
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────── */
export default function SystemHealthPage() {
  const [tab, setTab] = useState<'services' | 'database' | 'cron' | 'backups' | 'infrastructure'>('services')
  const [refreshing, setRefreshing] = useState(false)
  const [health, setHealth] = useState<HealthData | null>(null)
  const [server, setServer] = useState<ServerStats | null>(null)
  const [ops, setOps] = useState<OpsOverview | null>(null)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [runningJobId, setRunningJobId] = useState<string | null>(null)
  const [jobMsg, setJobMsg] = useState<string | null>(null)

  const isSuperAdmin = canManagePlatformAdmins(hubSession.getUser('enterprise'))

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const [h, s, o] = await Promise.all([
        fetchHealth(),
        fetchServerStats(),
        fetchOpsOverview().catch(() => null),
      ])
      setHealth(h)
      setServer(s)
      setOps(o)
      setLastChecked(new Date())
    } catch {
      /* keep previous */
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  const serviceList = health
    ? Object.entries(health).map(([key, val]) => ({
        key,
        status: val.status as ServiceStatus,
        responseTimeMs: val.responseTimeMs,
        detail: (val as { detail?: string }).detail,
        ...(SERVICE_META[key] ?? { label: key, Icon: Server, iconClass: 'text-gray-500', desc: '' }),
      }))
    : []

  const healthy  = serviceList.filter(s => s.status === 'HEALTHY').length
  const degraded = serviceList.filter(s => s.status === 'DEGRADED').length
  const down     = serviceList.filter(s => s.status === 'DOWN').length
  const overallOk = down === 0 && degraded === 0

  const jobs: OpsJobSnapshot[] = ops?.jobs ?? []

  async function onRunJob(id: string) {
    if (!isSuperAdmin) return
    setRunningJobId(id)
    setJobMsg(null)
    try {
      await triggerOpsJob(id)
      setJobMsg(`Job ${id} completed`)
      await load()
    } catch (e) {
      setJobMsg(e instanceof Error ? e.message : 'Job failed')
    } finally {
      setRunningJobId(null)
    }
  }

  const backupBadge =
    ops?.backup.status === 'ok' ? 'badge-green'
      : ops?.backup.status === 'stale' ? 'badge-yellow'
        : ops?.backup.status === 'missing' ? 'badge-red'
          : 'badge-gray'

  return (
    <div className="space-y-5">

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

      {ops?.maintenance.enabled && (
        <div className="rounded-xl p-4 border border-amber-200 bg-amber-50 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Maintenance mode is ON</p>
            <p className="text-xs text-amber-800 mt-0.5">{ops.maintenance.message}</p>
          </div>
        </div>
      )}

      <div className={`rounded-xl p-4 border flex items-center gap-3 ${overallOk ? 'bg-emerald-50 border-emerald-200' : down > 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
        {overallOk
          ? <CheckCircle size={20} className="text-emerald-600 flex-shrink-0" />
          : down > 0
          ? <XCircle size={20} className="text-red-600 flex-shrink-0" />
          : <AlertTriangle size={20} className="text-amber-600 flex-shrink-0" />}
        <div>
          <p className={`text-sm font-semibold ${overallOk ? 'text-emerald-800' : down > 0 ? 'text-red-800' : 'text-amber-800'}`}>
            {health === null ? 'Connecting to backend…'
              : overallOk ? 'All probed services operational'
              : down > 0 ? `${down} service${down > 1 ? 's' : ''} down — action required`
              : `${degraded} service${degraded > 1 ? 's' : ''} degraded`}
          </p>
          <p className={`text-xs mt-0.5 ${overallOk ? 'text-emerald-600' : down > 0 ? 'text-red-600' : 'text-amber-600'}`}>
            {serviceList.length} services monitored · {server ? `API uptime ${fmtUptime(server.process.uptimeSeconds)}` : '—'}
            {ops?.backup ? ` · Backup ${ops.backup.status}` : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Healthy', value: healthy, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'Degraded', value: degraded, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
          { label: 'Down', value: down, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
          { label: 'Process Uptime', value: server ? fmtUptime(server.process.uptimeSeconds) : '—', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
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

      <div className="flex gap-0 border-b border-gray-200 overflow-x-auto">
        {([
          { key: 'services', label: 'Services' },
          { key: 'database', label: 'Database' },
          { key: 'cron', label: 'Scheduled Jobs' },
          { key: 'backups', label: 'Daily Backups' },
          { key: 'infrastructure', label: 'Infrastructure' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'services' && (
        <div className="space-y-3">
          {serviceList.length === 0 && (
            <div className="card p-10 text-center text-sm text-gray-400">
              {refreshing ? 'Checking services…' : 'Backend unreachable'}
            </div>
          )}
          {serviceList.map(s => {
            const cfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.UNKNOWN
            const msColor = s.responseTimeMs > 300 ? 'text-red-600' : s.responseTimeMs > 150 ? 'text-amber-600' : 'text-emerald-600'
            const SIcon = s.Icon
            return (
              <div key={s.key} className={`card p-4 flex items-center gap-4 border ${cfg.border} ${cfg.bg}`}>
                <div className="w-9 h-9 bg-white rounded-xl border border-gray-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <SIcon size={15} className={s.iconClass} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{s.label}</p>
                    <span className={cfg.badge}>{s.status}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
                  {s.detail && <p className="text-[11px] text-gray-400 mt-0.5 font-mono">{s.detail}</p>}
                </div>
                <div className="hidden sm:block text-xs text-center flex-shrink-0 min-w-[72px]">
                  <p className="text-gray-400 mb-0.5">Response</p>
                  <p className={`font-bold text-sm ${msColor}`}>
                    {s.responseTimeMs === 0 && s.status === 'DISABLED' ? '—' : `${s.responseTimeMs}ms`}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'database' && (
        <div className="grid xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2 card p-5">
            <h3 className="section-title">Process Memory</h3>
            {server ? (
              <div className="space-y-4">
                <MemBar used={server.process.heapUsedMB} total={server.process.heapTotalMB} label="Heap Used" />
                <MemBar used={server.process.heapTotalMB} total={Math.max(server.process.rssMB, 1)} label="Heap Total vs RSS" />
                <MemBar used={server.process.externalMB} total={Math.max(server.process.externalMB, 64)} label="External (C++ bindings)" />
              </div>
            ) : <p className="text-sm text-gray-400 text-center py-6">Loading…</p>}
          </div>

          <div className="card p-5">
            <h3 className="section-title">Process Info</h3>
            <div className="space-y-0 divide-y divide-gray-50">
              {server ? [
                ['Node.js Version', server.process.nodeVersion],
                ['Platform', server.process.platform],
                ['Process Uptime', fmtUptime(server.process.uptimeSeconds)],
                ['Heap Used', `${server.process.heapUsedMB} MB`],
                ['RSS', `${server.process.rssMB} MB`],
                ['PID', ops?.host.pid != null ? String(ops.host.pid) : '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2.5 text-sm">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-medium text-gray-800 font-mono text-xs">{v}</span>
                </div>
              )) : null}
            </div>
          </div>

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
                            {(() => {
                              const TIcon = TABLE_ICON[t.name] ?? Database
                              return <TIcon size={13} className={TABLE_ICON[t.name] ? 'text-brand-500' : 'text-gray-400'} />
                            })()}
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

      {tab === 'cron' && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between gap-3 flex-wrap">
            <h3 className="section-title !mb-0">Scheduled Jobs</h3>
            <div className="flex items-center gap-2">
              {jobMsg && <span className="text-xs text-gray-500">{jobMsg}</span>}
              {jobs.some(j => j.lastStatus === 'ERROR')
                ? <span className="badge-red">Errors detected</span>
                : <span className="badge-green">Live registry</span>}
            </div>
          </div>
          {jobs.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">
              No job registry data yet — restart backend after deploy to register timers.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="th">Job Name</th>
                  <th className="th">Schedule</th>
                  <th className="th">Last Run</th>
                  <th className="th">Duration</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {jobs.map(j => (
                  <tr key={j.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          j.lastStatus === 'ERROR' ? 'bg-red-400' : j.lastStatus === 'RUNNING' ? 'bg-amber-400' : 'bg-emerald-400'
                        }`} />
                        <div>
                          <span className="text-xs font-medium text-gray-900">{j.name}</span>
                          {j.lastError && <p className="text-[10px] text-red-500 font-mono mt-0.5 max-w-xs truncate">{j.lastError}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="td text-xs font-mono text-gray-500">{j.schedule}</td>
                    <td className="td text-xs text-gray-500">{fmtAgo(j.lastFinishedAt || j.lastStartedAt)}</td>
                    <td className="td text-xs font-mono text-gray-600">
                      {j.lastDurationMs != null ? `${j.lastDurationMs}ms` : '—'}
                    </td>
                    <td className="td"><span className={JOB_BADGE[j.lastStatus] ?? 'badge-gray'}>{j.lastStatus}</span></td>
                    <td className="td text-right">
                      {isSuperAdmin ? (
                        <button
                          type="button"
                          disabled={j.running || runningJobId === j.id}
                          onClick={() => onRunJob(j.id)}
                          className="btn-secondary text-xs inline-flex items-center gap-1 disabled:opacity-50"
                          title="Run now (SUPER_ADMIN)"
                        >
                          <Play size={11} />
                          {j.running || runningJobId === j.id ? 'Running…' : 'Run'}
                        </button>
                      ) : (
                        <span className="text-[10px] text-gray-400">SUPER_ADMIN</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'backups' && (
        <div className="space-y-5">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Status', value: ops?.backup.status?.toUpperCase() ?? '—', badge: true },
              { label: 'Schedule', value: ops?.backup.schedule ?? 'Daily 02:15' },
              { label: 'Retention', value: ops ? `${ops.backup.retentionDays} days` : '14 days' },
              { label: 'Last 48h', value: ops ? String(ops.backup.recentCount48h) : '—' },
            ].map((m) => (
              <div key={m.label} className="card p-4">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">{m.label}</p>
                <div className="mt-1 flex items-center gap-2">
                  {m.badge && ops ? (
                    <span className={backupBadge}>{m.value}</span>
                  ) : (
                    <p className="text-lg font-bold text-gray-900">{m.value}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="card p-5">
            <h3 className="section-title">Latest backup</h3>
            {ops ? (
              <div className="space-y-0 divide-y divide-gray-50 text-sm">
                {[
                  ['Timezone', ops.backup.timezone || 'Asia/Colombo'],
                  ['Directory', ops.backup.directory],
                  ['File', ops.backup.latestFile ?? '—'],
                  ['Size', fmtBytes(ops.backup.latestBytes)],
                  ['Created', ops.backup.latestCreatedAt ?? '—'],
                  ['Age', ops.backup.ageHours != null ? `${ops.backup.ageHours}h` : '—'],
                  ['Format', ops.backup.formatVersion ? `v${ops.backup.formatVersion} (AES-256-CBC)` : '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2.5 gap-3">
                    <span className="text-gray-500 flex-shrink-0">{k}</span>
                    <span className="font-medium text-gray-800 text-xs font-mono text-right break-all">{v}</span>
                  </div>
                ))}
                {ops.backup.detail && (
                  <p className="text-xs text-amber-700 py-2">{ops.backup.detail}</p>
                )}
                <p className="text-[11px] text-gray-400 pt-3">
                  Host cron runs encrypted `pg_dump` daily. Admin shows status only — restore stays on the server restore-test script.
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Loading…</p>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h3 className="section-title !mb-0">Recent daily backups</h3>
              <span className="text-xs text-gray-500">Encrypted · no secrets shown</span>
            </div>
            {!ops?.backup.recent?.length ? (
              <div className="p-8 text-center text-sm text-gray-400">
                {ops?.backup.detail || 'No backup files found yet'}
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="th">Created</th>
                    <th className="th">File</th>
                    <th className="th text-right">Size</th>
                    <th className="th">Format</th>
                    <th className="th">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ops.backup.recent.map((b) => (
                    <tr key={b.file} className="hover:bg-gray-50/70">
                      <td className="td text-xs text-gray-600 whitespace-nowrap">{b.createdAt}</td>
                      <td className="td text-xs font-mono text-gray-800 break-all">{b.file}</td>
                      <td className="td text-xs text-right font-medium">{fmtBytes(b.bytes)}</td>
                      <td className="td text-xs font-mono text-gray-500">
                        {b.formatVersion ? `v${b.formatVersion}` : '—'}
                      </td>
                      <td className="td">
                        <span className={b.status === 'ok' ? 'badge-green' : 'badge-red'}>
                          {b.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'infrastructure' && (
        <div className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="section-title !mb-0">Encrypted DB Backups</h3>
                {ops && <span className={backupBadge}>{ops.backup.status.toUpperCase()}</span>}
              </div>
              {ops ? (
                <div className="space-y-0 divide-y divide-gray-50 text-sm">
                  {[
                    ['Directory', ops.backup.directory],
                    ['Latest file', ops.backup.latestFile ?? '—'],
                    ['Size', fmtBytes(ops.backup.latestBytes)],
                    ['Created', ops.backup.latestCreatedAt ?? '—'],
                    ['Age', ops.backup.ageHours != null ? `${ops.backup.ageHours}h` : '—'],
                    ['Format', ops.backup.formatVersion ? `v${ops.backup.formatVersion}` : '—'],
                    ['Last 48h count', String(ops.backup.recentCount48h)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between py-2.5 gap-3">
                      <span className="text-gray-500 flex-shrink-0">{k}</span>
                      <span className="font-medium text-gray-800 text-xs font-mono text-right break-all">{v}</span>
                    </div>
                  ))}
                  {ops.backup.detail && (
                    <p className="text-xs text-amber-700 py-2">{ops.backup.detail}</p>
                  )}
                </div>
              ) : <p className="text-sm text-gray-400">Loading…</p>}
            </div>

            <div className="card p-5 space-y-5">
              <h3 className="section-title">Disk Space</h3>
              {ops ? (
                <>
                  <DiskBar
                    label={`Root (${ops.disk.root.path})`}
                    usedPercent={ops.disk.root.usedPercent}
                    freeBytes={ops.disk.root.freeBytes}
                    totalBytes={ops.disk.root.totalBytes}
                    available={ops.disk.root.available}
                    detail={ops.disk.root.detail}
                  />
                  <DiskBar
                    label={`Backups (${ops.disk.backups.path})`}
                    usedPercent={ops.disk.backups.usedPercent}
                    freeBytes={ops.disk.backups.freeBytes}
                    totalBytes={ops.disk.backups.totalBytes}
                    available={ops.disk.backups.available}
                    detail={ops.disk.backups.detail}
                  />
                </>
              ) : <p className="text-sm text-gray-400">Loading…</p>}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h3 className="section-title !mb-0">Docker Containers</h3>
              {ops && (
                <span className={ops.docker.available ? 'badge-green' : 'badge-gray'}>
                  {ops.docker.available ? 'Live' : 'Unavailable'}
                </span>
              )}
            </div>
            {ops?.docker.available && ops.docker.containers.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="th">Container</th>
                    <th className="th">Image</th>
                    <th className="th">Status</th>
                    <th className="th">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ops.docker.containers.map(c => (
                    <tr key={c.name} className="hover:bg-gray-50/70">
                      <td className="td text-xs font-mono font-semibold text-gray-900">{c.name}</td>
                      <td className="td text-xs font-mono text-gray-400">{c.image}</td>
                      <td className="td text-xs text-gray-600">{c.status}</td>
                      <td className="td"><span className={c.state === 'running' ? 'badge-green' : 'badge-yellow'}>{c.state}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6 text-sm text-gray-500 flex items-start gap-2">
                <HardDrive size={16} className="mt-0.5 flex-shrink-0 text-gray-400" />
                <p>
                  {ops?.docker.detail
                    || 'Docker status is not exposed to the API by default (safer). Host ops use `docker compose ps` on the server.'}
                </p>
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div className="card p-5">
              <h3 className="section-title">Host / Deploy Hints</h3>
              <div className="space-y-0 divide-y divide-gray-50">
                {[
                  ['Documented IP', ops?.host.publicHints.documentedServerIp ?? '157.180.113.249'],
                  ['App directory', ops?.host.publicHints.appDir ?? '/opt/hexalyte'],
                  ['Hostname', ops?.host.hostname ?? '—'],
                  ['Timezone', ops?.timezone ?? 'Asia/Colombo'],
                  ['Node', ops?.host.nodeVersion ?? server?.process.nodeVersion ?? '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2.5 text-sm gap-3">
                    <span className="text-gray-500">{k}</span>
                    <span className="font-medium text-gray-800 text-xs font-mono text-right">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-5">
              <h3 className="section-title">Control surfaces</h3>
              <ul className="text-sm text-gray-600 space-y-2 list-disc pl-4">
                <li>Maintenance mode — Settings</li>
                <li>Security posture — Security Scan</li>
                <li>Tenant / billing control — Tenants, Subscriptions, Payments</li>
                <li>IAM sessions — Auth / IAM → revoke</li>
                <li>Support impersonation — Support Tools</li>
                <li>Job run-now — this page (SUPER_ADMIN)</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
