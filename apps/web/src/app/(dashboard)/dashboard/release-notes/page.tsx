'use client'

import { useCallback, useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Sparkles, Search, RefreshCw, CheckCircle2, Shield, Wrench, Zap,
  Bug, Clock, Star, ChevronRight, ExternalLink, Play,
} from 'lucide-react'
import { releaseNotesApi, type ReleaseNote, type ReleaseItem } from '@/lib/api'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'features', label: 'Features' },
  { key: 'improvements', label: 'Improvements' },
  { key: 'bug-fixes', label: 'Bug Fixes' },
  { key: 'security', label: 'Security' },
  { key: 'coming-soon', label: 'Coming Soon' },
]

const CATEGORY_LABELS: Record<string, string> = {
  NEW_FEATURE: 'New Features',
  IMPROVEMENT: 'Improvements',
  BUG_FIX: 'Bug Fixes',
  SECURITY: 'Security Updates',
  COMING_SOON: 'Coming Soon',
}

const CATEGORY_ICONS: Record<string, typeof Sparkles> = {
  NEW_FEATURE: Sparkles,
  IMPROVEMENT: Zap,
  BUG_FIX: Bug,
  SECURITY: Shield,
  COMING_SOON: Clock,
}

const BADGE_STYLES: Record<string, string> = {
  NEW: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  IMPROVED: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
  FIXED: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  SECURITY: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
  COMING_SOON: 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30',
  PREMIUM: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
}

function fmtDate(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-LK', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Unwrap `{ success, data }` — `data: null` must stay null (not fall back to the envelope). */
function unwrapApiData<T>(res: unknown): T | null {
  if (res != null && typeof res === 'object' && 'data' in res) {
    return ((res as { data: T | null }).data ?? null) as T | null
  }
  return (res as T) ?? null
}

function ItemBadge({ badge }: { badge: string | null }) {
  if (!badge) return null
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${BADGE_STYLES[badge] ?? 'bg-gray-500/10 text-gray-600 dark:text-gray-400'}`}>
      {badge.replace('_', ' ')}
    </span>
  )
}

function ReleaseItemCard({ item }: { item: ReleaseItem }) {
  return (
    <div className="card p-4 hover:border-violet-500/20 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.featureName}</h4>
            <ItemBadge badge={item.badge} />
          </div>
          {item.module && (
            <p className="text-xs font-medium uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>
              {item.module}
            </p>
          )}
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{item.description}</p>
          {(item.docUrl || item.videoUrl) && (
            <div className="flex gap-3 mt-3">
              {item.docUrl && (
                <a href={item.docUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs flex items-center gap-1 text-violet-500 hover:underline">
                  <ExternalLink size={12} /> Docs
                </a>
              )}
              {item.videoUrl && (
                <a href={item.videoUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs flex items-center gap-1 text-violet-500 hover:underline">
                  <Play size={12} /> Demo
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function groupItems(items: ReleaseItem[]) {
  const groups: Record<string, ReleaseItem[]> = {}
  for (const item of items) {
    if (!groups[item.category]) groups[item.category] = []
    groups[item.category].push(item)
  }
  return groups
}

function ReleaseNotesContent() {
  const searchParams = useSearchParams()
  const [releases, setReleases] = useState<ReleaseNote[]>([])
  const [latest, setLatest] = useState<ReleaseNote | null>(null)
  const [selected, setSelected] = useState<ReleaseNote | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const loadList = useCallback(() => {
    setLoading(true)
    Promise.all([
      releaseNotesApi.list({ search: search || undefined, category: filter !== 'all' ? filter : undefined }),
      releaseNotesApi.latest(),
    ])
      .then(([listRes, latestRes]: any[]) => {
        const list = unwrapApiData<ReleaseNote[]>(listRes) ?? []
        setReleases(list)
        setLatest(unwrapApiData<ReleaseNote>(latestRes))

        const preselect = searchParams.get('release')
        if (preselect) {
          const found = list.find((r: ReleaseNote) => r.id === preselect)
          if (found) setSelected(found)
        } else if (!selected && list.length) {
          setSelected(list[0])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [search, filter, searchParams])

  useEffect(() => { loadList() }, [loadList])

  async function selectRelease(release: ReleaseNote) {
    setSelected(release)
    try {
      const res: any = await releaseNotesApi.getById(release.id, filter !== 'all' ? filter : undefined)
      const detail = unwrapApiData<ReleaseNote>(res)
      if (!detail) return
      setSelected(detail)
      if (!detail.isRead) {
        await releaseNotesApi.markRead(release.id)
        setSelected({ ...detail, isRead: true, readAt: new Date().toISOString() })
        setReleases(prev => prev.map(r => r.id === release.id ? { ...r, isRead: true } : r))
        if (latest?.id === release.id) setLatest({ ...latest, isRead: true })
      }
    } catch { /* keep list version */ }
  }

  const displayRelease = selected ?? latest
  const filteredItems = displayRelease?.items ?? []
  const grouped = groupItems(filteredItems)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Sparkles size={24} className="text-violet-500" />
            Release Notes
          </h1>
          <p className="page-subtitle">
            What&apos;s new in Hexalyte — features, fixes, and improvements
          </p>
        </div>
        <div className="sm:ml-auto flex gap-2 flex-wrap">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              className="input-field pl-9 w-56"
              placeholder="Search releases..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button onClick={loadList} disabled={loading} className="btn-secondary text-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-colors ${
              filter === f.key
                ? 'bg-violet-600 text-white shadow-sm'
                : 'hover:bg-white/5'
            }`}
            style={filter !== f.key ? { color: 'var(--text-secondary)' } : undefined}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && !displayRelease && (
        <div className="card p-12 text-center">
          <RefreshCw size={18} className="animate-spin mx-auto" style={{ color: 'var(--text-muted)' }} />
        </div>
      )}

      {latest && (
        <div className="card p-6 border-l-4 border-l-violet-500">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-violet-500/15 text-violet-500">
                  Latest Release
                </span>
                <span className="text-sm font-mono font-semibold" style={{ color: 'var(--text-muted)' }}>v{latest.version}</span>
                {latest.isRead && (
                  <span className="text-xs flex items-center gap-1 text-emerald-500">
                    <CheckCircle2 size={12} /> Read
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{latest.title}</h2>
              <p className="text-sm mb-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{latest.summary}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(latest.releaseDate)}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full sm:w-auto">
              {[
                { label: 'Features', value: latest.counts?.newFeatures ?? 0, icon: Sparkles, color: 'text-emerald-500' },
                { label: 'Improvements', value: latest.counts?.improvements ?? 0, icon: Zap, color: 'text-blue-500' },
                { label: 'Bug Fixes', value: latest.counts?.bugFixes ?? 0, icon: Bug, color: 'text-amber-500' },
                { label: 'Security', value: latest.counts?.securityUpdates ?? 0, icon: Shield, color: 'text-red-500' },
              ].map(s => (
                <div key={s.label} className="text-center p-4 rounded-xl" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                  <s.icon size={18} className={`${s.color} mx-auto mb-1.5`} />
                  <p className="text-xl font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
                  <p className="text-xs mt-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {displayRelease ? (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  v{displayRelease.version} — {displayRelease.title}
                </h3>
                {displayRelease.isRead && (
                  <span className="text-xs flex items-center gap-1 text-emerald-500">
                    <CheckCircle2 size={12} /> Read {displayRelease.readAt ? `· ${fmtDate(displayRelease.readAt)}` : ''}
                  </span>
                )}
              </div>

              {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
                const items = grouped[cat]
                if (!items?.length) return null
                if (filter !== 'all') {
                  const filterCat = FILTERS.find(f => f.key === filter)
                  if (filterCat && label !== CATEGORY_LABELS[cat]) { /* handled by API */ }
                }
                const Icon = CATEGORY_ICONS[cat] ?? Star
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon size={18} className="text-violet-500" />
                      <h4 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</h4>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
                        {items.length}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {items.map(item => <ReleaseItemCard key={item.id} item={item} />)}
                    </div>
                  </div>
                )
              })}

              {filteredItems.length === 0 && (
                <div className="card p-10 text-center">
                  <Wrench size={28} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No items match this filter.</p>
                </div>
              )}
            </>
          ) : !loading && (
            <div className="card p-12 text-center">
              <Sparkles size={36} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No release notes available yet.</p>
            </div>
          )}
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>
            Release History
          </h4>
          <div className="space-y-2">
            {releases.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => selectRelease(r)}
                className={`w-full text-left card p-4 card-hover transition-all ${
                  selected?.id === r.id ? 'ring-2 ring-violet-500/50 border-violet-500/30' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-bold" style={{ color: 'var(--text-primary)' }}>v{r.version}</span>
                      {!r.isRead && (
                        <span className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0" />
                      )}
                      {r.isRead && <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0" />}
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{fmtDate(r.releaseDate)}</p>
                    <p className="text-sm mt-1.5 line-clamp-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{r.summary}</p>
                  </div>
                  <ChevronRight size={16} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                </div>
              </button>
            ))}
            {releases.length === 0 && !loading && (
              <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>No history yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ReleaseNotesPage() {
  return (
    <Suspense fallback={
      <div className="card p-12 text-center">
        <RefreshCw size={18} className="animate-spin mx-auto" style={{ color: 'var(--text-muted)' }} />
      </div>
    }>
      <ReleaseNotesContent />
    </Suspense>
  )
}
