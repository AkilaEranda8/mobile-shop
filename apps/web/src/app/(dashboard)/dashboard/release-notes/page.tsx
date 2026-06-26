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
  NEW: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  IMPROVED: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  FIXED: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  SECURITY: 'bg-red-500/15 text-red-600 border-red-500/30',
  COMING_SOON: 'bg-violet-500/15 text-violet-600 border-violet-500/30',
  PREMIUM: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30',
}

function fmtDate(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-LK', { day: 'numeric', month: 'long', year: 'numeric' })
}

function ItemBadge({ badge }: { badge: string | null }) {
  if (!badge) return null
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${BADGE_STYLES[badge] ?? 'bg-gray-500/10 text-gray-500'}`}>
      {badge.replace('_', ' ')}
    </span>
  )
}

function ReleaseItemCard({ item }: { item: ReleaseItem }) {
  return (
    <div className="card p-4" style={{ background: 'var(--bg-card)' }}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.featureName}</h4>
            <ItemBadge badge={item.badge} />
          </div>
          {item.module && (
            <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
              {item.module}
            </p>
          )}
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{item.description}</p>
          {(item.docUrl || item.videoUrl) && (
            <div className="flex gap-3 mt-2">
              {item.docUrl && (
                <a href={item.docUrl} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] flex items-center gap-1 text-violet-500 hover:underline">
                  <ExternalLink size={10} /> Docs
                </a>
              )}
              {item.videoUrl && (
                <a href={item.videoUrl} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] flex items-center gap-1 text-violet-500 hover:underline">
                  <Play size={10} /> Demo
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
        const listData = listRes?.data ?? listRes ?? []
        const list = Array.isArray(listData) ? listData : listData.data ?? []
        setReleases(list)
        const lat = latestRes?.data ?? latestRes
        setLatest(lat ?? null)

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
      const detail = res?.data ?? res
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
    <div className="space-y-5 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Sparkles size={22} className="text-violet-500" />
            Release Notes
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            What&apos;s new in Hexalyte — features, fixes, and improvements
          </p>
        </div>
        <div className="sm:ml-auto flex gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              className="input-field text-sm pl-8 w-52"
              placeholder="Search releases..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button onClick={loadList} disabled={loading} className="btn-secondary text-sm">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filter === f.key
                ? 'bg-violet-500 text-white border-violet-500'
                : 'border-transparent hover:border-violet-500/30'
            }`}
            style={filter !== f.key ? { color: 'var(--text-secondary)', background: 'var(--bg-card)' } : undefined}
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
        <div className="card p-5 border-l-4 border-l-violet-500" style={{ background: 'var(--bg-card)' }}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-500">
                  Latest Release
                </span>
                <span className="text-xs font-mono font-semibold" style={{ color: 'var(--text-muted)' }}>v{latest.version}</span>
                {latest.isRead && (
                  <span className="text-[10px] flex items-center gap-1 text-emerald-500">
                    <CheckCircle2 size={10} /> Read
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{latest.title}</h2>
              <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>{latest.summary}</p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{fmtDate(latest.releaseDate)}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Features', value: latest.counts.newFeatures, icon: Sparkles, color: 'text-emerald-500' },
                { label: 'Improvements', value: latest.counts.improvements, icon: Zap, color: 'text-blue-500' },
                { label: 'Bug Fixes', value: latest.counts.bugFixes, icon: Bug, color: 'text-amber-500' },
                { label: 'Security', value: latest.counts.securityUpdates, icon: Shield, color: 'text-red-500' },
              ].map(s => (
                <div key={s.label} className="text-center p-3 rounded-xl" style={{ background: 'var(--bg-primary)' }}>
                  <s.icon size={16} className={`${s.color} mx-auto mb-1`} />
                  <p className="text-lg font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
                  <p className="text-[9px] mt-0.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {displayRelease ? (
            <>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  v{displayRelease.version} — {displayRelease.title}
                </h3>
                {displayRelease.isRead && (
                  <span className="text-[10px] flex items-center gap-1 text-emerald-500">
                    <CheckCircle2 size={10} /> Read {displayRelease.readAt ? `· ${fmtDate(displayRelease.readAt)}` : ''}
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
                      <Icon size={16} className="text-violet-500" />
                      <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</h4>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
                        {items.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {items.map(item => <ReleaseItemCard key={item.id} item={item} />)}
                    </div>
                  </div>
                )
              })}

              {filteredItems.length === 0 && (
                <div className="card p-8 text-center">
                  <Wrench size={24} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No items match this filter.</p>
                </div>
              )}
            </>
          ) : !loading && (
            <div className="card p-12 text-center">
              <Sparkles size={32} className="mx-auto mb-3 opacity-20" />
              <p style={{ color: 'var(--text-muted)' }}>No release notes available yet.</p>
            </div>
          )}
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>
            Release History
          </h4>
          <div className="space-y-2">
            {releases.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => selectRelease(r)}
                className={`w-full text-left card p-3 card-hover transition-all ${
                  selected?.id === r.id ? 'ring-2 ring-violet-500/50' : ''
                }`}
                style={{ background: 'var(--bg-card)' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold" style={{ color: 'var(--text-primary)' }}>v{r.version}</span>
                      {!r.isRead && (
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />
                      )}
                      {r.isRead && <CheckCircle2 size={10} className="text-emerald-500 flex-shrink-0" />}
                    </div>
                    <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{fmtDate(r.releaseDate)}</p>
                    <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{r.summary}</p>
                  </div>
                  <ChevronRight size={14} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                </div>
              </button>
            ))}
            {releases.length === 0 && !loading && (
              <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>No history yet</p>
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
