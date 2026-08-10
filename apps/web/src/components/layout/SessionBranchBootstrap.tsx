'use client'

import { useEffect } from 'react'
import { authStorage } from '@/lib/auth'
import { branchesApi } from '@/lib/api'
import { initializeSessionBranch, pickBranchId } from '@/lib/active-branch'

/** Backward-compat: hydrate branch metadata for sessions created before multi-branch update. */
export function SessionBranchBootstrap() {
  useEffect(() => {
    const user = authStorage.getUser()
    if (!user?.id) return

    const assigned = user.branchIds ?? []
    const hasUnassignedBranches = user.role !== 'OWNER'
      && (user.branches?.some(b => !assigned.includes(b.id)) ?? false)
    const missingDcFlag = user.branches?.some(b => b.dailyClosingEnabled === undefined) ?? false
    const missingDisabled = user.branches?.some(b => b.disabledFeatures === undefined) ?? false
    const needsHydrate = !user.branches?.length || hasUnassignedBranches
      || (!user.activeBranchId && user.branchScope !== 'all')
      || missingDcFlag
      || missingDisabled
    if (!needsHydrate) return

    branchesApi.list()
      .then((res: any) => {
        const list = (res?.data ?? res ?? []) as Array<{
          id: string; name: string; city: string; isHeadquarters: boolean; isDefault?: boolean; isActive: boolean
          dailyClosingEnabled?: boolean
          disabledFeatures?: string[] | null
        }>
        const assigned = user.branchIds?.length
          ? user.branchIds
          : (user.role === 'OWNER' ? list.map(b => b.id) : [])
        const branches = list
          .filter(b => user.role === 'OWNER' || assigned.includes(b.id))
          .map(b => ({
          id: b.id,
          name: b.name,
          city: b.city,
          isHeadquarters: b.isHeadquarters,
          isDefault: b.isDefault ?? false,
          isActive: b.isActive,
          dailyClosingEnabled: b.dailyClosingEnabled !== false,
          disabledFeatures: Array.isArray(b.disabledFeatures) ? b.disabledFeatures.map(String) : [],
        }))
        const assignedIds = assigned.length ? assigned : branches.map(b => b.id)
        const activeBranchId = user.activeBranchId
          ?? pickBranchId(branches, assignedIds)
          ?? user.branchIds?.[0]
        const next = {
          ...user,
          branchIds: assignedIds,
          branches,
          activeBranchId: user.branchScope === 'all' ? undefined : activeBranchId,
          suggestedBranchId: activeBranchId,
        }
        authStorage.updateUser(next)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('active-branch-changed', {
            detail: {
              branchId: next.branchScope === 'all' ? null : next.activeBranchId,
              scope: next.branchScope,
            },
          }))
        }
      })
      .catch(() => {
        if (user.branchIds?.[0] && !user.activeBranchId) {
          authStorage.updateUser({ activeBranchId: user.branchIds[0] })
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('active-branch-changed', {
              detail: { branchId: user.branchIds[0], scope: 'assigned' },
            }))
          }
        }
      })
  }, [])

  return null
}
