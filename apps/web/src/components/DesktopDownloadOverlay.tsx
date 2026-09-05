'use client'

import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Monitor, X } from 'lucide-react'
import { getDesktopDownloadUrl } from '@/lib/desktop-download'
import { getHexalyteDesktopBridge } from '@/lib/desktop-version'

export const DESKTOP_DOWNLOAD_EVENT = 'hx-desktop-download'
export const DESKTOP_UPDATE_PROGRESS_EVENT = 'hx-desktop-update-progress'

export type DesktopDownloadDetail = {
  url?: string
  version?: string
  label?: string
}

type UpdateProgressDetail = {
  phase?: 'downloading' | 'installing' | 'error' | string
  progress?: number
  version?: string
  label?: string
  message?: string
}

/** Open the animated desktop installer download / auto-update experience. */
export function startDesktopDownload(detail?: DesktopDownloadDetail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(DESKTOP_DOWNLOAD_EVENT, { detail: detail ?? {} }))
}

function triggerBrowserDownload(url: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = 'Hexalyte-Setup.exe'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

type Phase = 'intro' | 'downloading' | 'installing' | 'done' | 'error'

export function DesktopDownloadOverlay() {
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('intro')
  const [progress, setProgress] = useState(0)
  const [version, setVersion] = useState<string | undefined>()
  const [label, setLabel] = useState('Hexalyte Desktop')
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const [nativeUpdate, setNativeUpdate] = useState(false)

  const close = useCallback(() => {
    if (nativeUpdate && (phase === 'downloading' || phase === 'installing')) return
    setOpen(false)
    setPhase('intro')
    setProgress(0)
    setErrorMessage(undefined)
    setNativeUpdate(false)
  }, [nativeUpdate, phase])

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<DesktopDownloadDetail>).detail ?? {}
      const url = (detail.url || getDesktopDownloadUrl()).trim()
      setVersion(detail.version)
      setLabel(detail.label?.trim() || 'Hexalyte Desktop')
      setPhase('intro')
      setProgress(0)
      setErrorMessage(undefined)
      setOpen(true)

      const bridge = getHexalyteDesktopBridge()
      if (bridge?.installUpdate) {
        setNativeUpdate(true)
        window.setTimeout(() => {
          setPhase('downloading')
          void bridge.installUpdate?.(url, { version: detail.version }).then((res) => {
            if (res && res.ok === false) {
              setPhase('error')
              setErrorMessage(res.reason || 'Update failed')
              setNativeUpdate(false)
            }
          })
        }, 320)
        return
      }

      setNativeUpdate(false)
      window.setTimeout(() => {
        setPhase('downloading')
        triggerBrowserDownload(url)
      }, 520)
    }

    const onProgress = (event: Event) => {
      const detail = (event as CustomEvent<UpdateProgressDetail>).detail ?? {}
      setNativeUpdate(true)
      setOpen(true)
      if (detail.version) setVersion(detail.version)
      if (detail.label) setLabel(detail.label)
      if (typeof detail.progress === 'number') setProgress(detail.progress)

      if (detail.phase === 'installing') {
        setPhase('installing')
        setProgress(100)
      } else if (detail.phase === 'error') {
        setPhase('error')
        setErrorMessage(detail.message || 'Update failed')
        setNativeUpdate(false)
      } else if (detail.phase === 'downloading') {
        setPhase('downloading')
      }
    }

    window.addEventListener(DESKTOP_DOWNLOAD_EVENT, onOpen)
    window.addEventListener(DESKTOP_UPDATE_PROGRESS_EVENT, onProgress)
    const bridge = getHexalyteDesktopBridge()
    const unsub = bridge?.onUpdateProgress?.((payload) => {
      window.dispatchEvent(
        new CustomEvent(DESKTOP_UPDATE_PROGRESS_EVENT, { detail: payload }),
      )
    })

    return () => {
      window.removeEventListener(DESKTOP_DOWNLOAD_EVENT, onOpen)
      window.removeEventListener(DESKTOP_UPDATE_PROGRESS_EVENT, onProgress)
      unsub?.()
    }
  }, [])

  useEffect(() => {
    if (!open || phase !== 'downloading' || nativeUpdate) return

    let raf = 0
    const started = performance.now()

    const tick = (now: number) => {
      const elapsed = now - started
      const eased = Math.min(92, 100 * (1 - Math.exp(-elapsed / 1400)))
      setProgress(eased)
      if (elapsed < 2800) {
        raf = requestAnimationFrame(tick)
      } else {
        setProgress(100)
        setPhase('done')
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [open, phase, nativeUpdate])

  useEffect(() => {
    if (phase !== 'done' || nativeUpdate) return
    const t = window.setTimeout(() => close(), 3200)
    return () => window.clearTimeout(t)
  }, [phase, close, nativeUpdate])

  const title =
    phase === 'error'
      ? 'Update failed'
      : phase === 'installing'
        ? 'Installing update'
        : phase === 'done'
          ? 'Download started'
          : 'Updating desktop app'

  const subtitle =
    phase === 'error'
      ? errorMessage || 'Something went wrong. Try again from Help → Check for Updates.'
      : phase === 'installing'
        ? 'Hexalyte will close and reopen automatically…'
        : phase === 'done'
          ? 'Open Hexalyte-Setup.exe from your Downloads folder, then install.'
          : `Preparing ${label}${version ? ` v${version}` : ''}…`

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0"
            style={{ background: 'rgba(7, 9, 15, 0.72)', backdropFilter: 'blur(8px)' }}
            onClick={close}
            disabled={nativeUpdate && (phase === 'downloading' || phase === 'installing')}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="hx-desktop-dl-title"
            className="relative w-full max-w-sm overflow-hidden rounded-2xl border"
            style={{
              background: 'linear-gradient(165deg, #0c1424 0%, #0a1020 55%, #0b1528 100%)',
              borderColor: 'rgba(37, 99, 235, 0.35)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.45), 0 0 0 1px rgba(37,99,235,0.12)',
            }}
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          >
            <div
              className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.35), transparent 70%)' }}
            />

            {!(nativeUpdate && (phase === 'downloading' || phase === 'installing')) ? (
              <button
                type="button"
                aria-label="Dismiss"
                onClick={close}
                className="absolute right-3 top-3 z-10 rounded-lg p-1.5 transition-opacity hover:opacity-100"
                style={{ color: '#94a3b8', opacity: 0.7 }}
              >
                <X size={16} />
              </button>
            ) : null}

            <div className="relative px-6 pb-6 pt-8 text-center">
              <div className="mx-auto mb-5 flex h-28 w-28 items-center justify-center">
                <div className="hx-desktop-dl-orbit relative flex h-24 w-24 items-center justify-center">
                  <span className="hx-desktop-dl-ring absolute inset-0 rounded-full" />
                  <span className="hx-desktop-dl-ring hx-desktop-dl-ring--delay absolute inset-2 rounded-full" />
                  <div
                    className="relative z-[1] flex h-16 w-16 items-center justify-center rounded-2xl"
                    style={{
                      background: 'linear-gradient(145deg, #2563EB, #1D4ED8)',
                      boxShadow: '0 12px 28px rgba(37,99,235,0.4)',
                    }}
                  >
                    {phase === 'done' || phase === 'installing' ? (
                      <motion.span
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 18 }}
                      >
                        <Check size={28} color="#fff" strokeWidth={2.5} />
                      </motion.span>
                    ) : (
                      <span className="hx-desktop-dl-icon relative text-white">
                        <Monitor size={28} strokeWidth={2} />
                        <span className="hx-desktop-dl-arrow" aria-hidden />
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <h2
                id="hx-desktop-dl-title"
                className="text-lg font-semibold tracking-tight"
                style={{ color: '#f8fafc' }}
              >
                {title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: '#94a3b8' }}>
                {subtitle}
              </p>

              <div className="mt-5">
                <div
                  className="h-2 overflow-hidden rounded-full"
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, #1D4ED8, #3B82F6, #38BDF8)',
                      backgroundSize: '200% 100%',
                    }}
                    initial={{ width: '0%' }}
                    animate={{ width: `${phase === 'intro' ? 8 : progress}%` }}
                    transition={{ ease: 'easeOut', duration: 0.25 }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px]" style={{ color: '#64748b' }}>
                  <span>
                    {phase === 'error'
                      ? 'Failed'
                      : phase === 'installing'
                        ? 'Restarting…'
                        : phase === 'done'
                          ? 'Ready'
                          : phase === 'intro'
                            ? 'Starting…'
                            : 'Downloading…'}
                  </span>
                  <span>{Math.round(phase === 'done' || phase === 'installing' ? 100 : progress)}%</span>
                </div>
              </div>

              {phase === 'done' || phase === 'error' ? (
                <motion.button
                  type="button"
                  className="mt-5 w-full rounded-xl py-2.5 text-sm font-semibold text-white"
                  style={{ background: '#2563EB' }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={close}
                >
                  Got it
                </motion.button>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
