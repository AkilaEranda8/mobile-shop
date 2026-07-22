'use client'

import { useRolePermissions } from '@/lib/hooks'

/**
 * Product Traceability — driven by Staff Permission Matrix (PRODUCT_TRACEABILITY),
 * not a separate hardcoded role list.
 */
export function useHasPermission(_permission?: string): boolean {
  const { canView } = useRolePermissions()
  return canView('PRODUCT_TRACEABILITY')
}

export const PERMISSIONS = {
  PRODUCT_TRACEABILITY_VIEW: 'PRODUCT_TRACEABILITY_VIEW',
} as const

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

/** @deprecated Prefer useHasPermission / matrix canView('PRODUCT_TRACEABILITY') */
export function roleHasPermission(role: string | undefined, _permission?: PermissionKey): boolean {
  if (!role) return false
  if (role === 'PLATFORM_ADMIN' || role === 'OWNER') return true
  // Non-hook callers (rare): default deny — use the matrix-backed hook in UI.
  return false
}
