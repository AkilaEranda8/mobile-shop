'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useRolePermissions } from '@/lib/hooks'
import { pathToPermissionModule, ROLE_PERMISSION_MODULES } from '@/lib/role-permissions'

const FALLBACK_HREFS: Record<string, string> = {
  DASHBOARD: '/dashboard',
  POS: '/dashboard/pos',
  REPAIRS: '/dashboard/repairs',
  CUSTOMERS: '/dashboard/customers',
  INVENTORY: '/inventory',
  SETTINGS: '/dashboard/settings',
}

/** Redirects away from modules the current role cannot view. */
export function RoleAccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { canView, loading } = useRolePermissions()

  useEffect(() => {
    if (loading) return
    const moduleKey = pathToPermissionModule(pathname)
    if (!moduleKey) return
    if (canView(moduleKey)) return

    for (const mod of ROLE_PERMISSION_MODULES) {
      if (!canView(mod.key)) continue
      const href = FALLBACK_HREFS[mod.key]
      if (href && href !== pathname) {
        router.replace(href)
        return
      }
    }
  }, [pathname, canView, loading, router])

  return <>{children}</>
}
