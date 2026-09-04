import { SubscriptionPlan } from '@prisma/client'
import { prisma } from '../../config/database'

/** Fallback LKR monthly prices when platformConfig plan_mrr_* is missing */
export const DEFAULT_PLAN_MRR: Record<string, number> = {
  TRIAL: 0,
  STARTER: 2999,
  PRO: 4999,
  ENTERPRISE: 14399,
}

export const PLAN_RANK: Record<string, number> = {
  TRIAL: 0,
  STARTER: 1,
  PRO: 2,
  ENTERPRISE: 3,
}

export function isUpgradePlan(from: string, to: string): boolean {
  return (PLAN_RANK[to] ?? -1) > (PLAN_RANK[from] ?? -1)
}

export async function resolvePlanBaseMrr(plan: string): Promise<number> {
  const key = String(plan || 'STARTER').toUpperCase()
  const cfg = await prisma.platformConfig.findUnique({ where: { key: `plan_mrr_${key}` } })
  if (cfg?.value != null && cfg.value !== '') {
    const n = Number(cfg.value)
    if (Number.isFinite(n) && n >= 0) return n
  }
  return DEFAULT_PLAN_MRR[key] ?? 0
}

export function encodePlanUpgradeNotes(from: string, to: string): string {
  return `PLAN_UPGRADE|from=${from}|to=${to}`
}

export function parsePlanUpgradeNotes(notes?: string | null): { from: SubscriptionPlan; to: SubscriptionPlan } | null {
  if (!notes || !notes.startsWith('PLAN_UPGRADE|')) return null
  const from = notes.match(/from=([A-Z]+)/i)?.[1]?.toUpperCase()
  const to = notes.match(/to=([A-Z]+)/i)?.[1]?.toUpperCase()
  if (!from || !to) return null
  if (!(from in PLAN_RANK) || !(to in PLAN_RANK)) return null
  return { from: from as SubscriptionPlan, to: to as SubscriptionPlan }
}
