/**
 * One-shot: fix numeric SKU collisions (111 vs 00111) for every tenant.
 *   npx tsx src/database/repair-sku-collisions.ts
 */
import { prisma } from '../config/database'
import { syncProductCodeCounters, fetchTenantProductCodeSettings } from '../modules/products/product-code-settings.util'

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true, name: true } })
  console.log(`Repairing SKU collisions for ${tenants.length} tenants…`)
  for (const t of tenants) {
    const settings = await fetchTenantProductCodeSettings(t.id)
    await syncProductCodeCounters(t.id, t.slug, settings)
    console.log(`  ✓ ${t.slug}`)
  }
  console.log('Done.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
