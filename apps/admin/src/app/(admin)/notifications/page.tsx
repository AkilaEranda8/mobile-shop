'use client'

import { useState } from 'react'
import { Bell, CheckCheck, Slack, Mail, AlertOctagon, Check } from 'lucide-react'
import type { Notification } from '@/types'

const TYPE_ICON: Record<string, string> = {
  TRIAL_EXPIRING: '⏰',
  PAYMENT_OVERDUE: '💳',
  BACKUP_FAILED: '💾',
  NEW_TENANT: '🏪',
  SYSTEM_ERROR: '⚠️',
  HIGH_API_USAGE: '📈',
  TENANT_SUSPENDED: '🚫',
  KEYCLOAK_ISSUE: '🔐',
}
const SEV_BADGE: Record<string, string> = {
  INFO: 'badge-blue',
  WARN: 'badge-yellow',
  ERROR: 'badge-red',
}

function fmtTime(s: string) {
  const diff = Date.now() - new Date(s).getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor(diff / 60000)
  if (h >= 24) return `${Math.floor(h / 24)}d ago`
  if (h >= 1) return `${h}h ago`
  return `${m}m ago`
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'ERROR' | 'WARN' | 'INFO'>('ALL')
  const [tab, setTab] = useState<'center' | 'settings'>('center')

  const unread = notifications.filter(n => !n.read).length

  const filtered = notifications.filter(n => {
    if (filter === 'UNREAD') return !n.read
    if (filter === 'ERROR' || filter === 'WARN' || filter === 'INFO') return n.severity === filter
    return true
  })

  function markRead(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Notifications</h1>
          {unread > 0 && (
            <span className="w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {unread}
            </span>
          )}
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="btn-secondary text-sm">
            <CheckCheck size={14} />Mark All Read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['center', 'settings'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'center' ? 'Notification Center' : 'Alert Settings'}
          </button>
        ))}
      </div>

      {tab === 'center' && (
        <>
          {/* Filter pills */}
          <div className="flex gap-2 flex-wrap">
            {(['ALL', 'UNREAD', 'ERROR', 'WARN', 'INFO'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${filter === f ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                {f === 'UNREAD' ? `Unread (${unread})` : f}
              </button>
            ))}
          </div>

          {/* Notifications list */}
          <div className="space-y-2">
            {filtered.map(n => (
              <div
                key={n.id}
                className={`card p-4 flex items-start gap-3 cursor-pointer transition-colors hover:border-gray-300 ${!n.read ? 'border-blue-200 bg-blue-50/30' : ''}`}
                onClick={() => markRead(n.id)}
              >
                <div className="text-xl flex-shrink-0 w-8 text-center">{TYPE_ICON[n.type] ?? '🔔'}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className={`text-sm font-semibold ${!n.read ? 'text-gray-900' : 'text-gray-700'}`}>{n.title}</p>
                    <span className={SEV_BADGE[n.severity]}>{n.severity}</span>
                    {!n.read && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-gray-500">{n.message}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[11px] text-gray-400">{fmtTime(n.createdAt)}</span>
                  {!n.read && (
                    <button onClick={(e) => { e.stopPropagation(); markRead(n.id) }}
                      className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors">
                      <Check size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="card p-12 text-center">
                <Bell size={32} className="text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">No notifications.</p>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'settings' && (
        <div className="space-y-4">
          {/* Email alerts */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Mail size={16} className="text-gray-500" />
              <h3 className="section-title !mb-0">Email Alerts</h3>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Trial Expiring (3 days)', enabled: true },
                { label: 'Payment Overdue', enabled: true },
                { label: 'Tenant Suspended', enabled: true },
                { label: 'System Error / Outage', enabled: true },
                { label: 'Backup Failure', enabled: true },
                { label: 'New Tenant Registered', enabled: false },
                { label: 'High API Usage', enabled: false },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-700">{item.label}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked={item.enabled} className="sr-only peer" />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gray-900" />
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Slack */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Slack size={16} className="text-gray-500" />
              <h3 className="section-title !mb-0">Slack Webhook</h3>
            </div>
            <div className="space-y-3">
              <input className="input" placeholder="https://hooks.slack.com/services/..." defaultValue="https://hooks.slack.com/services/T04XXXX/B04XXXX/xxxxx" />
              <div className="flex items-center gap-2">
                <button className="btn-primary text-xs">Save Webhook</button>
                <button className="btn-secondary text-xs">Test</button>
              </div>
            </div>
          </div>

          {/* PagerDuty */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertOctagon size={16} className="text-gray-500" />
              <h3 className="section-title !mb-0">PagerDuty (Critical Alerts)</h3>
            </div>
            <div className="space-y-3">
              <input className="input" placeholder="PagerDuty Integration Key" />
              <p className="text-xs text-gray-400">Only fires for CRITICAL severity events (system outage, DB loss, etc.)</p>
              <button className="btn-primary text-xs">Save Integration Key</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
