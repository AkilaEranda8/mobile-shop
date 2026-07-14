'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Legacy route — consolidated into Reports & Analytics. */
export default function AnalyticsRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/dashboard/reports/overview')
  }, [router])
  return (
    <div className="flex items-center justify-center min-h-[40vh] text-sm" style={{ color: 'var(--text-muted)' }}>
      Opening Reports &amp; Analytics…
    </div>
  )
}
