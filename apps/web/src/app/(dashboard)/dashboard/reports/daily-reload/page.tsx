'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTenantFeatures } from '@/lib/hooks'

/** Legacy path — full report lives at /dashboard/daily-reload-report */
export default function DailyReloadReportRedirect() {
  const router = useRouter()
  const { hasFeature, loading } = useTenantFeatures()
  const hasDailyReload = hasFeature('DAILY_RELOAD')

  useEffect(() => {
    if (!loading && hasDailyReload) router.replace('/dashboard/daily-reload-report')
  }, [loading, hasDailyReload, router])

  if (loading) {
    return <p className="text-sm p-6" style={{ color: 'var(--text-muted)' }}>Opening Daily Reload Report…</p>
  }

  if (!hasDailyReload) {
    return (
      <p className="text-sm p-6" style={{ color: 'var(--text-muted)' }}>
        Daily Reload is not enabled for your account.
      </p>
    )
  }

  return <p className="text-sm p-6" style={{ color: 'var(--text-muted)' }}>Opening Daily Reload Report…</p>
}
