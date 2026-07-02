/**
 * Idempotent seed for the 2 July 2026 release note (v2.8.0).
 * Run: npx tsx src/database/seed-july-2-2026-release.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const VERSION = '2.8.0'

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
    category: 'IMPROVEMENT', module: 'System', badge: 'IMPROVED', displayOrder: 0,
    featureName: 'Fewer clicks across the app',
    description: 'Inventory, repairs, sales, customers, warranty, suppliers, finance, stock transfer, returns, exchanges, IMEI, staff, and branches now open details and actions inline — less page hopping for everyday work.',
  },
  {
    category: 'NEW_FEATURE', module: 'System', badge: 'NEW', displayOrder: 1,
    featureName: 'Toolbar search',
    description: 'Single search bar on list pages filters rows instantly. Column search dropdowns removed where they duplicated the toolbar.',
  },
  {
    category: 'IMPROVEMENT', module: 'Repairs', badge: 'IMPROVED', displayOrder: 2,
    featureName: 'Repair jobs — faster workflow',
    description: 'Create and update repair jobs in modals, filter by status chips, row click opens details, and deep links (?action=, ?id=) work from dashboard quick actions.',
  },
  {
    category: 'IMPROVEMENT', module: 'Inventory', badge: 'IMPROVED', displayOrder: 3,
    featureName: 'Inventory inline actions',
    description: 'Add product opens in a modal from the inventory page (?action=add-product). Filters persist when you return. Row click opens product details.',
  },
  {
    category: 'IMPROVEMENT', module: 'Sales', badge: 'IMPROVED', displayOrder: 4,
    featureName: 'Sales & suppliers quick access',
    description: 'Sales list and supplier PO flows use inline modals and stat-card filters. Search and status filters stay on one screen.',
  },
  {
    category: 'IMPROVEMENT', module: 'Dashboard', badge: 'IMPROVED', displayOrder: 5,
    featureName: 'Dashboard quick actions',
    description: 'Quick action buttons link straight to the right page with ?action= pre-filled — e.g. new repair, new sale, add product — one click from home.',
  },
  {
    category: 'IMPROVEMENT', module: 'Branches', badge: 'IMPROVED', displayOrder: 6,
    featureName: 'Simpler branch switcher',
    description: 'Header branch control is leaner — pick your working branch without extra confirmation steps.',
  },

  {
    category: 'SECURITY', module: 'Admin', badge: 'SECURITY', displayOrder: 10,
    featureName: 'Support session links',
    description: 'Admin “login as shop” now uses /support-session with a one-time code only — JWT tokens are no longer passed in the browser URL.',
  },
  {
    category: 'SECURITY', module: 'System', badge: 'SECURITY', displayOrder: 11,
    featureName: 'Legacy impersonate redirect',
    description: '/impersonate redirects to the new support-session flow. Old ?token= links are rejected and send users to login.',
  },
  {
    category: 'SECURITY', module: 'System', badge: 'SECURITY', displayOrder: 12,
    featureName: 'Site trust signals',
    description: 'HSTS, robots.txt, sitemap.xml, and security.txt updated. Support paths are noindex to reduce false security scanner flags.',
  },
]

async function main() {
  const existing = await prisma.release.findFirst({ where: { version: VERSION } })

  const data = {
    title: '2 July 2026 — Faster UI & Secure Support Access',
    summary: 'App-wide click reduction with toolbar search and inline modals, repair/inventory/sales workflow improvements, and secure support-session links instead of JWT URLs.',
    releaseDate: new Date('2026-07-02'),
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
