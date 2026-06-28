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

    const needsHydrate = !user.branches?.length || (!user.activeBranchId && user.branchScope !== 'all')
    if (!needsHydrate) return

    branchesApi.list()
      .then((res: any) => {
        const list = (res?.data ?? res ?? []) as Array<{
          id: string; name: string; city: string; isHeadquarters: boolean; isDefault?: boolean; isActive: boolean
        }>
        const branches = list.map(b => ({
          id: b.id,
          name: b.name,
          city: b.city,
          isHeadquarters: b.isHeadquarters,
          isDefault: b.isDefault ?? false,
          isActive: b.isActive,
        }))
        const assigned = user.branchIds?.length
          ? user.branchIds
          : (user.role === 'OWNER' ? branches.map(b => b.id) : [])
        const activeBranchId = user.activeBranchId
          ?? pickBranchId(branches, assigned)
          ?? user.branchIds?.[0]
        const next = {
          ...user,
          branchIds: assigned,
          branches,
          activeBranchId: user.branchScope === 'all' ? undefined : activeBranchId,
          suggestedBranchId: activeBranchId,
        }
        authStorage.updateUser(next)
      })
      .catch(() => {
        if (user.branchIds?.[0] && !user.activeBranchId) {
          authStorage.updateUser({ activeBranchId: user.branchIds[0] })
        }
      })
  }, [])

  return null
}
