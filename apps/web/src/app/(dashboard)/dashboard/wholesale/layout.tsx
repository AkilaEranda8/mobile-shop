'use client'

import type { ReactNode } from 'react'
import { WholesaleFeatureGate } from '@/components/wholesale/wholesale-ui'

export default function WholesaleLayout({ children }: { children: ReactNode }) {
  return <WholesaleFeatureGate>{children}</WholesaleFeatureGate>
}
