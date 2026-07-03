'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Megaphone, Calendar, Eye, Send, Trash2, Globe,
  Wrench, RefreshCw, Info, AlertTriangle, CheckCircle2, Clock,
} from 'lucide-react'
import {
  fetchAnnouncements, createAnnouncement, sendAnnouncement, deleteAnnouncement,
  fetchTenants, type AnnouncementRow, type TenantRow,
} from '@/lib/api'

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'badge-gray', SCHEDULED: 'badge-blue', SENT: 'badge-green',
}
const TYPE_META: Record<string, { badge: string; border: string; icon: React.ReactNode }> = {
  INFO:        { badge: 'badge-blue',   border: 'border-l-blue-400',   icon: <Info size={14} className="text-blue-500" /> },
  WARNING:     { badge: 'badge-yellow', border: 'border-l-amber-400',  icon: <AlertTriangle size={14} className="text-amber-500" /> },
  MAINTENANCE: { badge: 'badge-red',    border: 'border-l-red-400',    icon: <Wrench size={14} className="text-red-500" /> },
}

function fmtDate(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('en-LK', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const EMPTY_FORM = {
  title: '', body: '', target: 'ALL', type: 'INFO', schedule: 'now', scheduledAt: '',
  targetTenants: [] as string[], dismissible: true,
}

export default function AnnouncementsPage() {
  const [items, setItems]             = useState<AnnouncementRow[]>([])
  const [loading, setLoading]         = useState(true)
  const [showCompose, setShowCompose] = useState(false)
  const [showMaintenance, setShowMaintenance] = useState(false)
  const [form, setForm]               = useState(EMPTY_FORM)
  const [saving, setSaving]           = useState(false)
  const [actionId, setActionId]       = useState<string | null>(null)
  const [tenants, setTenants]         = useState<TenantRow[]>([])

  const load = useCallback(() => {
    setLoading(true)
    fetchAnnouncements()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!showCompose) return
    fetchTenants({ limit: '500' }).then(setTenants).catch(() => {})
  }, [showCompose])

  const toggleTenant = (tenantId: string) => {
    setForm(p => ({
      ...p,
      targetTenants: p.targetTenants.includes(tenantId)
        ? p.targetTenants.filter(id => id !== tenantId)
        : [...p.targetTenants, tenantId],
    }))
  }

  const announcementPayload = () => ({
    title: form.title,
    body: form.body,
    type: form.type,
    target: form.target,
    targetTenants: form.target === 'SPECIFIC' ? form.targetTenants : [],
    dismissible: form.dismissible,
  })

  const sf = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  async function handleSaveDraft() {
    if (!form.title.trim() || !form.body.trim()) return
    if (form.target === 'SPECIFIC' && form.targetTenants.length === 0) return
    setSaving(true)
    try {
      await createAnnouncement(announcementPayload())
      setShowCompose(false); setForm(EMPTY_FORM); load()
    } finally { setSaving(false) }
  }

  async function handleSend() {
    if (!form.title.trim() || !form.body.trim()) return
    if (form.target === 'SPECIFIC' && form.targetTenants.length === 0) return
    setSaving(true)
    try {
      await createAnnouncement({
        ...announcementPayload(),
        scheduledAt: form.schedule === 'schedule' ? form.scheduledAt : undefined,
        sendNow: form.schedule === 'now',
      })
      setShowCompose(false); setForm(EMPTY_FORM); load()
    } finally { setSaving(false) }
  }

  async function handleSendNow(id: string) {
    setActionId(id)
    try { await sendAnnouncement(id); load() } finally { setActionId(null) }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return
    setActionId(id)
    try { await deleteAnnouncement(id); load() } finally { setActionId(null) }
  }

  async function handleMaintenanceSend() {
    setSaving(true)
    try {
      await createAnnouncement({
        title: 'Scheduled Maintenance',
        body: "Hexalyte is undergoing scheduled maintenance. We'll be back shortly.",
        type: 'MAINTENANCE', target: 'ALL', sendNow: true,
      })
      setShowMaintenance(false); load()
    } finally { setSaving(false) }
  }

  const sent      = items.filter(a => a.status === 'SENT').length
  const scheduled = items.filter(a => a.status === 'SCHEDULED').length
  const drafts    = items.filter(a => a.status === 'DRAFT').length

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <h1 className="page-title">Announcements</h1>
        <div className="sm:ml-auto flex gap-2">
          <button onClick={load} disabled={loading} className="btn-secondary text-sm">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />Refresh
          </button>
          <button onClick={() => setShowMaintenance(true)} className="btn-secondary text-sm">
            <Wrench size={13} />Maintenance Mode
          </button>
          <button onClick={() => setShowCompose(true)} className="btn-primary text-sm">
            <Plus size={13} />New Announcement
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Sent',      value: sent,      icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'Scheduled', value: scheduled, icon: Clock,        color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-100'    },
          { label: 'Drafts',    value: drafts,    icon: Megaphone,    color: 'text-gray-500',    bg: 'bg-gray-100',   border: 'border-gray-200'    },
        ].map(s => (
          <div key={s.label} className={`card p-4 flex items-center gap-3 border ${s.border}`}>
            <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.icon size={16} className={s.color} />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 leading-none">{loading ? '…' : s.value}</p>
              <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wide">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* List */}
      {loading && (
        <div className="card p-12 text-center">
          <RefreshCw size={18} className="animate-spin text-gray-300 mx-auto" />
        </div>
      )}
      {!loading && (
        <div className="space-y-3">
          {items.map(a => {
            const meta = TYPE_META[a.type] ?? TYPE_META.INFO
            const inFlight = actionId === a.id
            return (
              <div key={a.id} className={`card p-5 border-l-4 ${meta.border} transition-opacity ${inFlight ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={meta.badge}>{a.type}</span>
                      <span className={STATUS_BADGE[a.status] ?? 'badge-gray'}>{a.status}</span>
                      <span className="badge-gray">
                        {a.target === 'SPECIFIC'
                          ? `Tenants (${a.targetTenants?.length ?? 0})`
                          : a.target}
                      </span>
                      {a.dismissible === false && <span className="badge-yellow">Pinned</span>}
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">{a.title}</h3>
                    <p className="text-xs text-gray-500 line-clamp-2">{a.body}</p>
                    <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400 flex-wrap">
                      <span>By {a.createdBy}</span>
                      <span>Created {fmtDate(a.createdAt)}</span>
                      {a.scheduledAt && (
                        <span className="flex items-center gap-1">
                          <Calendar size={9} />Scheduled: {fmtDate(a.scheduledAt)}
                        </span>
                      )}
                      {a.sentAt && (
                        <span className="flex items-center gap-1">
                          <Send size={9} />Sent: {fmtDate(a.sentAt)}
                        </span>
                      )}
                      {a.status === 'SENT' && (
                        <span className="flex items-center gap-1"><Eye size={9} />{a.seenCount} seen</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {a.status === 'DRAFT' && (
                      <button onClick={() => handleSendNow(a.id)} disabled={inFlight}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Send now">
                        <Send size={14} />
                      </button>
                    )}
                    <button onClick={() => handleDelete(a.id, a.title)} disabled={inFlight}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
          {items.length === 0 && (
            <div className="card p-14 text-center">
              <Megaphone size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No announcements yet. Create your first one.</p>
            </div>
          )}
        </div>
      )}

      {/* Compose modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
            <h3 className="text-base font-bold text-gray-900 mb-5">New Announcement</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
                <input className="input" placeholder="e.g. Scheduled Maintenance — May 14"
                  value={form.title} onChange={sf('title')} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Message *</label>
                <textarea className="input resize-none" rows={4} placeholder="Announcement body..."
                  value={form.body} onChange={sf('body')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Target</label>
                  <select className="input text-sm" value={form.target} onChange={sf('target')}>
                    <option value="ALL">All Tenants</option>
                    <option value="STARTER">Starter Plan</option>
                    <option value="PRO">Pro Plan</option>
                    <option value="ENTERPRISE">Enterprise Plan</option>
                    <option value="SPECIFIC">Specific Tenants</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                  <select className="input text-sm" value={form.type} onChange={sf('type')}>
                    <option value="INFO">Info</option>
                    <option value="WARNING">Warning</option>
                    <option value="MAINTENANCE">Maintenance</option>
                  </select>
                </div>
              </div>
              {form.target === 'SPECIFIC' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Select tenants {form.targetTenants.length > 0 && `(${form.targetTenants.length} selected)`}
                  </label>
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                    {tenants.length === 0 ? (
                      <p className="text-xs text-gray-400 p-2">Loading tenants…</p>
                    ) : tenants.map(t => (
                      <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer p-1.5 hover:bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={form.targetTenants.includes(t.id)}
                          onChange={() => toggleTenant(t.id)}
                        />
                        <span className="font-medium text-gray-800">{t.name}</span>
                        <span className="text-gray-400">{t.plan}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.dismissible}
                  onChange={e => setForm(p => ({ ...p, dismissible: e.target.checked }))}
                />
                Users can dismiss (uncheck to pin — users cannot close)
              </label>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Send timing</label>
                <div className="flex gap-3">
                  {(['now', 'schedule', 'draft'] as const).map(v => (
                    <label key={v} className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer text-xs transition-all ${form.schedule === v ? 'border-gray-900 bg-gray-50' : 'border-gray-200'}`}>
                      <input type="radio" name="schedule" value={v} checked={form.schedule === v}
                        onChange={() => setForm(p => ({ ...p, schedule: v }))} className="accent-gray-900" />
                      {v === 'now' ? 'Send now' : v === 'schedule' ? 'Schedule' : 'Save draft'}
                    </label>
                  ))}
                </div>
                {form.schedule === 'schedule' && (
                  <input type="datetime-local" className="input mt-2"
                    value={form.scheduledAt} onChange={sf('scheduledAt')} />
                )}
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <button onClick={() => { setShowCompose(false); setForm(EMPTY_FORM) }} className="btn-secondary text-sm">Cancel</button>
              {form.schedule === 'draft'
                ? <button onClick={handleSaveDraft} disabled={saving || !form.title || !form.body || (form.target === 'SPECIFIC' && form.targetTenants.length === 0)} className="btn-secondary text-sm disabled:opacity-50">Save Draft</button>
                : <button onClick={handleSend} disabled={saving || !form.title || !form.body || (form.target === 'SPECIFIC' && form.targetTenants.length === 0)} className="btn-primary text-sm disabled:opacity-50">
                    <Send size={13} />{form.schedule === 'now' ? 'Send Now' : 'Schedule'}
                  </button>
              }
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
                <p className="text-xs text-gray-500">Broadcasts a MAINTENANCE alert to all tenants</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Message</label>
                <textarea className="input resize-none" rows={3}
                  defaultValue="Hexalyte is undergoing scheduled maintenance. We'll be back shortly." />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => setShowMaintenance(false)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={handleMaintenanceSend} disabled={saving} className="btn-danger text-sm disabled:opacity-50">
                <Globe size={13} />Enable Maintenance Mode
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
