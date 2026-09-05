'use client'

import { useEffect } from 'react'
import { usePos } from '@/lib/use-pos'
import { useRolePermissions } from '@/lib/hooks'
import { viewOnlyToast } from '@/lib/module-access'

/**
 * Global F2 opens POS from the dashboard.
 * When POS is already open, F2 is owned by POSContent (customer picker) — never closes/opens POS.
 */
export function PosGlobalShortcuts() {
  const { openPos, posOpen, hasPos } = usePos()
  const { canEdit } = useRolePermissions()

  useEffect(() => {
    if (!hasPos) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'F2') return
      // Always suppress browser default (e.g. rename in some hosts)
      e.preventDefault()
      // While POS is open, POSContent owns F2 → customer picker. Do not open/close POS.
      if (posOpen) return
      const tag = (document.activeElement as HTMLElement)?.tagName ?? ''
      const inField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)
      if (inField) return
      if (!canEdit('POS')) return viewOnlyToast('POS')
      openPos()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [canEdit, hasPos, openPos, posOpen])

  return null
}
