'use client'

import { notFound, useParams } from 'next/navigation'
import { ReportSectionPage, type ReportSectionId } from '@/components/reports/ReportTabs'
import { useTenantFeatures } from '@/lib/hooks'

const SECTION_MAP: Record<string, ReportSectionId> = {
  overview: 'overview',
  sales: 'sales',
  pl: 'pl',
  cashflow: 'cashflow',
  inventory: 'inventory',
  repairs: 'repairs',
  delivery: 'delivery',
  'daily-reload': 'dailyreload',
}

export default function DashboardReportSectionPage() {
  const params = useParams()
  const sectionKey = typeof params.section === 'string' ? params.section : ''
  const sectionId = SECTION_MAP[sectionKey]
  const { hasFeature, loading } = useTenantFeatures()
  const hasDailyReload = hasFeature('DAILY_RELOAD')

  if (!sectionId) notFound()
  if (loading && sectionId === 'dailyreload') {
    return <p className="text-sm p-6" style={{ color: 'var(--text-muted)' }}>Loading…</p>
  }
  if (sectionId === 'dailyreload' && !hasDailyReload) {
    return <p className="text-sm p-6" style={{ color: 'var(--text-muted)' }}>Daily Reload is not enabled for your account.</p>
  }

  return <ReportSectionPage section={sectionId} />
}
