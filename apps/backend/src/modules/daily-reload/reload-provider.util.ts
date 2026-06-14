import {
  RELOAD_PROVIDER_IDS,
  calcReloadCommission,
  fetchTenantReloadSettings,
  resolveReloadProvider,
  type ReloadSettings,
} from './reload-settings.util'

export interface ProviderReloadStats {
  provider: string
  count: number
  reloadTotal: number
  commission: number
  netPayable: number
  paid: number
  remaining: number
  isPaid: boolean
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

export function buildProviderBreakdown(
  reloads: Array<{ amount: number; connectionNo: string; provider?: string | null; status: string }>,
  settings: ReloadSettings,
  paidByProvider: Record<string, number>,
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
    map[key].commission += calcReloadCommission(amt, settings, r.connectionNo, r.provider)
  }

  const rows: ProviderReloadStats[] = []
  for (const [provider, stats] of Object.entries(map)) {
    if (stats.count === 0 && (paidByProvider[provider] ?? 0) === 0) continue
    const reloadTotal = round2(stats.reloadTotal)
    const commission = round2(stats.commission)
    const netPayable = round2(reloadTotal - commission)
    const paid = round2(paidByProvider[provider] ?? 0)
    const remaining = round2(Math.max(0, netPayable - paid))
    rows.push({
      provider,
      count: stats.count,
      reloadTotal,
      commission,
      netPayable,
      paid,
      remaining,
      isPaid: netPayable > 0 && remaining <= 0.01,
    })
  }

  return rows.sort((a, b) => b.reloadTotal - a.reloadTotal)
}

export function summarizeProviderBreakdown(rows: ProviderReloadStats[]) {
  const reloadTotal = round2(rows.reduce((s, r) => s + r.reloadTotal, 0))
  const commission = round2(rows.reduce((s, r) => s + r.commission, 0))
  const netPayable = round2(rows.reduce((s, r) => s + r.netPayable, 0))
  const paid = round2(rows.reduce((s, r) => s + r.paid, 0))
  const remaining = round2(rows.reduce((s, r) => s + r.remaining, 0))
  return { reloadTotal, commission, netPayable, paid, remaining }
}
