'use client'

import { useState } from 'react'
import { Download, Search, Filter } from 'lucide-react'
import type { LogSeverity } from '@/types'

const SEVERITY_BADGE: Record<LogSeverity, string> = {
  INFO:     'badge-blue',
  WARN:     'badge-yellow',
  ERROR:    'badge-red',
  CRITICAL: 'bg-red-100 text-red-900 ring-1 ring-red-400 badge',
}
const ACTOR_BADGE: Record<string, string> = {
  ADMIN:  'badge-purple',
  SYSTEM: 'badge-gray',
  TENANT: 'badge-blue',
}

function fmtDateTime(s: string) {
  return new Date(s).toLocaleString('en-LK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const EVENT_TYPES = ['ALL', 'TENANT_LOGIN', 'PLAN_CHANGED', 'BACKUP_FAILED', 'TENANT_SUSPENDED',
  'NEW_TENANT', 'IMPERSONATE', 'MFA_RESET', 'PAYMENT_RECEIVED']

export default function ActivityLogsPage() {
  const [logs] = useState<{ id: string; timestamp: string; eventType: string; severity: LogSeverity; actorType: string; actor: string; target: string; details: string; ip: string }[]>([])
  const [search, setSearch] = useState('')
  const [severity, setSeverity] = useState<LogSeverity | 'ALL'>('ALL')
  const [eventType, setEventType] = useState('ALL')
  const [actorType, setActorType] = useState<'ALL' | 'ADMIN' | 'SYSTEM' | 'TENANT'>('ALL')
  const [page, setPage] = useState(1)
  const PER_PAGE = 10

  const filtered = logs.filter(l => {
    const q = search.toLowerCase()
    const matchQ = l.actor.toLowerCase().includes(q) || l.target.toLowerCase().includes(q) ||
      l.details.toLowerCase().includes(q) || l.eventType.toLowerCase().includes(q)
    const matchSev = severity === 'ALL' || l.severity === severity
    const matchType = eventType === 'ALL' || l.eventType === eventType
    const matchActor = actorType === 'ALL' || l.actorType === actorType
    return matchQ && matchSev && matchType && matchActor
  })

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Activity Logs</h1>
          <p className="text-sm text-gray-500">{filtered.length} events</p>
        </div>
        <button className="btn-secondary text-sm">
          <Download size={14} />Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-[200px]">
          <Search size={14} className="text-gray-400" />
          <input className="bg-transparent text-sm outline-none flex-1 placeholder-gray-400"
            placeholder="Search actor, target, details..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="input w-auto text-sm" value={severity}
          onChange={e => { setSeverity(e.target.value as LogSeverity | 'ALL'); setPage(1) }}>
          <option value="ALL">All Severity</option>
          <option value="INFO">Info</option>
          <option value="WARN">Warning</option>
          <option value="ERROR">Error</option>
          <option value="CRITICAL">Critical</option>
        </select>
        <select className="input w-auto text-sm" value={actorType}
          onChange={e => { setActorType(e.target.value as typeof actorType); setPage(1) }}>
          <option value="ALL">All Actors</option>
          <option value="ADMIN">Admin</option>
          <option value="SYSTEM">System</option>
          <option value="TENANT">Tenant</option>
        </select>
        <select className="input w-auto text-sm" value={eventType}
          onChange={e => { setEventType(e.target.value); setPage(1) }}>
          {EVENT_TYPES.map(t => <option key={t} value={t}>{t === 'ALL' ? 'All Events' : t.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="th">Timestamp</th>
              <th className="th">Event</th>
              <th className="th">Severity</th>
              <th className="th">Actor</th>
              <th className="th">Target</th>
              <th className="th">Details</th>
              <th className="th">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {paged.map(l => (
              <tr key={l.id} className={`hover:bg-gray-50 transition-colors ${l.severity === 'ERROR' || l.severity === 'CRITICAL' ? 'bg-red-50/30' : l.severity === 'WARN' ? 'bg-amber-50/20' : ''}`}>
                <td className="td text-[11px] text-gray-500 whitespace-nowrap font-mono">{fmtDateTime(l.timestamp)}</td>
                <td className="td">
                  <span className="text-xs font-medium text-gray-800 whitespace-nowrap">
                    {l.eventType.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="td"><span className={SEVERITY_BADGE[l.severity]}>{l.severity}</span></td>
                <td className="td">
                  <div>
                    <span className={`${ACTOR_BADGE[l.actorType]} text-[10px] mb-0.5`}>{l.actorType}</span>
                    <p className="text-[11px] text-gray-600 truncate max-w-[120px]">{l.actor}</p>
                  </div>
                </td>
                <td className="td text-xs text-gray-700 max-w-[120px] truncate">{l.target}</td>
                <td className="td text-[11px] text-gray-500 max-w-[200px] truncate">{l.details}</td>
                <td className="td text-[11px] font-mono text-gray-400">{l.ip}</td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr><td colSpan={7} className="td text-center py-12 text-gray-400">No logs match your filters.</td></tr>
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                <button key={n} onClick={() => setPage(n)}
                  className={`w-7 h-7 text-xs rounded-lg ${n === page ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
