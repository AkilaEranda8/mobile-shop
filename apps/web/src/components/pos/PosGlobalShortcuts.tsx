'use client'

import { useEffect } from 'react'
import { usePos } from '@/lib/use-pos'
import { useRolePermissions } from '@/lib/hooks'
import { viewOnlyToast } from '@/lib/module-access'

/**
 * Global F2 opens POS from the dashboard.
 * When POS is already open, F2 is owned by POSContent (customer picker) — never closes POS.
 */
export function PosGlobalShortcuts() {
  const { openPos, posOpen, hasPos } = usePos()
  const { canEdit } = useRolePermissions()

  useEffect(() => {
    if (!hasPos) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'F2') return
      const tag = (document.activeElement as HTMLElement)?.tagName ?? ''
      const inField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)
      if (inField) return
      // POS overlay handles F2 while open
      if (posOpen) return
      e.preventDefault()
      if (!canEdit('POS')) return viewOnlyToast('POS')
      openPos()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canEdit, hasPos, openPos, posOpen])

  return null
}
