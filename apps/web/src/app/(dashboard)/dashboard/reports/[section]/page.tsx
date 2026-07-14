'use client'

import { notFound, useParams } from 'next/navigation'
import { ReportSectionPage, type ReportSectionId } from '@/components/reports/ReportTabs'
import { useFeatureFlag } from '@/lib/hooks'

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
  const hasDailyReload = useFeatureFlag('DAILY_RELOAD')

  if (!sectionId) notFound()
  if (sectionId === 'dailyreload' && !hasDailyReload) notFound()

  return <ReportSectionPage section={sectionId} />
}
