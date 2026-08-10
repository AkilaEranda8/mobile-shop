/** Keep in sync with apps/web Branch Management PLAN_BRANCH_LIMIT. */
export const PLAN_BRANCH_LIMIT: Record<string, number> = {
  TRIAL: 1,
  STARTER: 1,
  PRO: 3,
  ENTERPRISE: Number.POSITIVE_INFINITY,
}

export function planBranchLimit(plan: string | null | undefined): number {
  if (!plan) return PLAN_BRANCH_LIMIT.STARTER
  return PLAN_BRANCH_LIMIT[plan] ?? PLAN_BRANCH_LIMIT.STARTER
}

/** Opt-in modules that a branch may disable while the tenant feature stays on. */
export const BRANCH_OPT_OUT_FEATURES = [
  'ACCOUNTING',
  'HIRE_PURCHASE',
  'DAILY_RELOAD',
  'PROFIT_ALLOCATION',
  'CUSTOMER_CREDIT',
] as const

export type BranchOptOutFeature = (typeof BRANCH_OPT_OUT_FEATURES)[number]

export function normalizeDisabledFeatures(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const allowed = new Set<string>(BRANCH_OPT_OUT_FEATURES)
  return [...new Set(
    value
      .map(v => String(v ?? '').trim().toUpperCase())
      .filter(v => allowed.has(v)),
  )]
}
