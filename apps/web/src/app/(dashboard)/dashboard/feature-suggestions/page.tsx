'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Lightbulb, Send, X, Clock, CheckCircle2, XCircle, Loader2,
  ChevronRight, Eye, AlertCircle, RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
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

function DetailDrawer({
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
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close drawer"
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside
        className="relative w-full max-w-lg h-full overflow-y-auto shadow-2xl border-l animate-in slide-in-from-right duration-200"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Suggestion detail</p>
            <h2 className="text-base font-semibold mt-0.5 line-clamp-1">{suggestion?.title ?? 'Loading…'}</h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {loading || !suggestion ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--bg-subtle)' }} />
            ))}
          </div>
        ) : (
          <div className="p-5 space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge label={statusLabel(suggestion.status)} className={STATUS_STYLE[suggestion.status]} />
              <Badge label={suggestion.priority} className={PRIORITY_STYLE[suggestion.priority]} />
              <Badge label={suggestion.category} className="bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20" />
            </div>

            <div>
              <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Description</p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                {suggestion.description}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>Progress</p>
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
              <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-subtle)' }}>
                <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Admin response</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                  {suggestion.publicResponse}
                </p>
              </div>
            )}

            <div>
              <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>History</p>
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

            <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
              <div>Created<br /><span style={{ color: 'var(--text-secondary)' }}>{formatDate(suggestion.createdAt)}</span></div>
              <div>Updated<br /><span style={{ color: 'var(--text-secondary)' }}>{formatDate(suggestion.updatedAt)}</span></div>
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}

function FeatureSuggestionsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [category, setCategory] = useState<FeatureSuggestionCategory | ''>('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

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

  const titleLen = title.trim().length
  const descLen = description.trim().length
  const canSubmit = Boolean(category) && titleLen >= 10 && titleLen <= 120 && descLen >= 30 && descLen <= 5000 && !submitting

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || !category) return
    setSubmitting(true)
    try {
      await featureSuggestionsApi.create({
        category,
        title: title.trim(),
        description: description.trim(),
      })
      toast.success('Suggestion submitted')
      setCategory('')
      setTitle('')
      setDescription('')
      await loadList(1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  const skeletonRows = useMemo(() => Array.from({ length: 4 }, (_, i) => i), [])

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Lightbulb size={20} style={{ color: 'var(--text-primary)' }} />
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Feature Suggestions</h1>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Share ideas to improve Hexalyte. Track status and admin responses here.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border p-5 sm:p-6 space-y-4 shadow-sm"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
      >
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as FeatureSuggestionCategory | '')}
            required
            className="w-full h-10 rounded-xl border px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/30"
            style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
          >
            <option value="">Select a category</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Title</label>
            <span className="text-[11px]" style={{ color: titleLen > 0 && (titleLen < 10 || titleLen > 120) ? '#e11d48' : 'var(--text-muted)' }}>
              {titleLen}/120
            </span>
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Describe your idea in one short line"
            minLength={10}
            maxLength={120}
            required
            className="w-full h-10 rounded-xl border px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/30"
            style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Description</label>
            <span className="text-[11px]" style={{ color: descLen > 0 && (descLen < 30 || descLen > 5000) ? '#e11d48' : 'var(--text-muted)' }}>
              {descLen}/5000
            </span>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Explain the problem, who it helps, and what success looks like (min 30 characters)"
            minLength={30}
            maxLength={5000}
            required
            rows={5}
            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 resize-y min-h-[120px]"
            style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50 btn-accent"
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {submitting ? 'Submitting…' : 'Submit suggestion'}
          </button>
        </div>
      </form>

      <section
        className="rounded-2xl border shadow-sm overflow-hidden"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>My Suggestions</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{total} total</p>
          </div>
          <button
            type="button"
            onClick={() => void loadList(page)}
            className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {listError && (
          <div className="flex items-center gap-2 px-5 py-4 text-sm text-rose-600 dark:text-rose-400">
            <AlertCircle size={16} /> {listError}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs border-b" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Priority</th>
                <th className="px-3 py-3 font-medium">Category</th>
                <th className="px-3 py-3 font-medium">Title</th>
                <th className="px-3 py-3 font-medium hidden sm:table-cell">Created</th>
                <th className="px-3 py-3 font-medium hidden md:table-cell">Updated</th>
                <th className="px-5 py-3 font-medium text-right">View</th>
              </tr>
            </thead>
            <tbody>
              {loading && skeletonRows.map((i) => (
                <tr key={i} className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                  <td colSpan={7} className="px-5 py-3">
                    <div className="h-8 rounded-lg animate-pulse" style={{ background: 'var(--bg-subtle)' }} />
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 && !listError && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No suggestions yet</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Submit your first idea using the form above.</p>
                  </td>
                </tr>
              )}
              {!loading && items.map((row) => (
                <tr key={row.id} className="border-b hover:bg-black/[0.02] dark:hover:bg-white/[0.02]" style={{ borderColor: 'var(--border-subtle)' }}>
                  <td className="px-5 py-3"><Badge label={statusLabel(row.status)} className={STATUS_STYLE[row.status]} /></td>
                  <td className="px-3 py-3"><Badge label={row.priority} className={PRIORITY_STYLE[row.priority]} /></td>
                  <td className="px-3 py-3" style={{ color: 'var(--text-secondary)' }}>{row.category}</td>
                  <td className="px-3 py-3 max-w-[220px]">
                    <span className="line-clamp-1 font-medium" style={{ color: 'var(--text-primary)' }}>{row.title}</span>
                  </td>
                  <td className="px-3 py-3 hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>{formatDate(row.createdAt)}</td>
                  <td className="px-3 py-3 hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>{formatDate(row.updatedAt)}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => void openDetail(row.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border hover:bg-black/5 dark:hover:bg-white/5"
                      style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                    >
                      <Eye size={13} /> View <ChevronRight size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t text-xs" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => void loadList(page - 1)}
                className="px-3 py-1.5 rounded-lg border disabled:opacity-40"
                style={{ borderColor: 'var(--border-default)' }}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => void loadList(page + 1)}
                className="px-3 py-1.5 rounded-lg border disabled:opacity-40"
                style={{ borderColor: 'var(--border-default)' }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {(selectedId || detailLoading) && (
        <DetailDrawer
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
      <div className="space-y-4 max-w-6xl mx-auto">
        <div className="h-8 w-48 rounded-lg animate-pulse" style={{ background: 'var(--bg-subtle)' }} />
        <div className="h-64 rounded-2xl animate-pulse" style={{ background: 'var(--bg-subtle)' }} />
      </div>
    }>
      <FeatureSuggestionsContent />
    </Suspense>
  )
}
