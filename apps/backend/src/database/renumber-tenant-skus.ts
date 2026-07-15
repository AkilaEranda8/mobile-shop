/**
 * Renumber all product SKUs for one tenant starting at 1 (or --start=N).
 *
 *   npx tsx src/database/renumber-tenant-skus.ts --slug=sahasma-gift-corner-and-i-phone-market-mrggsibo
 *   npx tsx src/database/renumber-tenant-skus.ts --slug=... --start=1 --pad=5 --prefix=SAHASM-SKU
 */
import { prisma } from '../config/database'
import { redis } from '../config/redis'
import { syncProductCodeCounters, fetchTenantProductCodeSettings } from '../modules/products/product-code-settings.util'

/** Update variant SKUs that used the old product SKU / old sequence digits. */
function remappVariantSkus(storageVariations: unknown, oldSku: string, newSku: string): unknown {
  if (!Array.isArray(storageVariations)) return storageVariations
  const oldNum = oldSku.match(/(\d+)$/)?.[1]
  const newNum = newSku.match(/(\d+)$/)?.[1]
  return storageVariations.map((v) => {
    if (!v || typeof v !== 'object') return v
    const row = { ...(v as Record<string, unknown>) }
    const vSku = typeof row.sku === 'string' ? row.sku : ''
    if (!vSku) return row
    if (vSku === oldSku || vSku.startsWith(`${oldSku}-`)) {
      row.sku = newSku + vSku.slice(oldSku.length)
      return row
    }
    if (oldNum && newNum && vSku.includes(oldNum)) {
      row.sku = vSku.replace(oldNum, newNum)
    }
    return row
  })
}

function arg(name: string, fallback = ''): string {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

async function main() {
  const slug = arg('slug')
  if (!slug) {
    console.error('Usage: --slug=<tenant-slug> [--start=1] [--pad=5] [--prefix=SAHASM-SKU]')
    process.exit(1)
  }
  const start = Math.max(1, parseInt(arg('start', '1'), 10) || 1)
  const pad = Math.min(12, Math.max(3, parseInt(arg('pad', '5'), 10) || 5))

  const tenant = await prisma.tenant.findUnique({ where: { slug } })
  if (!tenant) {
    console.error(`Tenant not found: ${slug}`)
    process.exit(1)
  }

  const products = await prisma.product.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, sku: true, name: true, storageVariations: true, createdAt: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })

  const defaultPrefix = arg('prefix') || (() => {
    const m = products[0]?.sku.match(/^(.+)-(\d+)$/)
    return m?.[1] ?? `${slug.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase() || 'TNT'}-SKU`
  })()

  console.log(`Tenant: ${tenant.name} (${tenant.slug})`)
  console.log(`Products: ${products.length} → ${defaultPrefix}-#### from ${start}`)

  // Two-phase rename to avoid unique (tenantId, sku) conflicts
  const temps: Array<{ id: string; oldSku: string; tempSku: string; finalSku: string; storageVariations: unknown }> = []
  let seq = start
  for (const p of products) {
    const finalSku = `${defaultPrefix}-${String(seq).padStart(pad, '0')}`
    const tempSku = `__RENUM_${p.id.slice(-8)}_${seq}__`
    temps.push({
      id: p.id,
      oldSku: p.sku,
      tempSku,
      finalSku,
      storageVariations: p.storageVariations,
    })
    seq++
  }

  for (const row of temps) {
    await prisma.product.update({
      where: { id: row.id },
      data: { sku: row.tempSku },
    })
  }

  for (const row of temps) {
    const variations = remappVariantSkus(row.storageVariations, row.oldSku, row.finalSku)
    await prisma.product.update({
      where: { id: row.id },
      data: {
        sku: row.finalSku,
        storageVariations: variations as any,
      },
    })
    console.log(`  ${row.oldSku} → ${row.finalSku}  (${row.id.slice(0, 8)}…)`)
  }

  await redis.set(`product_sku_seq:${tenant.id}`, String(start + products.length - 1))
  await redis.set(`product_sku_fmt:${tenant.id}`, `prefix:${defaultPrefix}:${pad}`)

  const settings = await fetchTenantProductCodeSettings(tenant.id)
  await syncProductCodeCounters(tenant.id, tenant.slug, {
    ...settings,
    skuStartNumber: start,
    skuPad: pad,
  })

  console.log(`Done. Next SKU will be ${defaultPrefix}-${String(start + products.length).padStart(pad, '0')}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => {
    await prisma.$disconnect()
    try { redis.disconnect() } catch { /* ignore */ }
  })
