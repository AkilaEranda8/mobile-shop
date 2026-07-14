'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useFeatureFlag } from '@/lib/hooks'
import { notFound } from 'next/navigation'

/** Legacy path — full report lives at /dashboard/daily-reload-report */
export default function DailyReloadReportRedirect() {
  const router = useRouter()
  const hasDailyReload = useFeatureFlag('DAILY_RELOAD')

  useEffect(() => {
    if (hasDailyReload) router.replace('/dashboard/daily-reload-report')
  }, [hasDailyReload, router])

  if (!hasDailyReload) notFound()
  return <p className="text-sm p-6" style={{ color: 'var(--text-muted)' }}>Opening Daily Reload Report…</p>
}
