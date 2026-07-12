/**
 * Idempotent seed for the 12 July 2026 release note (v2.11.0).
 * Run: npx tsx src/database/seed-july-12-2026-release.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const VERSION = '2.11.0'

type Item = {
  category: 'NEW_FEATURE' | 'IMPROVEMENT' | 'BUG_FIX' | 'SECURITY'
  module: string
  featureName: string
  description: string
  badge: 'NEW' | 'IMPROVED' | 'FIXED' | 'SECURITY'
  displayOrder: number
}

const ITEMS: Item[] = [
  {
    category: 'BUG_FIX', module: 'Inventory', badge: 'FIXED', displayOrder: 0,
    featureName: 'Inventory pagination shows correct products',
    description: 'Moving from page 1 to page 2 (and beyond) now lists the right products. Previously some rows were hidden because the table page size did not match the server query.',
  },
  {
    category: 'BUG_FIX', module: 'Navigation', badge: 'FIXED', displayOrder: 1,
    featureName: 'Inventory sidebar menu highlights correctly',
    description: 'All Products, Add Product, and Stock Transfer now show the correct active state in the sidebar — including when Add Product opens via ?action=add-product.',
  },
  {
    category: 'NEW_FEATURE', module: 'Settings', badge: 'NEW', displayOrder: 2,
    featureName: 'SKU & barcode starting numbers',
    description: 'Under Settings → Shop Info you can set the starting SKU number, barcode number, and SKU padding. New products and bulk imports use these values when codes are left empty.',
  },
  {
    category: 'IMPROVEMENT', module: 'Inventory', badge: 'IMPROVED', displayOrder: 3,
    featureName: 'Bulk import auto-generates product codes',
    description: 'CSV/Excel import only needs product name and category. Empty SKU or barcode columns are filled automatically using your tenant starting numbers.',
  },
  {
    category: 'BUG_FIX', module: 'Settings', badge: 'FIXED', displayOrder: 4,
    featureName: 'Light mode text in SKU settings',
    description: 'Product code settings labels and hints are readable in light theme — no more invisible white or violet text on a white background.',
  },
  {
    category: 'IMPROVEMENT', module: 'Appearance', badge: 'IMPROVED', displayOrder: 5,
    featureName: 'Blue default theme & accent color picker',
    description: 'The system default accent is now blue instead of purple. Settings → Appearance lets you pick Blue, Violet, Cyan, Green, Rose, or Orange — buttons, sidebar, and highlights update instantly.',
  },
]

async function main() {
  const existing = await prisma.release.findFirst({ where: { version: VERSION } })

  const data = {
    title: '12 July 2026 — Inventory Fixes, Product Codes & Blue Theme',
    summary: 'Inventory pagination and sidebar selection fixed, tenant SKU/barcode starting numbers in Settings, bulk import auto-codes, light mode settings text fix, and blue default theme with working accent color picker.',
    releaseDate: new Date('2026-07-12'),
    status: 'PUBLISHED' as const,
    popupEnabled: true,
    active: true,
    targetType: 'ALL',
    targetPlans: [] as string[],
    targetTenants: [] as string[],
    targetBranches: [] as string[],
    items: {
      create: ITEMS.map(i => ({
        category: i.category,
        module: i.module,
        featureName: i.featureName,
        description: i.description,
        badge: i.badge,
        displayOrder: i.displayOrder,
      })),
    },
  }

  if (existing) {
    await prisma.releaseItem.deleteMany({ where: { releaseId: existing.id } })
    await prisma.release.update({ where: { id: existing.id }, data })
    console.log(`✅ Updated release ${VERSION} (${ITEMS.length} items)`)
  } else {
    await prisma.release.create({
      data: {
        version: VERSION,
        createdBy: 'System Seed',
        ...data,
      },
    })
    console.log(`✅ Created release ${VERSION} (${ITEMS.length} items)`)
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
