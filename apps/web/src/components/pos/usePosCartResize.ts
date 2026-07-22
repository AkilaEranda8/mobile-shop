'use client'

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { PosUiSettings } from '@/lib/posUiSettings'

const STORAGE_KEY = 'pos_cart_panel_width_px'
const MIN_PX = 280
const MAX_PX = 720

export function presetCartWidthPx(
  preset: PosUiSettings['layout']['cartWidth'] = 'wide',
): number {
  if (preset === 'narrow') return 340
  if (preset === 'medium') return 460
  return 540
}

function clampWidth(px: number) {
  if (typeof window === 'undefined') return Math.min(MAX_PX, Math.max(MIN_PX, px))
  const max = Math.min(MAX_PX, Math.floor(window.innerWidth * 0.55))
  return Math.min(max, Math.max(MIN_PX, Math.round(px)))
}

function readStoredWidth(fallback: number): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const n = Number(raw)
    if (!Number.isFinite(n)) return fallback
    return clampWidth(n)
  } catch {
    return fallback
  }
}

/** Persist + drag-resize POS cart panel width (desktop). */
export function usePosCartResize(
  preset: PosUiSettings['layout']['cartWidth'] = 'wide',
  cartLeft = false,
) {
  const presetPx = presetCartWidthPx(preset)
  const [widthPx, setWidthPx] = useState(presetPx)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startW: number } | null>(null)

  useEffect(() => {
    setWidthPx(readStoredWidth(presetPx))
  }, [presetPx])

  useEffect(() => {
    if (!dragging) return
    const prevUserSelect = document.body.style.userSelect
    const prevCursor = document.body.style.cursor
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const delta = cartLeft ? e.clientX - d.startX : d.startX - e.clientX
      setWidthPx(clampWidth(d.startW + delta))
    }
    const onUp = () => {
      dragRef.current = null
      setDragging(false)
      setWidthPx(w => {
        const next = clampWidth(w)
        try { localStorage.setItem(STORAGE_KEY, String(next)) } catch { /* noop */ }
        return next
      })
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      document.body.style.userSelect = prevUserSelect
      document.body.style.cursor = prevCursor
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragging, cartLeft])

  const startResize = useCallback((e: ReactPointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = { startX: e.clientX, startW: widthPx }
    setDragging(true)
  }, [widthPx])

  const resetWidth = useCallback(() => {
    const next = clampWidth(presetPx)
    setWidthPx(next)
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* noop */ }
  }, [presetPx])

  return { widthPx, dragging, startResize, resetWidth }
}

export function PosCartResizeHandle({
  onPointerDown,
  onDoubleClick,
  dragging,
  accent,
  border,
}: {
  onPointerDown: (e: ReactPointerEvent) => void
  onDoubleClick?: () => void
  dragging: boolean
  accent: string
  border: string
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize cart"
      title="Drag to resize cart · double-click to reset"
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      className="hidden lg:flex relative w-1.5 shrink-0 cursor-col-resize touch-none group items-stretch justify-center z-20"
      style={{ background: dragging ? `${accent}55` : 'transparent' }}
    >
      <span className="absolute inset-y-0 -left-1 -right-1" aria-hidden />
      <span
        className="w-px h-full transition-colors"
        style={{ background: dragging ? accent : border }}
      />
      <span
        className={`absolute top-1/2 -translate-y-1/2 w-1 h-10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${dragging ? '!opacity-100' : ''}`}
        style={{ background: accent }}
      />
    </div>
  )
}
