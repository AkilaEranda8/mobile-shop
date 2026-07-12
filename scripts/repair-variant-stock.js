/**
 * One-off repair: move parent stock surplus into variant rows when variants show 0.
 * Usage: node scripts/repair-variant-stock.js [tenantId]
 */
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

function hasVariants(variations) {
  return Array.isArray(variations) && variations.length > 0
}

function sumVariantStock(variations) {
  if (!Array.isArray(variations)) return 0
  return variations.reduce((sum, v) => sum + (v.stock ?? 0), 0)
}

function variantKey(v) {
  return v.id ?? `${v.storage}::${v.colorName}`
}

function adjustVariantStock(variations, key, delta) {
  return variations.map(v => {
    const matches = v.id === key || `${v.storage}::${v.colorName}` === key || (v.sku && v.sku === key)
    if (!matches) return v
    return { ...v, stock: Math.max(0, (v.stock ?? 0) + delta) }
  })
}

function reconcileVariantStockWithParent(variations, parentStock) {
  const variantTotal = sumVariantStock(variations)
  const surplus = parentStock - variantTotal
  if (surplus <= 0) return variations

  const key = variations.length === 1
    ? variantKey(variations[0])
    : variantKey(variations.reduce((best, v) => ((v.stock ?? 0) > (best.stock ?? 0) ? v : best), variations[0]))

  return adjustVariantStock(variations, key, surplus)
}

async function main() {
  const tenantId = process.argv[2]
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(tenantId ? { tenantId } : {}),
    },
    select: { id: true, name: true, stock: true, trackImei: true, storageVariations: true },
  })

  let repaired = 0
  for (const product of products) {
    const variations = product.storageVariations
    if (!hasVariants(variations)) continue

    const variantTotal = sumVariantStock(variations)
    if (product.stock <= variantTotal) continue

    const updated = reconcileVariantStockWithParent(variations, product.stock)
    await prisma.product.update({
      where: { id: product.id },
      data: { storageVariations: updated },
    })
    repaired++
    console.log(`Repaired ${product.name} (${product.id}) parent=${product.stock} variants=${variantTotal}${product.trackImei ? ' [IMEI]' : ''}`)
  }

  console.log(`Done. Repaired ${repaired} product(s).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
