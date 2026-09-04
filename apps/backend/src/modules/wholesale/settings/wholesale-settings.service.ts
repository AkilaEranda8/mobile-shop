import { prisma } from '../../../config/database'

export type WholesaleSettings = {
  overdueToleranceDays: number
  imeiSoftReserveTtlMs: number
  allowPartialCarton: boolean
  defaultHoldPolicy: 'PARTIAL_BACKORDER' | 'HOLD_COMPLETE'
  ageingBuckets: number[]
  discountAuthorityPercent: number
}

const DEFAULTS: WholesaleSettings = {
  overdueToleranceDays: 7,
  imeiSoftReserveTtlMs: 5 * 60 * 1000,
  allowPartialCarton: true,
  defaultHoldPolicy: 'PARTIAL_BACKORDER',
  ageingBuckets: [0, 30, 60, 90],
  discountAuthorityPercent: 5,
}

function asSettings(raw: unknown): WholesaleSettings {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    overdueToleranceDays: Number(src.overdueToleranceDays ?? DEFAULTS.overdueToleranceDays) || DEFAULTS.overdueToleranceDays,
    imeiSoftReserveTtlMs: Number(src.imeiSoftReserveTtlMs ?? DEFAULTS.imeiSoftReserveTtlMs) || DEFAULTS.imeiSoftReserveTtlMs,
    allowPartialCarton: src.allowPartialCarton !== false,
    defaultHoldPolicy: src.defaultHoldPolicy === 'HOLD_COMPLETE' ? 'HOLD_COMPLETE' : 'PARTIAL_BACKORDER',
    ageingBuckets: Array.isArray(src.ageingBuckets)
      ? (src.ageingBuckets as number[]).map(Number).filter(n => !Number.isNaN(n))
      : DEFAULTS.ageingBuckets,
    discountAuthorityPercent: Number(src.discountAuthorityPercent ?? DEFAULTS.discountAuthorityPercent) || 0,
  }
}

/**
 * Tenant has no generic `settings` Json — store under posUiSettings.wholesale
 * (dedicated wholesaleSettings column can replace this later).
 */
export async function getWholesaleSettings(tenantId: string): Promise<WholesaleSettings> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { posUiSettings: true },
  })
  const bag = (tenant?.posUiSettings as Record<string, unknown> | null) ?? {}
  return asSettings(bag.wholesale)
}

export async function upsertWholesaleSettings(
  tenantId: string,
  patch: Partial<WholesaleSettings>,
): Promise<WholesaleSettings> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { posUiSettings: true },
  })
  const prev = (tenant?.posUiSettings as Record<string, unknown> | null) ?? {}
  const nextWholesale = { ...asSettings(prev.wholesale), ...patch }
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { posUiSettings: { ...prev, wholesale: nextWholesale } as object },
  })
  return nextWholesale
}
