'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Download, Search, RefreshCw, ChevronDown, ChevronRight,
  Info, AlertTriangle, XCircle, AlertCircle,
  ShoppingCart, Wrench, Users, Building2, Shield, Package,
} from 'lucide-react'
import {
  fetchActivityLogs,
  type ActivityLog, type ActivityLogResponse,
} from '@/lib/api'

/* ── helpers ─────────────────────────────────────────────────── */
function fmtDateTime(s: string) {
  return new Date(s).toLocaleString('en-LK', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

const SEVERITY_BADGE: Record<string, string> = {
  INFO:     'badge-blue',
  WARN:     'badge-yellow',
  ERROR:    'badge-red',
  CRITICAL: 'bg-red-100 text-red-900 ring-1 ring-red-400 badge',
}
const SEVERITY_ROW: Record<string, string> = {
  INFO:     '',
  WARN:     'bg-amber-50/30',
  ERROR:    'bg-red-50/30',
  CRITICAL: 'bg-red-100/50',
}
const SEVERITY_ICON: Record<string, React.ReactNode> = {
  INFO:     <Info size={13} className="text-blue-500" />,
  WARN:     <AlertTriangle size={13} className="text-amber-500" />,
  ERROR:    <XCircle size={13} className="text-red-500" />,
  CRITICAL: <AlertCircle size={13} className="text-red-700" />,
}
const ACTOR_BADGE: Record<string, string> = {
  ADMIN:  'badge-purple',
  SYSTEM: 'badge-gray',
  TENANT: 'badge-blue',
}
const EVENT_ICON: Record<string, React.ReactNode> = {
  NEW_TENANT:            <Building2 size={13} className="text-violet-500" />,
  TENANT_SUSPENDED:      <XCircle size={13} className="text-red-500" />,
  USER_CREATED:          <Users size={13} className="text-blue-500" />,
  SALE_CREATED:          <ShoppingCart size={13} className="text-emerald-500" />,
  REPAIR_OPENED:         <Wrench size={13} className="text-amber-500" />,
  REPAIR_STATUS_CHANGED: <Wrench size={13} className="text-sky-500" />,
  WARRANTY_CLAIM:        <Shield size={13} className="text-orange-500" />,
  PURCHASE_ORDER:        <Package size={13} className="text-pink-500" />,
}

const EVENT_TYPES = [
  'ALL', 'NEW_TENANT', 'TENANT_SUSPENDED', 'USER_CREATED',
  'SALE_CREATED', 'REPAIR_OPENED', 'REPAIR_STATUS_CHANGED',
  'WARRANTY_CLAIM', 'PURCHASE_ORDER',
]
const PER_PAGE = 50

/* ── Page ────────────────────────────────────────────────────── */
export default function ActivityLogsPage() {
  const [res, setRes]         = useState<ActivityLogResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [severity, setSeverity]   = useState('ALL')
  const [eventType, setEventType] = useState('ALL')
  const [actorType, setActorType] = useState('ALL')
  const [page, setPage]       = useState(1)
  const [expanded, setExpanded]   = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback((params: {
    search?: string; severity?: string; eventType?: string; actorType?: string; page?: number
  } = {}) => {
    setLoading(true)
    fetchActivityLogs({
      search:    params.search    ?? search,
      severity:  params.severity  ?? severity,
      eventType: params.eventType ?? eventType,
      actorType: params.actorType ?? actorType,
      page:      params.page      ?? page,
      limit: PER_PAGE,
    })
      .then(setRes)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [search, severity, eventType, actorType, page])

  useEffect(() => { load() }, [])

  /* debounced search */
  function handleSearch(v: string) {
    setSearch(v); setPage(1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      load({ search: v, page: 1 })
    }, 400)
  }

  function handleFilter(key: 'severity' | 'eventType' | 'actorType', val: string) {
    const next = { severity, eventType, actorType, [key]: val }
    if (key === 'severity')  setSeverity(val)
    if (key === 'eventType') setEventType(val)
    if (key === 'actorType') setActorType(val)
    setPage(1)
    load({ ...next, page: 1 })
  }

  function handlePage(p: number) {
    setPage(p)
    load({ page: p })
  }

  /* CSV export */
  function exportCSV() {
    if (!res?.data.length) return
    const header = 'Timestamp,Event,Severity,ActorType,Actor,Target,Details'
    const rows = res.data.map(l =>
      [l.timestamp, l.eventType, l.severity, l.actorType,
       `"${l.actor}"`, `"${l.target}"`, `"${l.details}"`].join(',')
    )
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `activity-logs-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  }

  const total      = res?.total ?? 0
  const totalPages = Math.ceil(total / PER_PAGE)
  const summary    = res?.summary ?? { INFO: 0, WARN: 0, ERROR: 0, CRITICAL: 0 }
  const logs       = res?.data ?? []

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="page-title">Activity Logs</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? 'Loading…' : `${total.toLocaleString()} events across all tenants`}
          </p>
        </div>
        <div className="sm:ml-auto flex gap-2">
          <button onClick={() => load()} disabled={loading} className="btn-secondary text-sm">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={exportCSV} disabled={!logs.length} className="btn-secondary text-sm">
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* Severity summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { key: 'INFO',     label: 'Info',     icon: Info,          color: 'text-blue-600',  bg: 'bg-blue-50',  border: 'border-blue-100'  },
          { key: 'WARN',     label: 'Warning',  icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
          { key: 'ERROR',    label: 'Error',    icon: XCircle,       color: 'text-red-600',   bg: 'bg-red-50',   border: 'border-red-100'   },
          { key: 'CRITICAL', label: 'Critical', icon: AlertCircle,   color: 'text-red-800',   bg: 'bg-red-100',  border: 'border-red-200'   },
        ] as const).map(s => (
          <button key={s.key} onClick={() => handleFilter('severity', severity === s.key ? 'ALL' : s.key)}
            className={`card p-3 flex items-center gap-3 border transition-all ${s.border} ${severity === s.key ? 'ring-2 ring-gray-900' : ''}`}>
            <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.icon size={15} className={s.color} />
            </div>
            <div className="text-left">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">{s.label}</p>
              <p className="text-lg font-bold text-gray-900 leading-none">{summary[s.key]}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-[200px]">
          <Search size={14} className="text-gray-400" />
          <input className="bg-transparent text-sm outline-none flex-1 placeholder-gray-400"
            placeholder="Search actor, target, event…"
            value={search} onChange={e => handleSearch(e.target.value)} />
        </div>
        <select className="input w-auto text-sm" value={severity}
          onChange={e => handleFilter('severity', e.target.value)}>
          <option value="ALL">All Severity</option>
          <option value="INFO">Info</option>
          <option value="WARN">Warning</option>
          <option value="ERROR">Error</option>
          <option value="CRITICAL">Critical</option>
        </select>
        <select className="input w-auto text-sm" value={actorType}
          onChange={e => handleFilter('actorType', e.target.value)}>
          <option value="ALL">All Actors</option>
          <option value="ADMIN">Admin</option>
          <option value="SYSTEM">System</option>
          <option value="TENANT">Tenant</option>
        </select>
        <select className="input w-auto text-sm" value={eventType}
          onChange={e => handleFilter('eventType', e.target.value)}>
          {EVENT_TYPES.map(t => (
            <option key={t} value={t}>{t === 'ALL' ? 'All Events' : t.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="th w-4"></th>
              <th className="th whitespace-nowrap">Timestamp</th>
              <th className="th">Event</th>
              <th className="th">Sev.</th>
              <th className="th">Actor</th>
              <th className="th">Target</th>
              <th className="th hidden lg:table-cell">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && (
              <tr>
                <td colSpan={7} className="td text-center py-12">
                  <RefreshCw size={18} className="animate-spin mx-auto text-gray-400" />
                </td>
              </tr>
            )}
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={7} className="td text-center py-12 text-gray-400 text-sm">
                  No logs match your filters.
                </td>
              </tr>
            )}
            {!loading && logs.map(l => (
              <>
                <tr key={l.id}
                  onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                  className={`cursor-pointer transition-colors hover:bg-gray-50 ${SEVERITY_ROW[l.severity] ?? ''}`}>
                  <td className="td text-center text-gray-400">
                    {expanded === l.id
                      ? <ChevronDown size={12} />
                      : <ChevronRight size={12} />}
                  </td>
                  <td className="td text-[11px] text-gray-500 whitespace-nowrap font-mono">
                    {fmtDateTime(l.timestamp)}
                  </td>
                  <td className="td">
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      {EVENT_ICON[l.eventType] ?? <Info size={13} className="text-gray-400" />}
                      <span className="text-xs font-medium text-gray-800">
                        {l.eventType.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="td">
                    <div className="flex items-center gap-1">
                      {SEVERITY_ICON[l.severity]}
                      <span className={`${SEVERITY_BADGE[l.severity] ?? 'badge-gray'} text-[10px]`}>
                        {l.severity}
                      </span>
                    </div>
                  </td>
                  <td className="td">
                    <div>
                      <span className={`${ACTOR_BADGE[l.actorType] ?? 'badge-gray'} text-[10px] mb-0.5`}>
                        {l.actorType}
                      </span>
                      <p className="text-[11px] text-gray-700 truncate max-w-[100px] font-medium">{l.actor}</p>
                    </div>
                  </td>
                  <td className="td text-xs text-gray-700 max-w-[120px] truncate font-mono">
                    {l.target}
                  </td>
                  <td className="td text-[11px] text-gray-500 max-w-[220px] truncate hidden lg:table-cell">
                    {l.details}
                  </td>
                </tr>
                {expanded === l.id && (
                  <tr key={`${l.id}-exp`} className="bg-gray-50/80">
                    <td colSpan={7} className="px-6 py-3">
                      <div className="grid sm:grid-cols-3 gap-4 text-xs">
                        <div>
                          <p className="text-gray-400 mb-0.5">Full Details</p>
                          <p className="text-gray-800 font-medium">{l.details || '—'}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 mb-0.5">Actor / Target</p>
                          <p className="text-gray-800 font-medium">{l.actor} → {l.target}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 mb-0.5">Timestamp</p>
                          <p className="font-mono text-gray-700">{l.timestamp}</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/50">
            <p className="text-xs text-gray-500">
              {loading ? 'Loading…' : `Showing ${((page - 1) * PER_PAGE + 1).toLocaleString()}–${Math.min(page * PER_PAGE, total).toLocaleString()} of ${total.toLocaleString()}`}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => handlePage(Math.max(1, page - 1))} disabled={page === 1 || loading}
                className="px-2 py-1 text-xs rounded-lg text-gray-600 hover:bg-gray-200 disabled:opacity-40">
                ‹ Prev
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const n = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i
                return (
                  <button key={n} onClick={() => handlePage(n)}
                    className={`w-7 h-7 text-xs rounded-lg transition-colors ${n === page ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                    {n}
                  </button>
                )
              })}
              <button onClick={() => handlePage(Math.min(totalPages, page + 1))} disabled={page === totalPages || loading}
                className="px-2 py-1 text-xs rounded-lg text-gray-600 hover:bg-gray-200 disabled:opacity-40">
                Next ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
