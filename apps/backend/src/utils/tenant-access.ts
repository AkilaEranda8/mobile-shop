import { prisma } from '../config/database'
import { AppError } from '../middleware/error.middleware'
import { logPlatformActivity } from './activity-log'

const BLOCKED_STATUSES = new Set(['SUSPENDED', 'CANCELLED'])

const SUSPENDED_MESSAGE =
  'Your trial has expired and this account is suspended. Please contact support to upgrade or renew your subscription.'

type TenantRow = {
  id: string
  name: string
  status: string
  trialEndsAt: Date | null
}

function isTrialPastEnd(tenant: Pick<TenantRow, 'status' | 'trialEndsAt'>): boolean {
  return tenant.status === 'TRIAL' && !!tenant.trialEndsAt && tenant.trialEndsAt.getTime() < Date.now()
}

/** Suspend tenant, deactivate users, revoke sessions. Returns true if action was taken. */
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

/** Enforce tenant access; auto-suspends expired trials on demand. */
export async function ensureTenantAccess(tenantId: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, status: true, trialEndsAt: true },
  })
  if (!tenant) throw new AppError('Tenant not found', 403)

  if (isTrialPastEnd(tenant)) {
    await suspendExpiredTrial(tenant)
    throw new AppError(SUSPENDED_MESSAGE, 403)
  }

  if (BLOCKED_STATUSES.has(tenant.status)) {
    throw new AppError(SUSPENDED_MESSAGE, 403)
  }
}

export { SUSPENDED_MESSAGE }
