'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePos } from '@/lib/use-pos'

export default function POSPage() {
  const router = useRouter()
  const { openPos } = usePos()

  useEffect(() => {
    openPos()
    router.replace('/dashboard')
  }, [openPos, router])

  return null
}
