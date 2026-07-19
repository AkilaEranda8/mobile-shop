'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Lightbulb, Send, X, Clock, CheckCircle2, XCircle, Loader2, Plus,
  Eye, AlertCircle, RefreshCw, Hourglass, Rocket, ListChecks,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import {
  featureSuggestionsApi,
  type FeatureSuggestion,
  type FeatureSuggestionCategory,
  type FeatureSuggestionPriority,
  type FeatureSuggestionStatus,
} from '@/lib/api'

const CATEGORIES: FeatureSuggestionCategory[] = [
  'POS', 'Inventory', 'Sales', 'Purchasing', 'Repairs', 'Customers', 'Suppliers',
  'Accounting', 'Reports', 'Dashboard', 'Mobile App', 'Printing', 'Barcode',
  'Integrations', 'Performance', 'Security', 'Other',
]

const STATUS_FLOW: FeatureSuggestionStatus[] = [
  'NEW', 'UNDER_REVIEW', 'PLANNED', 'IN_PROGRESS', 'RELEASED',
]

const STATUS_STYLE: Record<FeatureSuggestionStatus, string> = {
  NEW: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  UNDER_REVIEW: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  PLANNED: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
  IN_PROGRESS: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  RELEASED: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  DECLINED: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
}

const PRIORITY_STYLE: Record<FeatureSuggestionPriority, string> = {
  LOW: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/25',
  MEDIUM: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  HIGH: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
  CRITICAL: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
}

function statusLabel(s: FeatureSuggestionStatus): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-LK', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch {
    return iso
  }
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${className}`}>
      {label}
    </span>
  )
}

function NewSuggestionModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [category, setCategory] = useState<FeatureSuggestionCategory | ''>('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const titleLen = title.trim().length
  const descLen = description.trim().length

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    // Keep the button clickable and explain exactly what is missing instead
    // of silently disabling it.
    if (!category) { toast.error('Select a category'); return }
    if (titleLen < 10) { toast.error('Title must be at least 10 characters'); return }
    if (titleLen > 120) { toast.error('Title must be at most 120 characters'); return }
    if (descLen < 30) { toast.error('Description must be at least 30 characters'); return }
    if (descLen > 5000) { toast.error('Description must be at most 5000 characters'); return }
    setSubmitting(true)
    try {
      await featureSuggestionsApi.create({
        category,
        title: title.trim(),
        description: description.trim(),
      })
      toast.success('Suggestion submitted')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl shadow-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--brand-glow)', border: '1px solid var(--sidebar-active-border)' }}>
              <Lightbulb size={14} style={{ color: 'var(--brand-primary-light)' }} />
            </div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>New Suggestion</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}><X size={15} /></button>
        </div>
        <form onSubmit={handleSubmit} noValidate className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Category *</label>
            <select
              required
              className="input-field"
              value={category}
              onChange={(e) => setCategory(e.target.value as FeatureSuggestionCategory | '')}
            >
              <option value="">Select a category</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Title *</label>
              <span className="text-[11px]" style={{ color: titleLen > 0 && (titleLen < 10 || titleLen > 120) ? '#e11d48' : 'var(--text-muted)' }}>
                {titleLen}/120
              </span>
            </div>
            <input
              required
              className="input-field"
              placeholder="Describe your idea in one short line"
              minLength={10}
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Description *</label>
              <span className="text-[11px]" style={{ color: descLen > 0 && (descLen < 30 || descLen > 5000) ? '#e11d48' : 'var(--text-muted)' }}>
                {descLen}/5000
              </span>
            </div>
            <textarea
              required
              className="input-field resize-y min-h-[120px]"
              placeholder="Explain the problem, who it helps, and what success looks like (min 30 characters)"
              minLength={30}
              maxLength={5000}
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DetailModal({
  suggestion,
  loading,
  onClose,
}: {
  suggestion: FeatureSuggestion | null
  loading: boolean
  onClose: () => void
}) {
  if (!suggestion && !loading) return null

  const isDeclined = suggestion?.status === 'DECLINED'
  const isReleased = suggestion?.status === 'RELEASED'
  const currentIdx = suggestion
    ? STATUS_FLOW.indexOf(
        suggestion.status === 'DECLINED' ? 'NEW' : suggestion.status === 'RELEASED' ? 'RELEASED' : suggestion.status,
      )
    : -1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl border animate-in fade-in zoom-in-95 duration-200"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
        role="dialog"
        aria-modal="true"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--brand-glow)', border: '1px solid var(--sidebar-active-border)' }}>
              <Lightbulb size={14} style={{ color: 'var(--brand-primary-light)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Suggestion detail</p>
              <h2 className="text-sm font-bold mt-0.5 truncate">{suggestion?.title ?? 'Loading…'}</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg transition-colors flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
            <X size={15} />
          </button>
        </div>

        {loading || !suggestion ? (
          <div className="p-5 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--bg-subtle)' }} />
            ))}
          </div>
        ) : (
          <div className="p-5 space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge label={statusLabel(suggestion.status)} className={STATUS_STYLE[suggestion.status]} />
              <Badge label={suggestion.priority} className={PRIORITY_STYLE[suggestion.priority]} />
              <Badge label={suggestion.category} className="bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20" />
            </div>

            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>Description</p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                {suggestion.description}
              </p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>Progress</p>
              {isDeclined ? (
                <div className="flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400">
                  <XCircle size={16} /> Declined
                </div>
              ) : (
                <ol className="space-y-0">
                  {STATUS_FLOW.map((step, idx) => {
                    const done = idx <= currentIdx || (isReleased && step === 'RELEASED')
                    const active = suggestion.status === step
                    return (
                      <li key={step} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                            done
                              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                              : 'border-[var(--border-default)]'
                          }`} style={!done ? { color: 'var(--text-muted)' } : undefined}>
                            {done ? <CheckCircle2 size={12} /> : idx + 1}
                          </div>
                          {idx < STATUS_FLOW.length - 1 && (
                            <div className={`w-px flex-1 min-h-[18px] ${done && idx < currentIdx ? 'bg-emerald-500/40' : ''}`}
                              style={!done || idx >= currentIdx ? { background: 'var(--border-subtle)' } : undefined} />
                          )}
                        </div>
                        <div className={`pb-4 text-sm ${active ? 'font-semibold' : ''}`} style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {statusLabel(step)}
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </div>

            {suggestion.publicResponse && (
              <div className="rounded-xl border p-4" style={{ borderColor: 'var(--sidebar-active-border)', background: 'var(--brand-glow)' }}>
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>Admin response</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                  {suggestion.publicResponse}
                </p>
              </div>
            )}

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>History</p>
              <div className="space-y-3">
                {(suggestion.history ?? []).length === 0 && (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No history yet.</p>
                )}
                {(suggestion.history ?? []).map((h) => (
                  <div key={h.id} className="flex gap-3 text-sm">
                    <Clock size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <div>
                      <p style={{ color: 'var(--text-primary)' }}>
                        {h.action.replace(/_/g, ' ')}
                        {h.newStatus ? ` → ${statusLabel(h.newStatus)}` : ''}
                        {h.newPriority ? ` → ${h.newPriority}` : ''}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {formatDate(h.createdAt)} · {h.performedByEmail}
                      </p>
                      {h.publicResponse && (
                        <p className="text-xs mt-1 whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{h.publicResponse}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs pt-3 border-t" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
              <div>Created<br /><span style={{ color: 'var(--text-secondary)' }}>{formatDate(suggestion.createdAt)}</span></div>
              <div>Updated<br /><span style={{ color: 'var(--text-secondary)' }}>{formatDate(suggestion.updatedAt)}</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FeatureSuggestionsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [showNew, setShowNew] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const [items, setItems] = useState<FeatureSuggestion[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<FeatureSuggestion | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const limit = 20
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const loadList = useCallback(async (p = 1) => {
    setLoading(true)
    setListError(null)
    try {
      const res = await featureSuggestionsApi.list({ page: p, limit })
      setItems(res.data ?? [])
      setTotal(res.meta?.total ?? 0)
      setPage(res.meta?.page ?? p)
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Failed to load suggestions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadList(1) }, [loadList])

  const openDetail = useCallback(async (id: string) => {
    setSelectedId(id)
    setDetailLoading(true)
    try {
      const res = await featureSuggestionsApi.getById(id)
      setDetail(res.data)
      const params = new URLSearchParams(searchParams.toString())
      params.set('id', id)
      router.replace(`?${params.toString()}`, { scroll: false })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load suggestion')
      setSelectedId(null)
    } finally {
      setDetailLoading(false)
    }
  }, [router, searchParams])

  const closeDetail = useCallback(() => {
    setSelectedId(null)
    setDetail(null)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('id')
    const qs = params.toString()
    router.replace(qs ? `?${qs}` : '?', { scroll: false })
  }, [router, searchParams])

  useEffect(() => {
    const id = searchParams.get('id')
    if (id && id !== selectedId) void openDetail(id)
  }, [searchParams, selectedId, openDetail])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false
      if (categoryFilter !== 'all' && row.category !== categoryFilter) return false
      if (q && !`${row.title} ${row.category}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [items, search, statusFilter, categoryFilter])

  const inProgressCount = items.filter((s) => ['UNDER_REVIEW', 'PLANNED', 'IN_PROGRESS'].includes(s.status)).length
  const releasedCount = items.filter((s) => s.status === 'RELEASED').length
  const newCount = items.filter((s) => s.status === 'NEW').length

  const skeletonRows = useMemo(() => Array.from({ length: 4 }, (_, i) => i), [])

  return (
    <div className="space-y-6">
      {showNew && (
        <NewSuggestionModal onClose={() => setShowNew(false)} onSaved={() => void loadList(1)} />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Feature Suggestions</h1>
          <p className="page-subtitle">Share ideas to improve Hexalyte · track status and admin responses</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="btn-primary flex items-center gap-2 sm:ml-auto"
        >
          <Plus size={14} /> New Suggestion
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Suggestions',
            value: String(total),
            icon: <ListChecks size={16} />,
            color: 'var(--brand-primary-light)',
            bg: 'var(--brand-glow)',
            border: 'var(--sidebar-active-border)',
          },
          {
            label: 'New',
            value: String(newCount),
            icon: <Lightbulb size={16} />,
            color: '#0369a1',
            bg: 'rgba(3,105,161,0.08)',
            border: 'rgba(3,105,161,0.20)',
          },
          {
            label: 'In Progress',
            value: String(inProgressCount),
            icon: <Hourglass size={16} />,
            color: '#b45309',
            bg: 'rgba(180,83,9,0.08)',
            border: 'rgba(180,83,9,0.20)',
          },
          {
            label: 'Released',
            value: String(releasedCount),
            icon: <Rocket size={16} />,
            color: '#15803d',
            bg: 'rgba(21,128,61,0.08)',
            border: 'rgba(21,128,61,0.20)',
          },
        ].map(({ label, value, icon, color, bg, border }) => (
          <div key={label} className="card p-4" style={{ borderColor: border, background: bg }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ color, background: bg, border: `1px solid ${border}` }}
              >
                {icon}
              </div>
            </div>
            <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <ToolbarSearch
          value={search}
          onChange={setSearch}
          placeholder="Search suggestions…"
          className="flex-1"
        />
        <select className="input-field sm:w-44" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {[...STATUS_FLOW, 'DECLINED' as FeatureSuggestionStatus].map((s) => (
            <option key={s} value={s}>{statusLabel(s)}</option>
          ))}
        </select>
        <select className="input-field sm:w-44" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          type="button"
          onClick={() => void loadList(page)}
          className="btn-secondary flex items-center justify-center gap-2 text-sm sm:w-auto"
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="card overflow-hidden">
        {listError && (
          <div className="flex items-center gap-2 px-4 py-4 text-sm text-rose-600 dark:text-rose-400">
            <AlertCircle size={16} /> {listError}
          </div>
        )}

        {loading ? (
          <div className="p-4 space-y-2">
            {skeletonRows.map((i) => (
              <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: 'var(--bg-subtle)' }} />
            ))}
          </div>
        ) : filtered.length === 0 && !listError ? (
          <div className="py-12 text-center">
            <Lightbulb size={28} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {items.length === 0 ? 'No suggestions yet' : 'No suggestions match your filters'}
            </p>
            {items.length === 0 && (
              <button onClick={() => setShowNew(true)} className="btn-primary mt-4 inline-flex items-center gap-2 text-sm">
                <Plus size={14} /> Submit your first idea
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Title', 'Category', 'Status', 'Priority', 'Created', 'Updated', ''].map((h, i) => (
                    <th
                      key={`${h}-${i}`}
                      className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-white/2 transition-colors cursor-pointer"
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    onClick={() => void openDetail(row.id)}
                  >
                    <td className="px-4 py-3 max-w-[280px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}
                        >
                          <Lightbulb size={14} style={{ color: 'var(--text-muted)' }} />
                        </div>
                        <span className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{row.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{row.category}</td>
                    <td className="px-4 py-3"><Badge label={statusLabel(row.status)} className={STATUS_STYLE[row.status]} /></td>
                    <td className="px-4 py-3"><Badge label={row.priority} className={PRIORITY_STYLE[row.priority]} /></td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{formatDate(row.createdAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{formatDate(row.updatedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); void openDetail(row.id) }}
                        className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors hover:bg-white/5"
                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                      >
                        <Eye size={13} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-xs" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => void loadList(page - 1)}
                className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => void loadList(page + 1)}
                className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {(selectedId || detailLoading) && (
        <DetailModal
          suggestion={detail}
          loading={detailLoading}
          onClose={closeDetail}
        />
      )}
    </div>
  )
}

export default function FeatureSuggestionsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-4">
        <div className="h-8 w-48 rounded-lg animate-pulse" style={{ background: 'var(--bg-subtle)' }} />
        <div className="h-64 rounded-2xl animate-pulse" style={{ background: 'var(--bg-subtle)' }} />
      </div>
    }>
      <FeatureSuggestionsContent />
    </Suspense>
  )
}
