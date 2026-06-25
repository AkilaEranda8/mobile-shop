import { prisma } from '../config/database'

export async function isTenantFeatureEnabled(tenantId: string, feature: string): Promise<boolean> {
  const feat = await prisma.tenantFeature.findFirst({
    where: { tenantId, feature, enabled: true },
  })
  return !!feat
}
