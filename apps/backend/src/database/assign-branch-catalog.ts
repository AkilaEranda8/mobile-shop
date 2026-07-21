/**
 * Copy product catalog from one branch to another (same tenant) with stock 0.
 * Does NOT copy IMEIs or stock movements.
 *
 *   npx tsx src/database/assign-branch-catalog.ts \
 *     --tenantSlug=shenzan-mobile-solutions \
 *     --fromBranch=Shenzan Mobile Solutions \
 *     --toBranch="IM TRENDING (PVT) LTD"
 */
import { prisma } from '../config/database'
import { redis } from '../config/redis'
import { destBranchSku, ensureBranchCatalogProduct, findBranchCatalogProduct } from '../utils/branch-catalog'

function arg(name: string, fallback = ''): string {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

async function main() {
  const tenantSlug = arg('tenantSlug')
  const fromBranchName = arg('fromBranch')
  const toBranchName = arg('toBranch')
  const dryRun = process.argv.includes('--dry-run')

  if (!tenantSlug || !fromBranchName || !toBranchName) {
    console.error(
      'Usage: --tenantSlug=... --fromBranch=... --toBranch=... [--dry-run]',
    )
    process.exit(1)
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } })
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`)

  const branches = await prisma.branch.findMany({
    where: { tenantId: tenant.id, isActive: true },
    select: { id: true, name: true },
  })
  const from = branches.find(b => b.name === fromBranchName)
  const to = branches.find(b => b.name === toBranchName)
  if (!from) throw new Error(`From branch not found: ${fromBranchName}`)
  if (!to) throw new Error(`To branch not found: ${toBranchName}`)
  if (from.id === to.id) throw new Error('From and to branch are the same')

  const sources = await prisma.product.findMany({
    where: { tenantId: tenant.id, branchId: from.id, isActive: true },
    orderBy: { createdAt: 'asc' },
  })

  console.log(
    JSON.stringify({
      tenant: tenant.name,
      from: from.name,
      to: to.name,
      sourceProducts: sources.length,
      dryRun,
    }),
  )

  let created = 0
  let skipped = 0
  let errors = 0

  for (const source of sources) {
    try {
      const existing = await findBranchCatalogProduct(prisma, tenant.id, source.sku, to.id)
      if (existing) {
        skipped += 1
        continue
      }
      if (dryRun) {
        console.log(`WOULD CREATE ${destBranchSku(source.sku, to.id)} <- ${source.sku}`)
        created += 1
        continue
      }
      await prisma.$transaction(async tx => {
        await ensureBranchCatalogProduct(tx, tenant.id, source, to.id)
      })
      created += 1
      if (created % 50 === 0) console.log(`… created ${created}/${sources.length}`)
    } catch (e) {
      errors += 1
      console.error(`FAIL ${source.sku}:`, e instanceof Error ? e.message : e)
    }
  }

  const destCount = await prisma.product.count({
    where: { tenantId: tenant.id, branchId: to.id, isActive: true },
  })
  const destStock = await prisma.product.aggregate({
    where: { tenantId: tenant.id, branchId: to.id, isActive: true },
    _sum: { stock: true },
  })

  console.log(
    JSON.stringify({
      created,
      skippedExisting: skipped,
      errors,
      dryRun,
      destProducts: destCount,
      destStockSum: destStock._sum.stock ?? 0,
    }),
  )
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {})
    await redis.quit().catch(() => {})
  })
