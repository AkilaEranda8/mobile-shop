'use client'

import { useEffect } from 'react'
import { usePos } from '@/lib/use-pos'

/** Global F2 shortcut to open POS from anywhere in the dashboard. */
export function PosGlobalShortcuts() {
  const { openPos, posOpen, closePos, hasPos } = usePos()

  useEffect(() => {
    if (!hasPos) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName ?? ''
      const inField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)
      if (e.key === 'F2' && !inField) {
        e.preventDefault()
        if (posOpen) closePos()
        else openPos()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hasPos, openPos, closePos, posOpen])

  return null
}
