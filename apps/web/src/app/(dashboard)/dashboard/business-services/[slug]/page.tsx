'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

/** Alias: /dashboard/business-services/:slug → /business-services/:slug */
export default function BusinessServicesDashboardSlugAlias() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()

  useEffect(() => {
    if (params?.slug) {
      router.replace(`/business-services/${params.slug}`)
    }
  }, [params?.slug, router])

  return null
}
