import { isTenantFeatureEnabled } from '../../utils/tenant-feature.util'

export const WORKFLOW_VALIDATORS_FEATURE = 'WORKFLOW_VALIDATORS'

export async function isWorkflowValidatorsEnabled(tenantId: string): Promise<boolean> {
  return isTenantFeatureEnabled(tenantId, WORKFLOW_VALIDATORS_FEATURE)
}
