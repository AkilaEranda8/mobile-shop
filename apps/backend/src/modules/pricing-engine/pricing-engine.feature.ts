import { isTenantFeatureEnabled } from '../../utils/tenant-feature.util'

export const PRICING_ENGINE_FEATURE = 'PRICING_ENGINE'

export async function isPricingEngineEnabled(tenantId: string): Promise<boolean> {
  return isTenantFeatureEnabled(tenantId, PRICING_ENGINE_FEATURE)
}
