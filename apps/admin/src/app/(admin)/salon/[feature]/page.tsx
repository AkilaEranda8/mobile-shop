'use client'

import { useParams } from 'next/navigation'
import HubFeaturePage, { type HubFeatureKey } from '@/components/hub/HubFeaturePage'

const VALID: HubFeatureKey[] = [
  'subscriptions',
  'whatsapp',
  'auth-iam',
  'system-health',
  'analytics',
  'activity-logs',
  'notifications',
  'feature-suggestions',
  'announcements',
  'release-notes',
  'master-catalog',
  'support-tools',
  'settings',
]

export default function SalonFeatureRoute() {
  const params = useParams()
  const feature = String(params?.feature || '') as HubFeatureKey
  if (!VALID.includes(feature)) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Unknown Salon feature: {feature}
      </div>
    )
  }
  return <HubFeaturePage product="salon" feature={feature} />
}
