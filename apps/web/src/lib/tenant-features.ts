export const OPT_IN_FEATURES = ['DAILY_RELOAD', 'CUSTOMER_CREDIT', 'DAILY_CLOSING', 'PROFIT_ALLOCATION', 'ACCOUNTING'] as const
export const PRICED_FEATURES = ['POS', 'SERVICES'] as const

export function isFeatureEnabled(
  features: Record<string, boolean>,
  feature: string,
): boolean {
  if (OPT_IN_FEATURES.includes(feature as (typeof OPT_IN_FEATURES)[number])) {
    return features[feature] === true
  }
  return features[feature] !== false
}

export function clearFeaturesCache() {
  try { localStorage.removeItem('hx_tenant_features') } catch { /* noop */ }
}
