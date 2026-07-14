'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const TAB_TO_SECTION: Record<string, string> = {
  overview: 'overview',
  sales: 'sales',
  pl: 'pl',
  cashflow: 'cashflow',
  inventory: 'inventory',
  repairs: 'repairs',
  delivery: 'delivery',
  dailyreload: 'daily-reload',
}

function RedirectInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  useEffect(() => {
    const tab = searchParams.get('tab') || 'overview'
    const section = TAB_TO_SECTION[tab] || 'overview'
    router.replace(`/dashboard/reports/${section}`)
  }, [router, searchParams])
  return (
    <div className="flex items-center justify-center min-h-[40vh] text-sm" style={{ color: 'var(--text-muted)' }}>
      Opening Reports &amp; Analytics…
    </div>
  )
}

/** Legacy hub + ?tab= → dedicated report pages */
export default function ReportsRedirectPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[40vh] text-sm" style={{ color: 'var(--text-muted)' }}>
        Opening Reports &amp; Analytics…
      </div>
    }>
      <RedirectInner />
    </Suspense>
  )
}
