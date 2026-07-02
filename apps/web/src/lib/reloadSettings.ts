export const RELOAD_PROVIDER_IDS = ['Dialog', 'Mobitel', 'Airtel', 'Hutch'] as const
export type ReloadProviderId = (typeof RELOAD_PROVIDER_IDS)[number]
export type ReloadServiceType = 'RELOAD' | 'RECHARGE_CARD'

/** Profit-allocation fund names tied to Daily Reload / Recharge Card */
export function isReloadRelatedFundName(name: string): boolean {
  return name.endsWith(' Reload') || name.endsWith(' Card')
}

export interface ReloadSettings {
  commissions: Record<string, number>
  rechargeCardCommissions: Record<string, number>
  defaultCommission: number
  defaultRechargeCardCommission: number
}

export const DEFAULT_RELOAD_SETTINGS: ReloadSettings = {
  commissions: {
    Dialog: 3,
    Mobitel: 3,
    Airtel: 3,
    Hutch: 3,
  },
  rechargeCardCommissions: {
    Dialog: 2,
    Mobitel: 2,
    Airtel: 2,
    Hutch: 2,
  },
  defaultCommission: 3,
  defaultRechargeCardCommission: 2,
}

export function normalizeReloadSettings(raw: unknown): ReloadSettings {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const commissions: Record<string, number> = { ...DEFAULT_RELOAD_SETTINGS.commissions }
  const rechargeCardCommissions: Record<string, number> = { ...DEFAULT_RELOAD_SETTINGS.rechargeCardCommissions }
  if (src.commissions && typeof src.commissions === 'object') {
    for (const id of RELOAD_PROVIDER_IDS) {
      const v = (src.commissions as Record<string, unknown>)[id]
      if (typeof v === 'number' && !Number.isNaN(v) && v >= 0) commissions[id] = v
    }
  }
  if (src.rechargeCardCommissions && typeof src.rechargeCardCommissions === 'object') {
    for (const id of RELOAD_PROVIDER_IDS) {
      const v = (src.rechargeCardCommissions as Record<string, unknown>)[id]
      if (typeof v === 'number' && !Number.isNaN(v) && v >= 0) rechargeCardCommissions[id] = v
    }
  }
  const defaultCommission =
    typeof src.defaultCommission === 'number' && !Number.isNaN(src.defaultCommission) && src.defaultCommission >= 0
      ? src.defaultCommission
      : DEFAULT_RELOAD_SETTINGS.defaultCommission
  const defaultRechargeCardCommission =
    typeof src.defaultRechargeCardCommission === 'number' && !Number.isNaN(src.defaultRechargeCardCommission) && src.defaultRechargeCardCommission >= 0
      ? src.defaultRechargeCardCommission
      : DEFAULT_RELOAD_SETTINGS.defaultRechargeCardCommission
  return { commissions, rechargeCardCommissions, defaultCommission, defaultRechargeCardCommission }
}

export function getCommissionRate(
  settings: ReloadSettings,
  provider: string,
  serviceType: ReloadServiceType = 'RELOAD',
): number {
  if (serviceType === 'RECHARGE_CARD') {
    return settings.rechargeCardCommissions[provider] ?? settings.defaultRechargeCardCommission
  }
  return settings.commissions[provider] ?? settings.defaultCommission
}

export function calcCommission(
  amount: number,
  settings: ReloadSettings,
  provider: string,
  serviceType: ReloadServiceType = 'RELOAD',
): number {
  const rate = getCommissionRate(settings, provider, serviceType)
  return Math.round(Number(amount) * (rate / 100) * 100) / 100
}

export async function fetchReloadSettings(tenantId: string) {
  const { tenantApi } = await import('./api')
  const res: any = await tenantApi.getReloadSettings(tenantId)
  return normalizeReloadSettings(res?.data ?? res)
}

export async function pushReloadSettings(tenantId: string, settings: ReloadSettings) {
  const { tenantApi } = await import('./api')
  const res: any = await tenantApi.updateReloadSettings(tenantId, settings)
  return normalizeReloadSettings(res?.data ?? res)
}
