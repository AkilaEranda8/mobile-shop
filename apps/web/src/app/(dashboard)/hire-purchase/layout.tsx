'use client'

import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'
import { useFeatureFlag } from '@/lib/hooks'

/** Legacy `/hire-purchase/*` URLs redirect to `/dashboard/hire-purchase/*`. */
export default function HirePurchaseLegacyLayout({ children }: { children: ReactNode }) {
  const enabled = useFeatureFlag('HIRE_PURCHASE')
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!pathname?.startsWith('/hire-purchase')) return
    router.replace(pathname.replace(/^\/hire-purchase/, '/dashboard/hire-purchase') + (window.location.search || ''))
  }, [pathname, router])

  if (!enabled) {
    return (
      <div className="mx-auto mt-20 max-w-md text-center">
        <Lock className="mx-auto text-emerald-600" />
        <h1 className="mt-4 text-xl font-bold">Hire Purchase is not enabled</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Ask a platform administrator to enable the HIRE_PURCHASE tenant feature.
        </p>
      </div>
    )
  }

  return children
}
