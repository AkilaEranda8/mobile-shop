'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import {
  compareSemver,
  fetchDesktopVersionManifest,
  getHexalyteDesktopBridge,
  resolveDesktopDownloadHref,
  type DesktopVersionManifest,
} from '@/lib/desktop-version'
import { startDesktopDownload } from '@/components/DesktopDownloadOverlay'

const DISMISS_KEY = 'hx_desktop_update_dismissed'

export function DesktopUpdateBanner() {
  const [manifest, setManifest] = useState<DesktopVersionManifest | null>(null)
  const [currentVersion, setCurrentVersion] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const bridge = getHexalyteDesktopBridge()
    if (!bridge) return

    let cancelled = false
    void (async () => {
      const remote = await fetchDesktopVersionManifest()
      if (cancelled || !remote?.version) return

      let local = (bridge.version || '').trim()
      if (!local && typeof bridge.getVersion === 'function') {
        try {
          local = String(await bridge.getVersion()).trim()
        } catch {
          local = ''
        }
      }
      // Shells without version (older builds) count as outdated.
      if (!local) local = '0.0.0'
      if (compareSemver(local, remote.version) >= 0) return

      try {
        const dismissed = sessionStorage.getItem(DISMISS_KEY)
        if (dismissed === remote.version) return
      } catch {
        /* ignore */
      }

      setCurrentVersion(local === '0.0.0' ? null : local)
      setManifest(remote)
      setVisible(true)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  if (!visible || !manifest) return null

  const href = resolveDesktopDownloadHref(manifest)
  const message =
    manifest.message?.trim() ||
    'A new Hexalyte desktop update is available. Please install it to continue.'

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-xl rounded-xl border px-4 py-3 shadow-lg sm:left-auto"
      style={{
        background: 'var(--bg-elevated, #0f172a)',
        borderColor: 'rgba(37, 99, 235, 0.45)',
        color: 'var(--text-primary, #f8fafc)',
      }}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Desktop update available</p>
          <p className="mt-1 text-xs opacity-80 leading-relaxed">
            {message}
            {currentVersion ? (
              <span className="opacity-70">
                {' '}
                (you have v{currentVersion} → v{manifest.version})
              </span>
            ) : (
              <span className="opacity-70"> (latest v{manifest.version})</span>
            )}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                startDesktopDownload({
                  url: href,
                  version: manifest.version,
                  label: 'Hexalyte Desktop update',
                })
              }
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
              style={{ background: 'var(--brand-primary, #2563eb)' }}
            >
              <Download size={13} />
              Install update
            </button>
            <button
              type="button"
              className="text-xs font-medium opacity-70 hover:opacity-100"
              onClick={() => {
                try {
                  sessionStorage.setItem(DISMISS_KEY, manifest.version)
                } catch {
                  /* ignore */
                }
                setVisible(false)
              }}
            >
              Later
            </button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          className="shrink-0 opacity-60 hover:opacity-100"
          onClick={() => {
            try {
              sessionStorage.setItem(DISMISS_KEY, manifest.version)
            } catch {
              /* ignore */
            }
            setVisible(false)
          }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
