import { prisma } from '../config/database'
import { AppError } from '../middleware/error.middleware'
import { logPlatformActivity } from './activity-log'

const BLOCKED_STATUSES = new Set(['SUSPENDED', 'CANCELLED'])

const TRIAL_SUSPENDED_MESSAGE =
  'Your trial has expired and this account is suspended. Please contact support to upgrade or renew your subscription.'

const PAYMENT_SUSPENDED_MESSAGE =
  'Your account is suspended due to an unpaid subscription invoice. Please settle your billing to restore access.'

const PAYMENT_SUSPENDED_CODE = 'ACCOUNT_SUSPENDED_PAYMENT'

/** API path prefixes (relative to /api/v1) allowed when tenant is payment-suspended */
export const BILLING_ALLOWED_PATH_PREFIXES = [
  '/billing',
  '/tenants/me',
  '/auth/logout',
  '/auth/refresh',
  '/auth/me',
  '/auth/change-password',
  '/platform/status',
  '/notifications',
]

type TenantRow = {
  id: string
  name: string
  status: string
  trialEndsAt: Date | null
}

function isTrialPastEnd(tenant: Pick<TenantRow, 'status' | 'trialEndsAt'>): boolean {
  return tenant.status === 'TRIAL' && !!tenant.trialEndsAt && tenant.trialEndsAt.getTime() < Date.now()
}

/** Normalize request path for allowlist checks (strip /api/v1 or /api/v1/...) */
export function normalizeApiPath(rawPath: string, apiPrefix?: string): string {
  let path = rawPath.split('?')[0] || '/'
  if (apiPrefix) {
    const base = `/${apiPrefix}`.replace(/\/+/g, '/')
    if (path.startsWith(base)) path = path.slice(base.length) || '/'
  }
  // Also strip bare /api/v1 if present
  path = path.replace(/^\/api\/v\d+/, '') || '/'
  if (!path.startsWith('/')) path = `/${path}`
  return path
}

export function isBillingAllowedPath(rawPath: string, apiPrefix?: string): boolean {
  const path = normalizeApiPath(rawPath, apiPrefix)
  return BILLING_ALLOWED_PATH_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(prefix))
}

/** Suspend expired trial — deactivates users (legacy behaviour). */
export async function suspendExpiredTrial(tenant: TenantRow): Promise<boolean> {
  if (!isTrialPastEnd(tenant)) return false

  await prisma.$transaction([
    prisma.tenant.update({ where: { id: tenant.id }, data: { status: 'SUSPENDED' } }),
    prisma.user.updateMany({ where: { tenantId: tenant.id }, data: { isActive: false } }),
    prisma.refreshToken.deleteMany({ where: { user: { tenantId: tenant.id } } }),
  ])

  await logPlatformActivity({
    eventType: 'TRIAL_EXPIRED',
    severity: 'WARN',
    actorType: 'SYSTEM',
    actor: 'trial-expiry',
    target: tenant.name,
    details: `Trial ended ${tenant.trialEndsAt!.toISOString().slice(0, 10)} · tenant suspended · users deactivated`,
    tenantId: tenant.id,
  })

  return true
}

export async function processExpiredTrials(): Promise<number> {
  const now = new Date()
  const expired = await prisma.tenant.findMany({
    where: { status: 'TRIAL', trialEndsAt: { lt: now } },
    select: { id: true, name: true, status: true, trialEndsAt: true },
  })

  let count = 0
  for (const tenant of expired) {
    if (await suspendExpiredTrial(tenant)) count++
  }
  if (count > 0) console.log(`[trial-expiry] Suspended ${count} expired trial tenant(s)`)
  return count
}

export type TenantAccessOptions = {
  /** Original Express path or URL path */
  path?: string
  apiPrefix?: string
}

/**
 * Enforce tenant access.
 * - CANCELLED / trial-expired: always blocked
 * - Payment SUSPENDED: allow billing/auth/me paths so login + payment work
 */
export async function ensureTenantAccess(
  tenantId: string,
  opts: TenantAccessOptions = {},
): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, status: true, trialEndsAt: true },
  })
  if (!tenant) throw new AppError('Tenant not found', 403)

  if (isTrialPastEnd(tenant)) {
    await suspendExpiredTrial(tenant)
    throw new AppError(TRIAL_SUSPENDED_MESSAGE, 403)
  }

  if (tenant.status === 'CANCELLED') {
    throw new AppError('This account has been cancelled. Please contact support.', 403)
  }

  if (tenant.status === 'SUSPENDED') {
    if (opts.path && isBillingAllowedPath(opts.path, opts.apiPrefix)) {
      return
    }
    const err = new AppError(PAYMENT_SUSPENDED_MESSAGE, 403)
    ;(err as AppError & { code?: string }).code = PAYMENT_SUSPENDED_CODE
    throw err
  }

  if (BLOCKED_STATUSES.has(tenant.status)) {
    throw new AppError(TRIAL_SUSPENDED_MESSAGE, 403)
  }
}

export { TRIAL_SUSPENDED_MESSAGE as SUSPENDED_MESSAGE, PAYMENT_SUSPENDED_MESSAGE, PAYMENT_SUSPENDED_CODE }
