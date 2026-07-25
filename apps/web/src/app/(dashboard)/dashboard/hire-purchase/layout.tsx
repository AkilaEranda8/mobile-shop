'use client'

import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { useFeatureFlag } from '@/lib/hooks'

export default function HirePurchaseLayout({ children }: { children: ReactNode }) {
  const enabled = useFeatureFlag('HIRE_PURCHASE')
  if (!enabled) {
    return <div className="mx-auto mt-20 max-w-md text-center"><Lock className="mx-auto text-emerald-600" /><h1 className="mt-4 text-xl font-bold">Hire Purchase is not enabled</h1><p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>Ask a platform administrator to enable the HIRE_PURCHASE tenant feature.</p></div>
  }
  return children
}
