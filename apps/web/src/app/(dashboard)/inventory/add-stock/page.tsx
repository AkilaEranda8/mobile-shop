'use client'

import { useRouter } from 'next/navigation'
import { AddStockPage } from '@/components/inventory/AddStockModal'

export default function AddStockRoute() {
  const router = useRouter()
  return (
    <AddStockPage
      onClose={() => router.push('/inventory')}
      onSaved={() => router.push('/inventory')}
    />
  )
}
