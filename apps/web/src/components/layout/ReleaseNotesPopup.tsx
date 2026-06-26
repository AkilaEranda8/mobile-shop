'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, X, ArrowRight } from 'lucide-react'
import { releaseNotesApi, type ReleasePopup } from '@/lib/api'

const SESSION_KEY = 'release_popup_dismissed'

export function ReleaseNotesPopup() {
  const router = useRouter()
  const [release, setRelease] = useState<ReleasePopup | null>(null)

  const load = useCallback(() => {
    releaseNotesApi.unreadPopup()
      .then((r: any) => {
        const data = r?.data ?? r
        if (!data?.id) { setRelease(null); return }
        const dismissed = sessionStorage.getItem(`${SESSION_KEY}_${data.id}`)
        if (dismissed) { setRelease(null); return }
        setRelease(data)
      })
      .catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  if (!release) return null

  function handleLater() {
    sessionStorage.setItem(`${SESSION_KEY}_${release!.id}`, '1')
    setRelease(null)
  }

  function handleView() {
    sessionStorage.setItem(`${SESSION_KEY}_${release!.id}`, '1')
    setRelease(null)
    router.push(`/dashboard/release-notes?release=${release!.id}`)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="p-5 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'rgba(139,92,246,0.08)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-violet-500/20 flex items-center justify-center">
                <Sparkles size={18} className="text-violet-500" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-500">What&apos;s New</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>v{release.version}</p>
              </div>
            </div>
            <button type="button" onClick={handleLater} className="p-1 rounded-lg hover:bg-black/5" style={{ color: 'var(--text-muted)' }}>
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="p-5">
          <h3 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{release.title}</h3>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{release.summary}</p>
          <div className="flex gap-2 mt-5">
            <button type="button" onClick={handleLater} className="btn-secondary text-sm flex-1">Later</button>
            <button type="button" onClick={handleView} className="btn-primary text-sm flex-1 flex items-center justify-center gap-1.5">
              View Updates <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
