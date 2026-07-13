'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { THEME_STORAGE_KEY } from '@/lib/appearance'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      storageKey={THEME_STORAGE_KEY}
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
