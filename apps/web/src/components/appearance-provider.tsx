'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'
import { applyAppearanceToDocument, getStoredAppearance } from '@/lib/appearance'

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme, theme } = useTheme()

  useEffect(() => {
    applyAppearanceToDocument(getStoredAppearance())
  }, [resolvedTheme, theme])

  // Keep accent tokens in sync if theme class flips outside next-themes
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return
    const root = document.documentElement
    const observer = new MutationObserver(() => {
      applyAppearanceToDocument(getStoredAppearance())
    })
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return <>{children}</>
}
