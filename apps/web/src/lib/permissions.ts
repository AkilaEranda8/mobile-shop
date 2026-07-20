export const PERMISSIONS = {
  PRODUCT_TRACEABILITY_VIEW: 'PRODUCT_TRACEABILITY_VIEW',
} as const

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

const ALL_PERMISSIONS = Object.values(PERMISSIONS)

export const ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  PLATFORM_ADMIN: ALL_PERMISSIONS,
  OWNER: ALL_PERMISSIONS,
  MANAGER: ALL_PERMISSIONS,
  CASHIER: [],
  TECHNICIAN: [],
}

export function roleHasPermission(role: string | undefined, permission: PermissionKey): boolean {
  if (!role) return false
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission)
}

export function useHasPermission(permission: PermissionKey): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = localStorage.getItem('hx_user')
    if (!raw) return false
    const user = JSON.parse(raw) as { role?: string }
    return roleHasPermission(user.role, permission)
  } catch {
    return false
  }
}
