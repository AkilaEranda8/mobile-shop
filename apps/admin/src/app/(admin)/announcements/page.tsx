'use client'

import { useState } from 'react'
import { Plus, Megaphone, Calendar, Users, Eye, Send, Trash2, Globe, WrenchIcon } from 'lucide-react'
import type { Announcement } from '@/types'

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'badge-gray', SCHEDULED: 'badge-blue', SENT: 'badge-green',
}
const TYPE_BADGE: Record<string, string> = {
  INFO: 'badge-blue', WARNING: 'badge-yellow', MAINTENANCE: 'badge-red',
}
const TYPE_ICON: Record<string, React.ReactNode> = {
  INFO: <Megaphone size={14} />,
  WARNING: <WrenchIcon size={14} />,
  MAINTENANCE: <WrenchIcon size={14} />,
}

function fmtDate(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleString('en-LK', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [showCompose, setShowCompose] = useState(false)
  const [showMaintenance, setShowMaintenance] = useState(false)
  const [form, setForm] = useState({
    title: '', body: '', target: 'ALL', type: 'INFO', schedule: 'now', scheduledAt: ''
  })

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="page-header">
        <h1 className="page-title">Announcements</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowMaintenance(true)} className="btn-secondary text-sm">
            <WrenchIcon size={14} />Maintenance Mode
          </button>
          <button onClick={() => setShowCompose(true)} className="btn-primary text-sm">
            <Plus size={14} />New Announcement
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Sent', value: announcements.filter(a => a.status === 'SENT').length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Scheduled', value: announcements.filter(a => a.status === 'SCHEDULED').length, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Drafts', value: announcements.filter(a => a.status === 'DRAFT').length, color: 'text-gray-600', bg: 'bg-gray-100' },
        ].map(s => (
          <div key={s.label} className="stat-card text-center">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {announcements.map(a => (
          <div key={a.id} className={`card p-5 border-l-4 ${a.type === 'MAINTENANCE' ? 'border-l-red-400' : a.type === 'WARNING' ? 'border-l-amber-400' : 'border-l-blue-400'}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={TYPE_BADGE[a.type]}>{a.type}</span>
                  <span className={STATUS_BADGE[a.status]}>{a.status}</span>
                  <span className="badge-gray">{a.target}</span>
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">{a.title}</h3>
                <p className="text-xs text-gray-500 line-clamp-2">{a.body}</p>
                <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
                  <span>By {a.createdBy}</span>
                  <span>Created {fmtDate(a.createdAt)}</span>
                  {a.scheduledAt && <span className="flex items-center gap-1"><Calendar size={10} />Scheduled: {fmtDate(a.scheduledAt)}</span>}
                  {a.sentAt && <span className="flex items-center gap-1"><Send size={10} />Sent: {fmtDate(a.sentAt)}</span>}
                  {a.status === 'SENT' && <span className="flex items-center gap-1"><Eye size={10} />{a.seenCount} seen</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {a.status === 'DRAFT' && (
                  <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Send now">
                    <Send size={14} />
                  </button>
                )}
                <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Compose modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
            <h3 className="text-base font-bold text-gray-900 mb-5">New Announcement</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
                <input className="input" placeholder="e.g. Scheduled Maintenance — May 14"
                  value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Message</label>
                <textarea className="input resize-none" rows={4} placeholder="Announcement body..."
                  value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Target</label>
                  <select className="input text-sm" value={form.target} onChange={e => setForm({ ...form, target: e.target.value })}>
                    <option value="ALL">All Tenants</option>
                    <option value="STARTER">Starter Plan</option>
                    <option value="PRO">Pro Plan</option>
                    <option value="ENTERPRISE">Enterprise Plan</option>
                    <option value="SPECIFIC">Specific Tenant</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                  <select className="input text-sm" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                    <option value="INFO">Info</option>
                    <option value="WARNING">Warning</option>
                    <option value="MAINTENANCE">Maintenance</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Send timing</label>
                <div className="flex gap-3">
                  {(['now', 'schedule'] as const).map(v => (
                    <label key={v} className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer text-sm transition-all ${form.schedule === v ? 'border-gray-900 bg-gray-50' : 'border-gray-200'}`}>
                      <input type="radio" name="schedule" value={v} checked={form.schedule === v}
                        onChange={() => setForm({ ...form, schedule: v })} className="accent-gray-900" />
                      {v === 'now' ? 'Send immediately' : 'Schedule for later'}
                    </label>
                  ))}
                </div>
                {form.schedule === 'schedule' && (
                  <input type="datetime-local" className="input mt-2"
                    value={form.scheduledAt} onChange={e => setForm({ ...form, scheduledAt: e.target.value })} />
                )}
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <button onClick={() => setShowCompose(false)} className="btn-secondary">Cancel</button>
              <button className="btn-secondary text-sm">Save Draft</button>
              <button onClick={() => setShowCompose(false)} className="btn-primary text-sm">
                <Send size={13} />{form.schedule === 'now' ? 'Send Now' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance mode modal */}
      {showMaintenance && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <Globe size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Maintenance Mode</h3>
                <p className="text-xs text-gray-500">Platform-wide</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Maintenance message</label>
                <textarea className="input resize-none" rows={3}
                  defaultValue="Hexalyte is undergoing scheduled maintenance. We'll be back shortly." />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Exclude tenants (comma-separated realm IDs)</label>
                <input className="input" placeholder="techfix-pro, irepair-hub" />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => setShowMaintenance(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => setShowMaintenance(false)} className="btn-danger text-sm">
                Enable Maintenance Mode
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
