export const RELOAD_PROVIDER_IDS = ['Dialog', 'Mobitel', 'Airtel', 'Hutch'] as const
export type ReloadProviderId = (typeof RELOAD_PROVIDER_IDS)[number]

export interface ReloadSettings {
  commissions: Record<string, number>
  defaultCommission: number
}

export const DEFAULT_RELOAD_SETTINGS: ReloadSettings = {
  commissions: {
    Dialog: 3,
    Mobitel: 3,
    Airtel: 3,
    Hutch: 3,
  },
  defaultCommission: 3,
}

export function normalizeReloadSettings(raw: unknown): ReloadSettings {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const commissions: Record<string, number> = { ...DEFAULT_RELOAD_SETTINGS.commissions }
  if (src.commissions && typeof src.commissions === 'object') {
    for (const id of RELOAD_PROVIDER_IDS) {
      const v = (src.commissions as Record<string, unknown>)[id]
      if (typeof v === 'number' && !Number.isNaN(v) && v >= 0) commissions[id] = v
    }
  }
  const defaultCommission =
    typeof src.defaultCommission === 'number' && !Number.isNaN(src.defaultCommission) && src.defaultCommission >= 0
      ? src.defaultCommission
      : DEFAULT_RELOAD_SETTINGS.defaultCommission
  return { commissions, defaultCommission }
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
