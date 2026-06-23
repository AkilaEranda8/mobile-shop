'use client'

import { useRouter } from 'next/navigation'
import { AddProductModal } from '@/components/inventory/AddProductModal'

export default function AddProductRoute() {
  const router = useRouter()
  return (
    <AddProductModal
      onClose={() => router.push('/inventory')}
      onSaved={() => router.push('/inventory')}
    />
  )
}
