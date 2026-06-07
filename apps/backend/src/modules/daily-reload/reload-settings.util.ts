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
): number {
  const resolved = resolveReloadProvider(connectionNo, provider)
  if (resolved) return settings.commissions[resolved] ?? settings.defaultCommission
  return settings.defaultCommission
}

export function calcReloadCommission(
  amount: number,
  settings: ReloadSettings,
  connectionNo: string,
  provider?: string | null,
): number {
  const rate = getCommissionRate(settings, connectionNo, provider)
  return Math.round(Number(amount) * (rate / 100) * 100) / 100
}

export async function fetchTenantReloadSettings(tenantId: string) {
  const { prisma } = await import('../../config/database')
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { reloadSettings: true },
  })
  return normalizeReloadSettings(tenant?.reloadSettings)
}
