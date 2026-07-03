import { prisma } from '../../config/database'
import { businessDateDb, businessDayRange } from '../../utils/date-range'
import { findBranchReloads } from './reload-branch.util'
import {
  RELOAD_PROVIDER_IDS,
  calcReloadCommission,
  resolveReloadProvider,
  type ReloadServiceType,
  type ReloadSettings,
} from './reload-settings.util'

export interface ProviderReloadStats {
  provider: string
  count: number
  reloadTotal: number
  commission: number
  priorBalance: number
  todayNetPayable: number
  netPayable: number
  paid: number
  remaining: number
  isPaid: boolean
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function reloadServiceType(r: { reloadType?: string | null }): ReloadServiceType {
  return (r.reloadType === 'RECHARGE_CARD' ? 'RECHARGE_CARD' : 'RELOAD') as ReloadServiceType
}

function netFromReload(
  r: { amount: number; connectionNo: string; provider?: string | null; reloadType?: string | null },
  settings: ReloadSettings,
) {
  const amt = Number(r.amount)
  const commission = calcReloadCommission(
    amt, settings, r.connectionNo, r.provider, reloadServiceType(r),
  )
  return round2(amt - commission)
}

/** Unpaid provider balance carried forward from all days before `beforeDateKey`. */
export async function computeProviderPriorBalances(
  tenantId: string,
  branchId: string,
  beforeDateKey: string,
  settings: ReloadSettings,
): Promise<Record<string, number>> {
  const { start: dayStart } = businessDayRange(beforeDateKey)
  const endBefore = new Date(dayStart.getTime() - 1)
  const start = new Date('2000-01-01T00:00:00+05:30')

  const reloads = await findBranchReloads(tenantId, branchId, start, endBefore, { status: 'Success' })
  const payments = await prisma.dailyReloadProviderPayment.findMany({
    where: { tenantId, branchId, businessDate: { lt: businessDateDb(beforeDateKey) } },
  })

  const owedByProvider: Record<string, number> = {}
  for (const r of reloads) {
    const provider = resolveReloadProvider(r.connectionNo, r.provider) ?? 'Other'
    owedByProvider[provider] = round2((owedByProvider[provider] ?? 0) + netFromReload(r, settings))
  }

  const paidByProvider: Record<string, number> = {}
  for (const p of payments) {
    paidByProvider[p.provider] = round2((paidByProvider[p.provider] ?? 0) + Number(p.amountPaid))
  }

  const priorBalances: Record<string, number> = {}
  const providers = new Set([...Object.keys(owedByProvider), ...Object.keys(paidByProvider)])
  for (const provider of providers) {
    const balance = round2((owedByProvider[provider] ?? 0) - (paidByProvider[provider] ?? 0))
    if (balance > 0.01) priorBalances[provider] = balance
  }
  return priorBalances
}

export function buildProviderBreakdown(
  reloads: Array<{ amount: number; connectionNo: string; provider?: string | null; status: string; reloadType?: string | null }>,
  settings: ReloadSettings,
  paidByProvider: Record<string, number>,
  priorBalanceByProvider: Record<string, number> = {},
): ProviderReloadStats[] {
  const map: Record<string, { count: number; reloadTotal: number; commission: number }> = {}

  for (const id of RELOAD_PROVIDER_IDS) {
    map[id] = { count: 0, reloadTotal: 0, commission: 0 }
  }
  map.Other = { count: 0, reloadTotal: 0, commission: 0 }

  for (const r of reloads) {
    if (r.status !== 'Success') continue
    const provider = resolveReloadProvider(r.connectionNo, r.provider) ?? 'Other'
    const key = map[provider] ? provider : 'Other'
    const amt = Number(r.amount)
    map[key].count += 1
    map[key].reloadTotal += amt
    map[key].commission += calcReloadCommission(
      amt, settings, r.connectionNo, r.provider,
      (r.reloadType === 'RECHARGE_CARD' ? 'RECHARGE_CARD' : 'RELOAD') as ReloadServiceType,
    )
  }

  const rows: ProviderReloadStats[] = []
  const seen = new Set<string>()

  const pushRow = (provider: string, stats: { count: number; reloadTotal: number; commission: number }) => {
    seen.add(provider)
    const priorBalance = round2(priorBalanceByProvider[provider] ?? 0)
    const todayNetPayable = round2(stats.reloadTotal - stats.commission)
    const netPayable = round2(priorBalance + todayNetPayable)
    const paid = round2(paidByProvider[provider] ?? 0)
    const remaining = round2(Math.max(0, netPayable - paid))
    rows.push({
      provider,
      count: stats.count,
      reloadTotal: round2(stats.reloadTotal),
      commission: round2(stats.commission),
      priorBalance,
      todayNetPayable,
      netPayable,
      paid,
      remaining,
      isPaid: netPayable > 0 && remaining <= 0.01,
    })
  }

  for (const [provider, stats] of Object.entries(map)) {
    const priorBalance = round2(priorBalanceByProvider[provider] ?? 0)
    if (stats.count === 0 && priorBalance <= 0 && (paidByProvider[provider] ?? 0) === 0) continue
    pushRow(provider, stats)
  }

  for (const [provider, priorBalance] of Object.entries(priorBalanceByProvider)) {
    if (seen.has(provider) || priorBalance <= 0) continue
    if ((paidByProvider[provider] ?? 0) === 0 && priorBalance <= 0) continue
    pushRow(provider, { count: 0, reloadTotal: 0, commission: 0 })
  }

  return rows.sort((a, b) => b.netPayable - a.netPayable || b.reloadTotal - a.reloadTotal)
}

export function summarizeProviderBreakdown(rows: ProviderReloadStats[]) {
  const reloadTotal = round2(rows.reduce((s, r) => s + r.reloadTotal, 0))
  const commission = round2(rows.reduce((s, r) => s + r.commission, 0))
  const priorBalance = round2(rows.reduce((s, r) => s + r.priorBalance, 0))
  const netPayable = round2(rows.reduce((s, r) => s + r.netPayable, 0))
  const paid = round2(rows.reduce((s, r) => s + r.paid, 0))
  const remaining = round2(rows.reduce((s, r) => s + r.remaining, 0))
  return { reloadTotal, commission, priorBalance, netPayable, paid, remaining }
}
