'use client'

import { useCallback } from 'react'
import { useUIStore, type PosCustomerPreset } from '@/stores/ui-store'
import { useFeatureFlag } from '@/lib/hooks'
import { ensureOperationalBranch } from '@/lib/active-branch'
import toast from 'react-hot-toast'

export function usePos() {
  const { posOpen, openPos: storeOpen, closePos, pendingCustomer, clearPendingCustomer } = useUIStore()
  const hasPos = useFeatureFlag('POS')

  const openPos = useCallback((customer?: PosCustomerPreset | null) => {
    if (!hasPos) {
      toast.error('POS is not enabled on your plan')
      return false
    }
    const branchId = ensureOperationalBranch()
    if (!branchId) {
      toast.error('No branch assigned to your account — contact admin')
      return false
    }
    storeOpen(customer ?? undefined)
    return true
  }, [hasPos, storeOpen])

  return { posOpen, openPos, closePos, hasPos, pendingCustomer, clearPendingCustomer }
}
