import { prisma } from '../config/database'

export async function isTenantFeatureEnabled(tenantId: string, feature: string): Promise<boolean> {
  const feat = await prisma.tenantFeature.findFirst({
    where: { tenantId, feature, enabled: true },
  })
  return !!feat
}

/** Tenant DAILY_CLOSING on AND this branch has not opted out. */
export async function isDailyClosingEnabledForBranch(
  tenantId: string,
  branchId: string | undefined | null,
): Promise<boolean> {
  if (!branchId) return false
  if (!(await isTenantFeatureEnabled(tenantId, 'DAILY_CLOSING'))) return false
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, tenantId },
    select: { dailyClosingEnabled: true },
  })
  return branch?.dailyClosingEnabled !== false
}
