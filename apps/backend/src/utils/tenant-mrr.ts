import { prisma } from '../config/database'
import { PRICED_FEATURES } from '../modules/tenants/tenant-features'

/**
 * Recompute tenant.mrr = plan base MRR (platformConfig plan_mrr_*) + enabled priced feature prices.
 * Does not overwrite when plan base config is missing (keeps existing mrr for manual overrides).
 */
export async function recalculateTenantMrr(tenantId: string): Promise<number | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true, mrr: true },
  })
  if (!tenant) return null

  const planKey = String(tenant.plan || 'STARTER').toUpperCase()
  const cfg = await prisma.platformConfig.findUnique({ where: { key: `plan_mrr_${planKey}` } })
  if (!cfg?.value) return tenant.mrr

  const base = Number(cfg.value)
  if (!Number.isFinite(base) || base < 0) return tenant.mrr

  const featureRows = await prisma.tenantFeature.findMany({
    where: {
      tenantId,
      feature: { in: [...PRICED_FEATURES] },
      enabled: true,
    },
    select: { price: true },
  })
  const addons = featureRows.reduce((sum, row) => sum + Math.max(0, Number(row.price) || 0), 0)
  const next = Math.round((base + addons) * 100) / 100

  await prisma.tenant.update({ where: { id: tenantId }, data: { mrr: next } })
  return next
}
