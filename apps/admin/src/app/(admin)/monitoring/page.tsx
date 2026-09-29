'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Radio, RefreshCw, Search, ChevronDown, ChevronRight, Users, Building2, Clock, MoonStar, Monitor,
} from 'lucide-react'
import {
  fetchTenantPresence,
  type PresenceState, type TenantPresenceData, type TenantPresenceRow,
} from '@/lib/api'

const REFRESH_MS = 15_000

function ago(ts: number | null, now: number) {
  if (ts == null) return 'Never'
  const s = Math.max(0, Math.floor((now - ts) / 1000))
  if (s < 60) return 'Just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function fmtDateTime(ts: number) {
  return new Date(ts).toLocaleString('en-LK', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function areaLabel(area: string) {
  if (!area) return '—'
  return area.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const STATE_DOT: Record<PresenceState, string> = {
  online: 'bg-green-500',
  idle: 'bg-amber-400',
  offline: 'bg-gray-300',
}
const STATE_BADGE: Record<PresenceState, string> = {
  online: 'badge-green',
  idle: 'badge-yellow',
  offline: 'badge-gray',
}
const STATE_LABEL: Record<PresenceState, string> = {
  online: 'Online',
  idle: 'Idle',
  offline: 'Offline',
}
const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'badge-green',
  TRIAL: 'badge-blue',
  SUSPENDED: 'badge-red',
  CANCELLED: 'badge-gray',
}

function StateDot({ state }: { state: PresenceState }) {
  return (
    <span className="relative inline-flex w-2.5 h-2.5 flex-shrink-0">
      {state === 'online' && <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-60" />}
      <span className={`relative inline-flex w-2.5 h-2.5 rounded-full ${STATE_DOT[state]}`} />
    </span>
  )
}

type Filter = 'active' | 'online' | 'all' | 'never'

export default function MonitoringPage() {
  const [data, setData] = useState<TenantPresenceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('active')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(() => {
    setLoading(true)
    fetchTenantPresence()
      .then(d => { setData(d); setError('') })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => { setLoading(false); setNow(Date.now()) })
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') load()
    }, REFRESH_MS)
    const tick = setInterval(() => setNow(Date.now()), 30_000)
    return () => { clearInterval(t); clearInterval(tick) }
  }, [load])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data?.tenants ?? []).filter(t => {
      if (filter === 'online' && t.state !== 'online') return false
      if (filter === 'active' && t.state === 'offline') return false
      if (filter === 'never' && t.lastSeen != null) return false
      if (!q) return true
      return t.name.toLowerCase().includes(q)
        || t.slug.toLowerCase().includes(q)
        || t.recentUsers.some(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    })
  }, [data, filter, search])

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const s = data?.summary
  const tiles: { key: Filter | null; label: string; value: number | string; icon: typeof Radio; color: string; bg: string }[] = [
    { key: 'online', label: 'Tenants online', value: s?.onlineTenants ?? '—', icon: Radio, color: 'text-green-600', bg: 'bg-green-50' },
    { key: null, label: 'Users online', value: s?.onlineUsers ?? '—', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { key: 'active', label: 'Idle tenants', value: s?.idleTenants ?? '—', icon: MoonStar, color: 'text-amber-600', bg: 'bg-amber-50' },
    { key: 'all', label: 'Active last 24h', value: s ? `${s.active24hTenants} / ${s.totalTenants}` : '—', icon: Clock, color: 'text-gray-700', bg: 'bg-gray-100' },
    { key: 'never', label: 'Never seen', value: s?.neverSeenTenants ?? '—', icon: Building2, color: 'text-gray-500', bg: 'bg-gray-100' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            Live Tenant Monitor
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-green-700 bg-green-50 ring-1 ring-green-200 rounded-full px-2 py-0.5">
              <StateDot state="online" /> Live
            </span>
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Online = active in the last {data?.onlineWindowMinutes ?? 3} min · Idle = last 30 min · auto-refresh every {REFRESH_MS / 1000}s
          </p>
        </div>
        <div className="sm:ml-auto flex items-center gap-2">
          {data && <span className="text-xs text-gray-400">Updated {ago(data.generatedAt, now)}</span>}
          <button onClick={load} disabled={loading} className="btn-secondary text-sm">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {error && <div className="card p-3 text-sm text-red-600 border border-red-100 bg-red-50">{error}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {tiles.map(t => (
          <button
            key={t.label}
            type="button"
            disabled={!t.key}
            onClick={() => t.key && setFilter(t.key)}
            className={`card p-3 flex items-center gap-3 border border-gray-100 text-left transition-all ${t.key && filter === t.key ? 'ring-2 ring-gray-900' : ''}`}
          >
            <div className={`w-8 h-8 rounded-lg ${t.bg} flex items-center justify-center flex-shrink-0`}>
              <t.icon size={15} className={t.color} />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">{t.label}</p>
              <p className="text-lg font-bold text-gray-900 leading-none mt-0.5">{t.value}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-[200px]">
          <Search size={14} className="text-gray-400" />
          <input
            className="bg-transparent text-sm outline-none flex-1 placeholder-gray-400"
            placeholder="Search tenant, user or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm">
          {([
            ['active', 'Online + Idle'],
            ['online', 'Online'],
            ['all', 'All tenants'],
            ['never', 'Never seen'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-md transition-colors ${filter === key ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="th w-4" />
              <th className="th">Tenant</th>
              <th className="th">State</th>
              <th className="th">Users</th>
              <th className="th">Last seen</th>
              <th className="th">Current area</th>
              <th className="th">Plan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {!data && loading && (
              <tr><td className="td text-center text-gray-400 py-10" colSpan={7}>Loading…</td></tr>
            )}
            {data && rows.length === 0 && (
              <tr>
                <td className="td text-center text-gray-400 py-10" colSpan={7}>
                  {filter === 'online' || filter === 'active' ? 'No tenants are online right now.' : 'No tenants match.'}
                </td>
              </tr>
            )}
            {rows.map(t => (
              <TenantRow key={t.tenantId} t={t} now={now} open={expanded.has(t.tenantId)} onToggle={() => toggle(t.tenantId)} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        Presence is recorded from shop app activity (web &amp; desktop). Admin impersonation sessions are not counted.
      </p>
    </div>
  )
}

function TenantRow({ t, now, open, onToggle }: { t: TenantPresenceRow; now: number; open: boolean; onToggle: () => void }) {
  const people = t.users.length ? t.users : t.recentUsers.slice(0, 5)
  const top = t.users[0] ?? t.recentUsers[0]
  const canExpand = people.length > 0

  return (
    <Fragment>
      <tr
        className={`hover:bg-gray-50/60 ${canExpand ? 'cursor-pointer' : ''} ${t.state === 'online' ? 'bg-green-50/30' : ''}`}
        onClick={canExpand ? onToggle : undefined}
      >
        <td className="td pr-0 text-gray-400">
          {canExpand ? (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
        </td>
        <td className="td">
          <p className="font-semibold text-gray-900">{t.name}</p>
          <p className="text-xs text-gray-400">{t.slug}</p>
        </td>
        <td className="td">
          <span className={`${STATE_BADGE[t.state]} inline-flex items-center gap-1.5`}>
            <StateDot state={t.state} /> {STATE_LABEL[t.state]}
          </span>
        </td>
        <td className="td">
          {t.onlineUsers > 0 && <span className="font-semibold text-green-700">{t.onlineUsers} online</span>}
          {t.onlineUsers > 0 && t.idleUsers > 0 && <span className="text-gray-300"> · </span>}
          {t.idleUsers > 0 && <span className="text-amber-600">{t.idleUsers} idle</span>}
          {t.onlineUsers === 0 && t.idleUsers === 0 && <span className="text-gray-400">—</span>}
        </td>
        <td className="td whitespace-nowrap">
          <span className={t.lastSeen == null ? 'text-gray-400' : ''}>{ago(t.lastSeen, now)}</span>
          {t.lastSeen != null && <p className="text-[11px] text-gray-400">{fmtDateTime(t.lastSeen)}</p>}
        </td>
        <td className="td">{t.state === 'offline' ? <span className="text-gray-400">—</span> : areaLabel(top?.area ?? '')}</td>
        <td className="td">
          <div className="flex flex-wrap gap-1">
            <span className="badge-gray">{t.plan}</span>
            <span className={STATUS_BADGE[t.status] ?? 'badge-gray'}>{t.status}</span>
          </div>
        </td>
      </tr>
      {open && canExpand && (
        <tr className="bg-gray-50/70">
          <td />
          <td colSpan={6} className="px-4 pb-4 pt-1">
            <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-2">
              {t.users.length ? 'Active users' : 'Recent users'}
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              {people.map(u => (
                <div key={u.userId} className="flex items-start gap-3 rounded-lg bg-white border border-gray-100 p-3">
                  <StateDot state={u.state} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 truncate">{u.name}</p>
                      <span className="badge-gray capitalize">{u.role.toLowerCase()}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
                      <span>{ago(u.lastSeen, now)}</span>
                      {u.branchName && <span className="inline-flex items-center gap-1"><Building2 size={11} />{u.branchName}</span>}
                      {u.area && <span>{areaLabel(u.area)}</span>}
                      <span className="inline-flex items-center gap-1"><Monitor size={11} />{u.device}</span>
                      {u.ip && <span className="font-mono">{u.ip}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  )
}
