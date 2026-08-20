export const OPT_IN_FEATURES = [
  'DAILY_RELOAD', 'CUSTOMER_CREDIT', 'DAILY_CLOSING', 'PROFIT_ALLOCATION', 'ACCOUNTING', 'HIRE_PURCHASE',
  'WHOLESALE_PRICING', 'CREDIT_PRICING', 'POS_PRICE_EDIT', 'POS_BILL_DATE',
  'INVENTORY_ENGINE', 'PRICING_ENGINE', 'WORKFLOW_VALIDATORS',
] as const
export const PRICED_FEATURES = ['POS', 'SERVICES'] as const

/** Keep in sync with backend BRANCH_OPT_OUT_FEATURES. */
export const BRANCH_OPT_OUT_FEATURES = [
  'ACCOUNTING',
  'HIRE_PURCHASE',
  'DAILY_RELOAD',
  'PROFIT_ALLOCATION',
  'CUSTOMER_CREDIT',
] as const

export const BRANCH_OPT_OUT_LABELS: Record<(typeof BRANCH_OPT_OUT_FEATURES)[number], string> = {
  ACCOUNTING: 'Accounting',
  HIRE_PURCHASE: 'Hire Purchase',
  DAILY_RELOAD: 'Daily Reload',
  PROFIT_ALLOCATION: 'Profit Allocation',
  CUSTOMER_CREDIT: 'Customer Credit',
}

export function isFeatureEnabled(
  features: Record<string, boolean>,
  feature: string,
): boolean {
  if (OPT_IN_FEATURES.includes(feature as (typeof OPT_IN_FEATURES)[number])) {
    return features[feature] === true
  }
  return features[feature] !== false
}

type BranchMeta = {
  id: string
  dailyClosingEnabled?: boolean
  disabledFeatures?: string[]
}

function branchHasFeature(branch: BranchMeta, feature: string): boolean {
  if (feature === 'DAILY_CLOSING') return branch.dailyClosingEnabled !== false
  const disabled = Array.isArray(branch.disabledFeatures) ? branch.disabledFeatures : []
  return !disabled.includes(feature)
}

/** Tenant feature on, minus active-branch opt-outs (disabledFeatures / dailyClosingEnabled). */
export function isFeatureEnabledForActiveBranch(
  features: Record<string, boolean>,
  feature: string,
  opts?: {
    activeBranchId?: string | null
    branchScope?: string | null
    branches?: BranchMeta[]
    trialMode?: boolean
  },
): boolean {
  if (opts?.trialMode) return isFeatureEnabled(features, feature)
  if (!isFeatureEnabled(features, feature)) return false

  const isOptOut =
    feature === 'DAILY_CLOSING'
    || (BRANCH_OPT_OUT_FEATURES as readonly string[]).includes(feature)
  if (!isOptOut) return true

  const branches = opts?.branches ?? []
  // All Branches: on if any visible branch still has the module.
  if (opts?.branchScope === 'all' || !opts?.activeBranchId) {
    if (!branches.length) return true
    return branches.some(b => branchHasFeature(b, feature))
  }

  const branch = branches.find(b => b.id === opts.activeBranchId)
  if (!branch) return true
  return branchHasFeature(branch, feature)
}

export function clearFeaturesCache() {
  try { localStorage.removeItem('hx_tenant_features') } catch { /* noop */ }
}
