'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { useRolePermissions } from '@/lib/hooks'
import { ModuleAccessProvider } from '@/lib/module-access'
import {
  pathRequiresEdit,
  pathToPermissionModule,
  ROLE_PERMISSION_MODULES,
} from '@/lib/role-permissions'

const FALLBACK_HREFS: Record<string, string> = {
  DASHBOARD: '/dashboard',
  POS: '/dashboard/sales',
  REPAIRS: '/dashboard/repairs',
  CUSTOMERS: '/dashboard/customers',
  INVENTORY: '/inventory',
  SERVICES: '/dashboard/services',
  SUPPLIERS: '/dashboard/suppliers',
  IMEI: '/dashboard/imei',
  WARRANTY: '/dashboard/warranty',
  EXCHANGES: '/dashboard/exchanges',
  FINANCE: '/dashboard/finance',
  ACCOUNTING: '/dashboard/accounting',
  REPORTS: '/dashboard/reports',
  STAFF: '/dashboard/staff',
  DELIVERY: '/dashboard/delivery',
  WHATSAPP: '/dashboard/whatsapp',
  DAILY_RELOAD: '/dashboard/daily-reload',
  DAILY_CLOSING: '/dashboard/daily-closing',
  SETTINGS: '/dashboard/settings',
  BRANCHES: '/dashboard/branches',
}

/** Redirects away from modules the current role cannot view; wraps ModuleAccess for View vs Edit. */
export function RoleAccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { canView, canEdit, loading } = useRolePermissions()
  const moduleKey = pathToPermissionModule(pathname)

  useEffect(() => {
    if (loading) return
    if (!moduleKey) return

    if (!canView(moduleKey)) {
      for (const mod of ROLE_PERMISSION_MODULES) {
        if (!canView(mod.key)) continue
        const href = FALLBACK_HREFS[mod.key]
        if (href && href !== pathname) {
          router.replace(href)
          return
        }
      }
      // No allowed module with a known href — send to dashboard root (may still be blocked)
      if (pathname !== '/dashboard') router.replace('/dashboard')
      return
    }

    if (pathRequiresEdit(pathname) && !canEdit(moduleKey)) {
      toast.error('You have view-only access — this action requires Edit permission')
      const fallback = FALLBACK_HREFS[moduleKey] ?? '/dashboard'
      if (fallback !== pathname) router.replace(fallback)
    }
  }, [pathname, moduleKey, canView, canEdit, loading, router])

  if (loading) {
    return <ModuleAccessProvider moduleKey={moduleKey}>{children}</ModuleAccessProvider>
  }

  return <ModuleAccessProvider moduleKey={moduleKey}>{children}</ModuleAccessProvider>
}
