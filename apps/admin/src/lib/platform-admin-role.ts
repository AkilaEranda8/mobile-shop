import type { HubUserInfo } from './hub-session'

export type PlatformAdminRole = 'SUPER_ADMIN' | 'SUPPORT_ADMIN' | 'BILLING_ADMIN'

export function getPlatformAdminRole(user?: HubUserInfo | null): PlatformAdminRole {
  const raw = String((user as any)?.platformAdminRole ?? '').trim().toUpperCase()
  if (raw === 'SUPPORT_ADMIN' || raw === 'BILLING_ADMIN' || raw === 'SUPER_ADMIN') return raw
  // Legacy sessions without sub-role keep owner access until re-login
  return 'SUPER_ADMIN'
}

export function canAccessPlatformFinance(user?: HubUserInfo | null): boolean {
  const r = getPlatformAdminRole(user)
  return r === 'SUPER_ADMIN' || r === 'BILLING_ADMIN'
}

export function canManagePlatformAdmins(user?: HubUserInfo | null): boolean {
  return getPlatformAdminRole(user) === 'SUPER_ADMIN'
}

/** Enterprise nav paths that show MRR / billing / payments */
export const FINANCE_NAV_HREFS = new Set([
  '/subscriptions',
  '/payments',
  '/analytics',
  '/fashion/subscriptions',
  '/salon/subscriptions',
])

export function isFinancePath(path?: string | null): boolean {
  if (!path) return false
  if (FINANCE_NAV_HREFS.has(path)) return true
  return (
    path.startsWith('/subscriptions') ||
    path.startsWith('/payments') ||
    path.startsWith('/analytics') ||
    path.startsWith('/fashion/subscriptions') ||
    path.startsWith('/salon/subscriptions')
  )
}
