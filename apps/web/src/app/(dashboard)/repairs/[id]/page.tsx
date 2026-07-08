'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function RepairDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === 'string' ? params.id : ''
  useEffect(() => {
    if (!id) {
      router.replace('/dashboard/repairs')
      return
    }
    router.replace(`/dashboard/repairs?id=${id}`)
  }, [id, router])

  return null
}
