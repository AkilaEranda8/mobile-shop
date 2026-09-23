export type PlatformAdminRole = 'SUPER_ADMIN' | 'SUPPORT_ADMIN' | 'BILLING_ADMIN'

export function normalizePlatformAdminRole(raw?: string | null): PlatformAdminRole {
  const v = String(raw ?? '').trim().toUpperCase()
  if (v === 'SUPPORT_ADMIN' || v === 'BILLING_ADMIN' || v === 'SUPER_ADMIN') return v
  // Legacy PLATFORM_ADMIN rows without a sub-role keep full access
  return 'SUPER_ADMIN'
}

/** Finance / billing / MRR / subscription money views & mutations */
export function canAccessPlatformFinance(role?: string | null): boolean {
  const r = normalizePlatformAdminRole(role)
  return r === 'SUPER_ADMIN' || r === 'BILLING_ADMIN'
}

export function canManagePlatformAdmins(role?: string | null): boolean {
  return normalizePlatformAdminRole(role) === 'SUPER_ADMIN'
}
