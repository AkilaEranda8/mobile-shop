'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Bell, CheckCheck, Check, RefreshCw, Mail, Slack, AlertOctagon,
  Info, AlertTriangle, XCircle, Building2, Shield, Wrench,
  Clock, UserPlus, CreditCard, Lightbulb,
} from 'lucide-react'
import Link from 'next/link'
import { fetchNotifications, type PlatformNotification } from '@/lib/api'

/* ── helpers ─────────────────────────────────────────────────── */
const LS_READ  = 'hx_admin_notif_read'
const LS_SETTINGS = 'hx_admin_notif_settings'

function getReadSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(LS_READ) ?? '[]')) } catch { return new Set() }
}
function saveReadSet(s: Set<string>) {
  localStorage.setItem(LS_READ, JSON.stringify([...s]))
}

function getSettings(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(LS_SETTINGS) ?? '{}') } catch { return {} }
}
function saveSettings(s: Record<string, boolean>) {
  localStorage.setItem(LS_SETTINGS, JSON.stringify(s))
}

const DEFAULT_SETTINGS: Record<string, boolean> = {
  'Subscription Expiring (≤ 7 days)': true,
  'Trial Expiring (≤ 3 days)': true,
  'Tenant Suspended': true,
  'New Tenant Registered': true,
  'Warranty Claims': true,
  'High Repair Queue': true,
  'New Feature Suggestion': true,
}

function fmtAgo(s: string) {
  const diff = Date.now() - new Date(s).getTime()
  const h = Math.floor(diff / 3600_000)
  const m = Math.floor(diff / 60_000)
  if (h >= 24) return `${Math.floor(h / 24)}d ago`
  if (h >= 1)  return `${h}h ago`
  return `${Math.max(0, m)}m ago`
}

function typeIcon(type: string) {
  switch (type) {
    case 'SUBSCRIPTION_EXPIRING': return <CreditCard size={15} className="text-red-500" />
    case 'TRIAL_EXPIRING': return <Clock size={15} className="text-amber-500" />
    case 'TENANT_SUSPENDED': return <XCircle size={15} className="text-red-600" />
    case 'NEW_TENANT': return <UserPlus size={15} className="text-emerald-500" />
    case 'WARRANTY_CLAIM': return <Shield size={15} className="text-orange-500" />
    case 'HIGH_REPAIR_QUEUE': return <Wrench size={15} className="text-amber-600" />
    case 'NEW_FEATURE_SUGGESTION': return <Lightbulb size={15} className="text-violet-500" />
    default: return <Bell size={15} className="text-gray-500" />
  }
}
const SEV_BADGE: Record<string, string> = {
  INFO: 'badge-blue', WARN: 'badge-yellow', ERROR: 'badge-red',
}

function sevIcon(severity: string) {
  switch (severity) {
    case 'INFO': return <Info size={13} className="text-blue-500" />
    case 'WARN': return <AlertTriangle size={13} className="text-amber-500" />
    case 'ERROR': return <XCircle size={13} className="text-red-500" />
    default: return <Info size={13} className="text-gray-400" />
  }
}

/* ── Page ────────────────────────────────────────────────────── */
export default function NotificationsPage() {
  const [items, setItems]       = useState<PlatformNotification[]>([])
  const [summary, setSummary]   = useState({ INFO: 0, WARN: 0, ERROR: 0 })
  const [loading, setLoading]   = useState(true)
  const [readIds, setReadIds]   = useState<Set<string>>(new Set())
  const [filter, setFilter]     = useState('ALL')
  const [tab, setTab]           = useState<'center' | 'settings'>('center')
  const [settings, setSettings] = useState<Record<string, boolean>>(DEFAULT_SETTINGS)
  const [slackUrl, setSlackUrl] = useState('')

  useEffect(() => {
    setReadIds(getReadSet())
    const saved = getSettings()
    setSettings({ ...DEFAULT_SETTINGS, ...saved })
    const sl = localStorage.getItem('hx_admin_slack') ?? ''
    setSlackUrl(sl)
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    fetchNotifications()
      .then(r => { setItems(r.data); setSummary(r.summary) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [])

  function markRead(id: string) {
    const next = new Set(readIds).add(id)
    setReadIds(next); saveReadSet(next)
  }
  function markAllRead() {
    const next = new Set(items.map(n => n.id))
    setReadIds(next); saveReadSet(next)
  }
  function toggleSetting(label: string) {
    const next = { ...settings, [label]: !settings[label] }
    setSettings(next); saveSettings(next)
  }

  const filtered = items.filter(n => {
    if (filter === 'UNREAD') return !readIds.has(n.id)
    if (filter === 'ERROR' || filter === 'WARN' || filter === 'INFO') return n.severity === filter
    if (filter === 'FEATURE') return n.type === 'NEW_FEATURE_SUGGESTION'
    return true
  })

  const unreadCount = items.filter(n => !readIds.has(n.id)).length

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Notifications</h1>
          {unreadCount > 0 && (
            <span className="w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <div className="sm:ml-auto flex gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="btn-secondary text-sm">
              <CheckCheck size={13} />Mark All Read
            </button>
          )}
          <button onClick={load} disabled={loading} className="btn-secondary text-sm">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />Refresh
          </button>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 sm:grid-cols-3 gap-4">
        {([
          { key: 'INFO',  label: 'Info',    icon: Info,          color: 'text-blue-600',  bg: 'bg-blue-50',  border: 'border-blue-100'  },
          { key: 'WARN',  label: 'Warning', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
          { key: 'ERROR', label: 'Error',   icon: XCircle,       color: 'text-red-600',   bg: 'bg-red-50',   border: 'border-red-100'   },
        ] as const).map(s => (
          <button key={s.key} onClick={() => setFilter(filter === s.key ? 'ALL' : s.key)}
            className={`card p-4 flex items-center gap-3 border transition-all ${s.border} ${filter === s.key ? 'ring-2 ring-gray-900' : ''}`}>
            <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.icon size={16} className={s.color} />
            </div>
            <div className="text-left">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">{s.label}</p>
              <p className="text-xl font-bold text-gray-900 leading-none mt-0.5">
                {loading ? '…' : summary[s.key]}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['center', 'settings'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'center' ? 'Notification Center' : 'Alert Settings'}
          </button>
        ))}
      </div>

      {/* ── Notification Center ── */}
      {tab === 'center' && (
        <>
          <div className="flex gap-2 flex-wrap">
            {['ALL', 'UNREAD', 'FEATURE', 'ERROR', 'WARN', 'INFO'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${filter === f ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                {f === 'UNREAD' ? `Unread (${unreadCount})` : f === 'FEATURE' ? 'Suggestions' : f}
              </button>
            ))}
          </div>

          {loading && (
            <div className="card p-12 text-center">
              <RefreshCw size={20} className="animate-spin text-gray-400 mx-auto" />
            </div>
          )}

          {!loading && (
            <div className="space-y-2">
              {filtered.map(n => {
                const isRead = readIds.has(n.id)
                return (
                  <div key={n.id} onClick={() => markRead(n.id)}
                    className={`card p-4 flex items-start gap-4 cursor-pointer transition-colors hover:border-gray-300 ${!isRead ? 'border-blue-200 bg-blue-50/20' : ''}`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${!isRead ? 'bg-blue-100' : 'bg-gray-100'}`}>
                      {typeIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className={`text-sm font-semibold ${!isRead ? 'text-gray-900' : 'text-gray-600'}`}>{n.title}</p>
                        <span className={`${SEV_BADGE[n.severity] ?? 'badge-gray'} text-[10px]`}>{n.severity}</span>
                        {!isRead && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{n.message}</p>
                      {n.tenantId && (
                        <Link href={`/tenants/${n.tenantId}`} onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-1 mt-1 text-[10px] text-blue-600 hover:underline">
                          <Building2 size={10} />View Tenant
                        </Link>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className="text-[11px] text-gray-400 whitespace-nowrap">{fmtAgo(n.createdAt)}</span>
                      {!isRead && (
                        <button onClick={e => { e.stopPropagation(); markRead(n.id) }}
                          className="p-1 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors">
                          <Check size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              {filtered.length === 0 && (
                <div className="card p-14 text-center">
                  <Bell size={32} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">All clear — no notifications match this filter.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Alert Settings ── */}
      {tab === 'settings' && (
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Event toggles */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Bell size={15} className="text-gray-500" />
              <h3 className="section-title !mb-0">Alert Events</h3>
            </div>
            <div className="space-y-1">
              {Object.entries(DEFAULT_SETTINGS).map(([label, def]) => (
                <div key={label} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-700">{label}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={settings[label] ?? def} onChange={() => toggleSetting(label)} className="sr-only peer" />
                    <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-gray-900 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {/* Email */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Mail size={15} className="text-gray-500" />
                <h3 className="section-title !mb-0">Email Alerts</h3>
              </div>
              <input className="input mb-3" placeholder="admin@hexalyte.com" />
              <p className="text-xs text-gray-400 mb-3">Receive ERROR and WARN alerts via email.</p>
              <button className="btn-primary text-xs">Save Email</button>
            </div>

            {/* Slack */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Slack size={15} className="text-gray-500" />
                <h3 className="section-title !mb-0">Slack Webhook</h3>
              </div>
              <input className="input mb-3" placeholder="https://hooks.slack.com/services/..."
                value={slackUrl} onChange={e => setSlackUrl(e.target.value)} />
              <div className="flex gap-2">
                <button className="btn-primary text-xs" onClick={() => localStorage.setItem('hx_admin_slack', slackUrl)}>
                  Save Webhook
                </button>
                <button className="btn-secondary text-xs">Send Test</button>
              </div>
            </div>

            {/* PagerDuty */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertOctagon size={15} className="text-gray-500" />
                <h3 className="section-title !mb-0">PagerDuty</h3>
              </div>
              <input className="input mb-3" placeholder="Integration Key" />
              <p className="text-xs text-gray-400 mb-3">Fires only for ERROR severity events.</p>
              <button className="btn-primary text-xs">Save Key</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
