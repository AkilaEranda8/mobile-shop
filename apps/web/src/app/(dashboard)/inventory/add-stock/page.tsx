'use client'

import { useRouter } from 'next/navigation'
import { AddStockModal } from '@/components/inventory/AddStockModal'

export default function AddStockRoute() {
  const router = useRouter()
  return (
    <AddStockModal
      onClose={() => router.push('/inventory')}
      onSaved={() => router.push('/inventory')}
    />
  )
}
