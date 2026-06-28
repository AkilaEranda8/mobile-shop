'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, RefreshCw, Send, Trash2, Pencil, Sparkles, FileText,
  CheckCircle2, Clock, Eye, X, GripVertical,
} from 'lucide-react'
import {
  fetchReleases, fetchRelease, createRelease, updateRelease, publishRelease, deleteRelease,
  fetchTenants, fetchTenant, type ReleaseRow, type ReleaseItemInput,
} from '@/lib/api'

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'badge-gray', PUBLISHED: 'badge-green',
}

const CATEGORIES = [
  { value: 'NEW_FEATURE', label: 'New Feature' },
  { value: 'IMPROVEMENT', label: 'Improvement' },
  { value: 'BUG_FIX', label: 'Bug Fix' },
  { value: 'SECURITY', label: 'Security' },
  { value: 'COMING_SOON', label: 'Coming Soon' },
]

const BADGES = ['NEW', 'IMPROVED', 'FIXED', 'SECURITY', 'COMING_SOON', 'PREMIUM']

const PLANS = ['TRIAL', 'STARTER', 'PRO', 'ENTERPRISE']

const EMPTY_ITEM: ReleaseItemInput = {
  category: 'NEW_FEATURE',
  module: '',
  featureName: '',
  description: '',
  badge: 'NEW',
  displayOrder: 0,
}

const EMPTY_FORM = {
  version: '',
  title: '',
  summary: '',
  releaseDate: new Date().toISOString().slice(0, 10),
  status: 'DRAFT' as string,
  popupEnabled: true,
  active: true,
  targetType: 'ALL' as string,
  targetPlans: [] as string[],
  targetTenants: [] as string[],
  targetBranches: [] as string[],
  imageUrl: '',
  videoUrl: '',
  docUrl: '',
  items: [] as ReleaseItemInput[],
}

function fmtDate(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ReleaseNotesAdminPage() {
  const [items, setItems] = useState<ReleaseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>([])
  const [tenantBranches, setTenantBranches] = useState<Array<{
    id: string; name: string; branches: Array<{ id: string; name: string }>
  }>>([])

  const load = useCallback(() => {
    setLoading(true)
    fetchReleases({
      search: search || undefined,
      status: statusFilter !== 'ALL' ? statusFilter : undefined,
    })
      .then(r => setItems(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [search, statusFilter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetchTenants({ limit: '500' })
      .then((r: any) => {
        const rows = r.data ?? r ?? []
        setTenants(rows.map((t: any) => ({ id: t.id, name: t.name })))
        setTenantBranches(rows.map((t: any) => ({
          id: t.id,
          name: t.name,
          branches: Array.isArray(t.branches) ? t.branches.map((b: any) => ({ id: b.id, name: b.name })) : [],
        })))
      })
      .catch(() => {})
  }, [])

  const sf = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  function openCreate() {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, items: [{ ...EMPTY_ITEM }] })
    setShowForm(true)
  }

  async function openEdit(id: string) {
    setActionId(id)
    try {
      const r = await fetchRelease(id)
      setEditingId(id)
      setForm({
        version: r.version,
        title: r.title,
        summary: r.summary,
        releaseDate: r.releaseDate.slice(0, 10),
        status: r.status,
        popupEnabled: r.popupEnabled,
        active: r.active,
        targetType: r.targetType,
        targetPlans: r.targetPlans ?? [],
        targetTenants: r.targetTenants ?? [],
        targetBranches: r.targetBranches ?? [],
        imageUrl: r.imageUrl ?? '',
        videoUrl: r.videoUrl ?? '',
        docUrl: r.docUrl ?? '',
        items: (r.items ?? []).length ? r.items! : [{ ...EMPTY_ITEM }],
      })
      setShowForm(true)
    } finally { setActionId(null) }
  }

  function updateItem(idx: number, patch: Partial<ReleaseItemInput>) {
    setForm(p => ({
      ...p,
      items: p.items.map((item, i) => i === idx ? { ...item, ...patch } : item),
    }))
  }

  function addItem() {
    setForm(p => ({ ...p, items: [...p.items, { ...EMPTY_ITEM, displayOrder: p.items.length }] }))
  }

  function removeItem(idx: number) {
    setForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))
  }

  async function handleSave(publish = false) {
    if (!form.version.trim() || !form.title.trim() || !form.summary.trim()) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        status: publish ? 'PUBLISHED' : form.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
        items: form.items.filter(i => i.featureName.trim() && i.description.trim()),
      }
      if (editingId) {
        await updateRelease(editingId, payload)
        if (publish && form.status !== 'PUBLISHED') await publishRelease(editingId)
      } else {
        const created = await createRelease(payload)
        if (publish && created.status !== 'PUBLISHED') await publishRelease(created.id)
      }
      setShowForm(false)
      setForm(EMPTY_FORM)
      setEditingId(null)
      load()
    } finally { setSaving(false) }
  }

  async function handlePublish(id: string) {
    setActionId(id)
    try { await publishRelease(id); load() } finally { setActionId(null) }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete release "${title}"?`)) return
    setActionId(id)
    try { await deleteRelease(id); load() } finally { setActionId(null) }
  }

  function togglePlan(plan: string) {
    setForm(p => ({
      ...p,
      targetPlans: p.targetPlans.includes(plan)
        ? p.targetPlans.filter(x => x !== plan)
        : [...p.targetPlans, plan],
    }))
  }

  function toggleTenant(tenantId: string) {
    setForm(p => ({
      ...p,
      targetTenants: p.targetTenants.includes(tenantId)
        ? p.targetTenants.filter(x => x !== tenantId)
        : [...p.targetTenants, tenantId],
    }))
  }

  function toggleBranch(branchId: string) {
    setForm(p => ({
      ...p,
      targetBranches: p.targetBranches.includes(branchId)
        ? p.targetBranches.filter(x => x !== branchId)
        : [...p.targetBranches, branchId],
    }))
  }

  async function loadTenantBranches(tenantId: string) {
    try {
      const t = await fetchTenant(tenantId)
      const branches = Array.isArray((t as any).branches)
        ? (t as any).branches.map((b: any) => ({ id: b.id, name: b.name }))
        : []
      setTenantBranches(prev => prev.map(row =>
        row.id === tenantId ? { ...row, branches } : row,
      ))
    } catch { /* ignore */ }
  }

  const published = items.filter(a => a.status === 'PUBLISHED').length
  const drafts = items.filter(a => a.status === 'DRAFT').length

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <h1 className="page-title">Release Notes</h1>
        <div className="sm:ml-auto flex gap-2 flex-wrap">
          <input
            className="input text-sm w-48"
            placeholder="Search releases..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="input text-sm w-32" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="ALL">All</option>
            <option value="DRAFT">Drafts</option>
            <option value="PUBLISHED">Published</option>
          </select>
          <button onClick={load} disabled={loading} className="btn-secondary text-sm">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />Refresh
          </button>
          <button onClick={openCreate} className="btn-primary text-sm">
            <Plus size={13} />New Release
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Published', value: published, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'Drafts', value: drafts, icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100', border: 'border-gray-200' },
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

      {loading && (
        <div className="card p-12 text-center">
          <RefreshCw size={18} className="animate-spin text-gray-300 mx-auto" />
        </div>
      )}

      {!loading && (
        <div className="space-y-3">
          {items.map(r => {
            const inFlight = actionId === r.id
            const counts = r.counts
            return (
              <div key={r.id} className={`card p-5 border-l-4 border-l-violet-400 transition-opacity ${inFlight ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="badge-purple">v{r.version}</span>
                      <span className={STATUS_BADGE[r.status] ?? 'badge-gray'}>{r.status}</span>
                      {!r.active && <span className="badge-red">Inactive</span>}
                      {r.popupEnabled && <span className="badge-blue">Popup</span>}
                      <span className="badge-gray">{r.targetType}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">{r.title}</h3>
                    <p className="text-xs text-gray-500 line-clamp-2">{r.summary}</p>
                    {counts && (
                      <div className="flex gap-3 mt-2 text-[10px] text-gray-400 flex-wrap">
                        <span>{counts.newFeatures} features</span>
                        <span>{counts.improvements} improvements</span>
                        <span>{counts.bugFixes} fixes</span>
                        <span>{counts.securityUpdates} security</span>
                      </div>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400 flex-wrap">
                      <span>By {r.createdBy}</span>
                      <span>Released {fmtDate(r.releaseDate)}</span>
                      {r.readCount != null && (
                        <span className="flex items-center gap-1"><Eye size={9} />{r.readCount} reads</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(r.id)} disabled={inFlight}
                      className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors" title="Edit">
                      <Pencil size={14} />
                    </button>
                    {r.status === 'DRAFT' && (
                      <button onClick={() => handlePublish(r.id)} disabled={inFlight}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Publish">
                        <Send size={14} />
                      </button>
                    )}
                    <button onClick={() => handleDelete(r.id, r.title)} disabled={inFlight}
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
              <Sparkles size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No releases yet. Create your first release notes.</p>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl my-8">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-gray-900">
                {editingId ? 'Edit Release' : 'New Release'}
              </h3>
              <button onClick={() => { setShowForm(false); setEditingId(null) }} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Version *</label>
                  <input className="input" placeholder="e.g. 2.4.0" value={form.version} onChange={sf('version')} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Release Date *</label>
                  <input type="date" className="input" value={form.releaseDate} onChange={sf('releaseDate')} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
                <input className="input" placeholder="Release title" value={form.title} onChange={sf('title')} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Summary *</label>
                <textarea className="input resize-none" rows={2} placeholder="Short summary..."
                  value={form.summary} onChange={sf('summary')} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Target Audience</label>
                  <select className="input text-sm" value={form.targetType} onChange={sf('targetType')}>
                    <option value="ALL">All Tenants</option>
                    <option value="PACKAGES">Selected Packages</option>
                    <option value="COMPANIES">Selected Companies</option>
                    <option value="BRANCHES">Selected Branches</option>
                  </select>
                </div>
                <div className="flex items-end gap-4 pb-1">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={form.popupEnabled}
                      onChange={e => setForm(p => ({ ...p, popupEnabled: e.target.checked }))} />
                    Login popup
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={form.active}
                      onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
                    Active
                  </label>
                </div>
              </div>

              {form.targetType === 'PACKAGES' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Packages</label>
                  <div className="flex flex-wrap gap-2">
                    {PLANS.map(plan => (
                      <button key={plan} type="button" onClick={() => togglePlan(plan)}
                        className={`text-xs px-2.5 py-1 rounded-full border ${form.targetPlans.includes(plan) ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600'}`}>
                        {plan}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {form.targetType === 'COMPANIES' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Companies</label>
                  <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                    {tenants.map(t => (
                      <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer p-1 hover:bg-gray-50 rounded">
                        <input type="checkbox" checked={form.targetTenants.includes(t.id)} onChange={() => toggleTenant(t.id)} />
                        {t.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {form.targetType === 'BRANCHES' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Branches {form.targetBranches.length > 0 && `(${form.targetBranches.length} selected)`}
                  </label>
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-3">
                    {tenantBranches.map(t => (
                      <div key={t.id}>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs font-semibold text-gray-700">{t.name}</p>
                          {t.branches.length === 0 && (
                            <button type="button" onClick={() => loadTenantBranches(t.id)}
                              className="text-[10px] text-violet-600 hover:text-violet-800">
                              Load branches
                            </button>
                          )}
                        </div>
                        {t.branches.length > 0 ? (
                          <div className="pl-2 space-y-1">
                            {t.branches.map(b => (
                              <label key={b.id} className="flex items-center gap-2 text-xs cursor-pointer p-1 hover:bg-gray-50 rounded">
                                <input type="checkbox" checked={form.targetBranches.includes(b.id)} onChange={() => toggleBranch(b.id)} />
                                {b.name}
                              </label>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-gray-400 pl-2">No branches loaded</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Image URL</label>
                  <input className="input text-sm" placeholder="https://..." value={form.imageUrl} onChange={sf('imageUrl')} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Video URL</label>
                  <input className="input text-sm" placeholder="https://..." value={form.videoUrl} onChange={sf('videoUrl')} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Docs URL</label>
                  <input className="input text-sm" placeholder="https://..." value={form.docUrl} onChange={sf('docUrl')} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-700">Release Items</label>
                  <button type="button" onClick={addItem} className="text-xs text-violet-600 hover:text-violet-800 font-medium">
                    + Add Item
                  </button>
                </div>
                <div className="space-y-3">
                  {form.items.map((item, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <GripVertical size={14} className="text-gray-300 flex-shrink-0" />
                        <span className="text-[10px] text-gray-400 font-medium">Item {idx + 1}</span>
                        {form.items.length > 1 && (
                          <button type="button" onClick={() => removeItem(idx)} className="ml-auto text-gray-400 hover:text-red-500">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <select className="input text-sm" value={item.category}
                          onChange={e => updateItem(idx, { category: e.target.value })}>
                          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                        <input className="input text-sm" placeholder="Module" value={item.module ?? ''}
                          onChange={e => updateItem(idx, { module: e.target.value })} />
                        <select className="input text-sm" value={item.badge ?? ''}
                          onChange={e => updateItem(idx, { badge: e.target.value })}>
                          <option value="">No badge</option>
                          {BADGES.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>
                      <input className="input text-sm" placeholder="Feature name *" value={item.featureName}
                        onChange={e => updateItem(idx, { featureName: e.target.value })} />
                      <textarea className="input text-sm resize-none" rows={2} placeholder="Description *"
                        value={item.description} onChange={e => updateItem(idx, { description: e.target.value })} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-6 pt-4 border-t border-gray-100">
              <button onClick={() => { setShowForm(false); setEditingId(null) }} className="btn-secondary text-sm">Cancel</button>
              <button onClick={() => handleSave(false)} disabled={saving} className="btn-secondary text-sm disabled:opacity-50">
                <FileText size={13} />Save Draft
              </button>
              <button onClick={() => handleSave(true)} disabled={saving} className="btn-primary text-sm disabled:opacity-50">
                <Send size={13} />{editingId && form.status === 'PUBLISHED' ? 'Update' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
