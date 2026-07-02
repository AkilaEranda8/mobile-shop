'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AddProductRoute() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/inventory?action=add-product')
  }, [router])
  return null
}
