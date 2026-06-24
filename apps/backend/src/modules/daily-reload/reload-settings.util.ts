import { prisma } from '../../config/database'

export const RELOAD_PROVIDER_IDS = ['Dialog', 'Mobitel', 'Airtel', 'Hutch'] as const
export type ReloadProviderId = (typeof RELOAD_PROVIDER_IDS)[number]
export type ReloadServiceType = 'RELOAD' | 'RECHARGE_CARD'

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

export function resolveReloadProvider(connectionNo: string, provider?: string | null): ReloadProviderId | null {
  if (provider && RELOAD_PROVIDER_IDS.includes(provider as ReloadProviderId)) return provider as ReloadProviderId
  const trimmed = connectionNo.trim()
  if (RELOAD_PROVIDER_IDS.includes(trimmed as ReloadProviderId)) return trimmed as ReloadProviderId
  return null
}

export function getCommissionRate(
  settings: ReloadSettings,
  connectionNo: string,
  provider?: string | null,
  serviceType: ReloadServiceType = 'RELOAD',
): number {
  const resolved = resolveReloadProvider(connectionNo, provider)
  if (serviceType === 'RECHARGE_CARD') {
    if (resolved) return settings.rechargeCardCommissions[resolved] ?? settings.defaultRechargeCardCommission
    return settings.defaultRechargeCardCommission
  }
  if (resolved) return settings.commissions[resolved] ?? settings.defaultCommission
  return settings.defaultCommission
}

export function calcReloadCommission(
  amount: number,
  settings: ReloadSettings,
  connectionNo: string,
  provider?: string | null,
  serviceType: ReloadServiceType = 'RELOAD',
): number {
  const rate = getCommissionRate(settings, connectionNo, provider, serviceType)
  return Math.round(Number(amount) * (rate / 100) * 100) / 100
}

export async function fetchTenantReloadSettings(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { reloadSettings: true },
  })
  return normalizeReloadSettings(tenant?.reloadSettings)
}
