'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'
import { applyAppearanceToDocument, getStoredAppearance } from '@/lib/appearance'

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    applyAppearanceToDocument(getStoredAppearance())
  }, [resolvedTheme])

  return <>{children}</>
}
