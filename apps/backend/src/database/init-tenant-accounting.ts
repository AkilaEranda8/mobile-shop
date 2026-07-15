/**
 * One-off: initialize accounting for a tenant by slug or id.
 * Run: npx tsx src/database/init-tenant-accounting.ts <slug-or-id>
 */
import { PrismaClient } from '@prisma/client'
import { initializeAccounting } from '../modules/accounting/accounting-init.service'

const prisma = new PrismaClient()

async function main() {
  const key = process.argv[2]?.trim()
  if (!key) {
    console.error('Usage: npx tsx src/database/init-tenant-accounting.ts <tenant-slug-or-id>')
    process.exit(1)
  }

  const tenant = await prisma.tenant.findFirst({
    where: { OR: [{ id: key }, { slug: key }] },
    select: { id: true, slug: true, name: true },
  })
  if (!tenant) {
    console.error(`Tenant not found: ${key}`)
    process.exit(1)
  }

  const result = await initializeAccounting(tenant.id, 'system-init-script')
  console.log(JSON.stringify({ tenant, result: { alreadyInitialized: result.alreadyInitialized, initializedAt: (result as any).settings?.initializedAt } }, null, 2))
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
