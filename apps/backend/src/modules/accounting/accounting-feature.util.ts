import { onAccountingFeatureEnabled } from './accounting-init.service'

export async function handleAccountingFeatureToggle(
  tenantId: string,
  feature: string,
  enabled: boolean,
  actorEmail = 'system',
) {
  if (feature === 'ACCOUNTING' && enabled) {
    await onAccountingFeatureEnabled(tenantId, actorEmail)
  }
}

export async function handleAccountingFeatureBatch(
  tenantId: string,
  features: Record<string, boolean>,
  actorEmail = 'system',
) {
  if (features.ACCOUNTING === true) {
    await onAccountingFeatureEnabled(tenantId, actorEmail)
  }
}
