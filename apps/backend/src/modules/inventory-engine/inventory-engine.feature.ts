import { isTenantFeatureEnabled } from '../../utils/tenant-feature.util'

export const INVENTORY_ENGINE_FEATURE = 'INVENTORY_ENGINE'

export async function isInventoryEngineEnabled(tenantId: string): Promise<boolean> {
  return isTenantFeatureEnabled(tenantId, INVENTORY_ENGINE_FEATURE)
}
