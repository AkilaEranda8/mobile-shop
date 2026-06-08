'use client'

import { useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { TableProvider, createTableConfig } from 'react-table-craft'

export function HexTableProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const config = useMemo(
    () =>
      createTableConfig({
        router: {
          push: (url: string) => router.push(url),
          replace: (url: string) => router.replace(url),
          getSearchParams: () => {
            if (typeof window === 'undefined') return new URLSearchParams()
            return new URLSearchParams(window.location.search)
          },
          getPathname: () => pathname,
        },
        search: { debounceMs: 300 },
      }),
    [router, pathname],
  )

  return <TableProvider config={config}>{children}</TableProvider>
}
