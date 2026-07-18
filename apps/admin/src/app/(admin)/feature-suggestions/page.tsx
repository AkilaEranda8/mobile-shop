'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Search, RefreshCw, Eye, X, Loader2, Inbox,
  AlertCircle, CheckCircle2, Clock, Flame,
} from 'lucide-react'
import {
  featureSuggestionsAdminApi,
  type AdminFeatureSuggestion,
  type FeatureSuggestionPriority,
  type FeatureSuggestionStatus,
  type FeatureSuggestionSummary,
} from '@/lib/api'

const CATEGORIES = [
  'POS', 'Inventory', 'Sales', 'Purchasing', 'Repairs', 'Customers', 'Suppliers',
  'Accounting', 'Reports', 'Dashboard', 'Mobile App', 'Printing', 'Barcode',
  'Integrations', 'Performance', 'Security', 'Other',
]

const STATUSES: FeatureSuggestionStatus[] = [
  'NEW', 'UNDER_REVIEW', 'PLANNED', 'IN_PROGRESS', 'RELEASED', 'DECLINED',
]

const PRIORITIES: FeatureSuggestionPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

const STATUS_BADGE: Record<FeatureSuggestionStatus, string> = {
  NEW: 'badge-blue',
  UNDER_REVIEW: 'badge-yellow',
  PLANNED: 'badge-purple',
  IN_PROGRESS: 'badge-blue',
  RELEASED: 'badge-green',
  DECLINED: 'badge-red',
}

const PRIORITY_BADGE: Record<FeatureSuggestionPriority, string> = {
  LOW: 'badge-gray',
  MEDIUM: 'badge-blue',
  HIGH: 'badge-yellow',
  CRITICAL: 'badge-red',
}

function statusLabel(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: '2-digit' })
}

const PER_PAGE = 20

export default function FeatureSuggestionsAdminPage() {
  const [rows, setRows] = useState<AdminFeatureSuggestion[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<FeatureSuggestionSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('ALL')
  const [priority, setPriority] = useState('ALL')
  const [category, setCategory] = useState('ALL')
  const [tenant, setTenant] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [selected, setSelected] = useState<AdminFeatureSuggestion | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [editStatus, setEditStatus] = useState<FeatureSuggestionStatus>('NEW')
  const [editPriority, setEditPriority] = useState<FeatureSuggestionPriority>('MEDIUM')
  const [editResponse, setEditResponse] = useState('')
  const [editNote, setEditNote] = useState('')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadSummary = useCallback(() => {
    featureSuggestionsAdminApi.summary().then(setSummary).catch(() => {})
  }, [])

  const load = useCallback((overrides: Record<string, string | number> = {}) => {
    setLoading(true)
    const p: Record<string, string> = {
      page: String(overrides.page ?? page),
      limit: String(PER_PAGE),
    }
    const s = (overrides.search as string | undefined) ?? search
    const st = (overrides.status as string | undefined) ?? status
    const pr = (overrides.priority as string | undefined) ?? priority
    const cat = (overrides.category as string | undefined) ?? category
    const ten = (overrides.tenant as string | undefined) ?? tenant
    const df = (overrides.dateFrom as string | undefined) ?? dateFrom
    const dt = (overrides.dateTo as string | undefined) ?? dateTo

    if (s.trim()) p.search = s.trim()
    if (st !== 'ALL') p.status = st
    if (pr !== 'ALL') p.priority = pr
    if (cat !== 'ALL') p.category = cat
    if (ten.trim()) p.tenant = ten.trim()
    if (df) p.dateFrom = df
    if (dt) p.dateTo = dt

    featureSuggestionsAdminApi.list(p)
      .then((r) => {
        setRows(r.data ?? [])
        setTotal(r.total ?? 0)
        setPage(r.page ?? Number(p.page))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, search, status, priority, category, tenant, dateFrom, dateTo])

  useEffect(() => {
    load({ page: 1 })
    loadSummary()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSearch(v: string) {
    setSearch(v)
    setPage(1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => load({ search: v, page: 1 }), 350)
  }

  async function openDetail(id: string) {
    setDetailLoading(true)
    setSaveError(null)
    try {
      const row = await featureSuggestionsAdminApi.get(id)
      setSelected(row)
      setEditStatus(row.status)
      setEditPriority(row.priority)
      setEditResponse(row.publicResponse ?? '')
      setEditNote(row.internalNote ?? '')
    } catch {
      setSaveError('Failed to load suggestion')
    } finally {
      setDetailLoading(false)
    }
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    setSaveError(null)
    try {
      const body: {
        status?: FeatureSuggestionStatus
        priority?: FeatureSuggestionPriority
        publicResponse?: string | null
        internalNote?: string | null
      } = {}
      if (editStatus !== selected.status) body.status = editStatus
      if (editPriority !== selected.priority) body.priority = editPriority
      const nextResponse = editResponse.trim() || null
      const nextNote = editNote.trim() || null
      if (nextResponse !== (selected.publicResponse ?? null)) body.publicResponse = nextResponse
      if (nextNote !== (selected.internalNote ?? null)) body.internalNote = nextNote

      if (Object.keys(body).length === 0) {
        setSaving(false)
        return
      }

      const updated = await featureSuggestionsAdminApi.update(selected.id, body)
      setSelected(updated)
      setEditStatus(updated.status)
      setEditPriority(updated.priority)
      setEditResponse(updated.publicResponse ?? '')
      setEditNote(updated.internalNote ?? '')
      load()
      loadSummary()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  const kpis = [
    { label: 'Total', value: summary?.total, icon: Inbox, color: 'text-gray-600', bg: 'bg-gray-100', border: 'border-gray-200' },
    { label: 'New', value: summary?.new, icon: AlertCircle, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-100' },
    { label: 'Under Review', value: summary?.underReview, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
    { label: 'Planned', value: summary?.planned, icon: CheckCircle2, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
    { label: 'Released', value: summary?.released, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { label: 'Declined', value: summary?.declined, icon: X, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' },
    { label: 'High Priority', value: summary?.highPriority, icon: Flame, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
    { label: 'Critical', value: summary?.criticalPriority, icon: Flame, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div>
          <h1 className="page-title">Feature Suggestions</h1>
          <p className="text-sm text-gray-500">{loading ? 'Loading…' : `${total.toLocaleString()} suggestions`}</p>
        </div>
        <button onClick={() => { load(); loadSummary() }} disabled={loading} className="btn-secondary text-sm sm:ml-auto">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className={`card p-3 flex items-center gap-2.5 border ${k.border}`}>
            <div className={`w-8 h-8 rounded-xl ${k.bg} flex items-center justify-center flex-shrink-0`}>
              <k.icon size={14} className={k.color} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide truncate">{k.label}</p>
              <p className="text-lg font-bold text-gray-900 leading-none mt-0.5">{k.value ?? '—'}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-[180px]">
          <Search size={14} className="text-gray-400" />
          <input
            className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none flex-1"
            placeholder="Search title, user, tenant…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <input
          className="input w-auto text-sm min-w-[140px]"
          placeholder="Tenant"
          value={tenant}
          onChange={(e) => {
            setTenant(e.target.value)
            setPage(1)
            if (debounceRef.current) clearTimeout(debounceRef.current)
            debounceRef.current = setTimeout(() => load({ tenant: e.target.value, page: 1 }), 350)
          }}
        />
        <select className="input w-auto text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); load({ status: e.target.value, page: 1 }) }}>
          <option value="ALL">All Status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
        <select className="input w-auto text-sm" value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); load({ priority: e.target.value, page: 1 }) }}>
          <option value="ALL">All Priority</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="input w-auto text-sm" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); load({ category: e.target.value, page: 1 }) }}>
          <option value="ALL">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="date" className="input w-auto text-sm" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); load({ dateFrom: e.target.value, page: 1 }) }} />
        <input type="date" className="input w-auto text-sm" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); load({ dateTo: e.target.value, page: 1 }) }} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Tenant</th>
                <th className="th">Shop</th>
                <th className="th">Submitted By</th>
                <th className="th">Role</th>
                <th className="th">Category</th>
                <th className="th">Title</th>
                <th className="th">Priority</th>
                <th className="th">Status</th>
                <th className="th">Created</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={10} className="td">
                    <div className="h-8 rounded-lg bg-gray-100 animate-pulse" />
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="td text-center py-12 text-sm text-gray-500">
                    No suggestions match your filters.
                  </td>
                </tr>
              )}
              {!loading && rows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50/80">
                  <td className="td">
                    <div className="font-medium text-gray-900">{row.tenantName}</div>
                    <div className="text-[11px] text-gray-400">{row.tenantSlug}</div>
                  </td>
                  <td className="td text-gray-700">{row.shopName}</td>
                  <td className="td">
                    <div className="text-gray-900">{row.submittedByName}</div>
                    <div className="text-[11px] text-gray-400">{row.submittedByEmail}</div>
                  </td>
                  <td className="td"><span className="badge-gray">{row.submittedByRole}</span></td>
                  <td className="td text-gray-700">{row.category}</td>
                  <td className="td max-w-[200px]">
                    <span className="line-clamp-1 font-medium text-gray-900">{row.title}</span>
                  </td>
                  <td className="td"><span className={PRIORITY_BADGE[row.priority]}>{row.priority}</span></td>
                  <td className="td"><span className={STATUS_BADGE[row.status]}>{statusLabel(row.status)}</span></td>
                  <td className="td text-gray-500 whitespace-nowrap">{fmtDate(row.createdAt)}</td>
                  <td className="td text-right">
                    <button
                      type="button"
                      onClick={() => void openDetail(row.id)}
                      className="btn-secondary text-xs py-1.5 px-2.5 inline-flex items-center gap-1"
                    >
                      <Eye size={12} /> Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                className="btn-secondary text-xs disabled:opacity-40"
                onClick={() => { const p = page - 1; setPage(p); load({ page: p }) }}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                className="btn-secondary text-xs disabled:opacity-40"
                onClick={() => { const p = page + 1; setPage(p); load({ page: p }) }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {(selected || detailLoading) && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={() => { setSelected(null); setSaveError(null) }} />
          <aside className="relative w-full max-w-lg h-full bg-white shadow-2xl overflow-y-auto border-l border-gray-200">
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-white">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Triage</p>
                <h2 className="text-base font-semibold text-gray-900 line-clamp-1">{selected?.title ?? 'Loading…'}</h2>
              </div>
              <button type="button" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" onClick={() => setSelected(null)}>
                <X size={16} />
              </button>
            </div>

            {detailLoading || !selected ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}
              </div>
            ) : (
              <div className="p-5 space-y-5">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] text-gray-400 uppercase">Tenant</p>
                    <p className="font-medium text-gray-900">{selected.tenantName}</p>
                    <p className="text-xs text-gray-500">{selected.tenantSlug}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400 uppercase">Shop</p>
                    <p className="font-medium text-gray-900">{selected.shopName}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400 uppercase">User</p>
                    <p className="font-medium text-gray-900">{selected.submittedByName}</p>
                    <p className="text-xs text-gray-500">{selected.submittedByEmail}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400 uppercase">Role</p>
                    <p className="font-medium text-gray-900">{selected.submittedByRole}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[11px] text-gray-400 uppercase mb-1">Suggestion</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{selected.description}</p>
                  <p className="text-xs text-gray-400 mt-2">{selected.category} · {fmtDate(selected.createdAt)}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-500 uppercase font-medium">Status</label>
                    <select className="input mt-1 w-full text-sm" value={editStatus} onChange={(e) => setEditStatus(e.target.value as FeatureSuggestionStatus)}>
                      {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 uppercase font-medium">Priority</label>
                    <select className="input mt-1 w-full text-sm" value={editPriority} onChange={(e) => setEditPriority(e.target.value as FeatureSuggestionPriority)}>
                      {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-gray-500 uppercase font-medium">Public Response</label>
                  <textarea
                    className="input mt-1 w-full text-sm min-h-[90px]"
                    value={editResponse}
                    onChange={(e) => setEditResponse(e.target.value)}
                    placeholder="Visible to the submitting user"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-gray-500 uppercase font-medium">Internal Notes</label>
                  <textarea
                    className="input mt-1 w-full text-sm min-h-[80px]"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="Admin-only — never shown to shop users"
                  />
                </div>

                <div>
                  <p className="text-[11px] text-gray-400 uppercase mb-2 font-medium">History</p>
                  <div className="space-y-2.5 max-h-48 overflow-y-auto">
                    {(selected.history ?? []).length === 0 && (
                      <p className="text-xs text-gray-400">No history yet.</p>
                    )}
                    {(selected.history ?? []).map((h) => (
                      <div key={h.id} className="text-xs border border-gray-100 rounded-lg px-3 py-2">
                        <p className="font-medium text-gray-800">
                          {h.action.replace(/_/g, ' ')}
                          {h.newStatus ? ` → ${statusLabel(h.newStatus)}` : ''}
                          {h.newPriority ? ` → ${h.newPriority}` : ''}
                        </p>
                        <p className="text-gray-400 mt-0.5">{fmtDate(h.createdAt)} · {h.performedByEmail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {saveError && (
                  <p className="text-sm text-rose-600 flex items-center gap-1.5">
                    <AlertCircle size={14} /> {saveError}
                  </p>
                )}

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSave()}
                  className="btn-primary w-full justify-center"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
