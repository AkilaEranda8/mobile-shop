import { prisma } from '../config/database'
import { AppError } from '../middleware/error.middleware'
import {
  ALL_FEATURES,
  buildFeatureMap,
} from '../modules/tenants/tenant-features'
import { BRANCH_OPT_OUT_FEATURES, normalizeDisabledFeatures } from '../constants/plan-limits'

async function isTrialTenant(tenantId: string): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { status: true },
  })
  return tenant?.status === 'TRIAL'
}

export async function isTenantFeatureEnabled(tenantId: string, feature: string): Promise<boolean> {
  if (!ALL_FEATURES.includes(feature)) return false
  if (await isTrialTenant(tenantId)) return true
  const rows = await prisma.tenantFeature.findMany({
    where: { tenantId, feature: { in: ALL_FEATURES } },
    select: { feature: true, enabled: true },
  })
  return buildFeatureMap(rows)[feature] === true
}

/**
 * Tenant feature on AND branch has not opted out.
 * When branchId is missing (All Branches): opt-out features stay on only if
 * at least one active branch has not disabled them.
 * Trial tenants get every module without branch opt-out restrictions.
 */
export async function isFeatureEnabledForBranch(
  tenantId: string,
  branchId: string | undefined | null,
  feature: string,
): Promise<boolean> {
  if (!ALL_FEATURES.includes(feature)) return false
  if (await isTrialTenant(tenantId)) return true
  if (!(await isTenantFeatureEnabled(tenantId, feature))) return false

  if (feature === 'DAILY_CLOSING') {
    if (branchId) return isDailyClosingEnabledForBranch(tenantId, branchId)
    const branches = await prisma.branch.findMany({
      where: { tenantId, isActive: true },
      select: { dailyClosingEnabled: true },
    })
    if (!branches.length) return true
    return branches.some(b => b.dailyClosingEnabled !== false)
  }

  const isOptOut = (BRANCH_OPT_OUT_FEATURES as readonly string[]).includes(feature)
  if (!isOptOut) return true

  if (branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      select: { disabledFeatures: true },
    })
    if (!branch) return false
    return !normalizeDisabledFeatures(branch.disabledFeatures).includes(feature)
  }

  const branches = await prisma.branch.findMany({
    where: { tenantId, isActive: true },
    select: { disabledFeatures: true },
  })
  if (!branches.length) return true
  return branches.some(b => !normalizeDisabledFeatures(b.disabledFeatures).includes(feature))
}

export async function assertFeatureEnabledForBranch(
  tenantId: string,
  branchId: string | undefined | null,
  feature: string,
  message?: string,
): Promise<void> {
  if (!(await isFeatureEnabledForBranch(tenantId, branchId, feature))) {
    throw new AppError(message ?? `${feature.replace(/_/g, ' ')} is not enabled for this branch`, 403)
  }
}

/** Tenant DAILY_CLOSING on AND this branch has not opted out. */
export async function isDailyClosingEnabledForBranch(
  tenantId: string,
  branchId: string | undefined | null,
): Promise<boolean> {
  if (!branchId) return false
  if (await isTrialTenant(tenantId)) return true
  if (!(await isTenantFeatureEnabled(tenantId, 'DAILY_CLOSING'))) return false
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, tenantId },
    select: { dailyClosingEnabled: true },
  })
  return branch?.dailyClosingEnabled !== false
}
