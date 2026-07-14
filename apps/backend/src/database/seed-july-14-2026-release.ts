/**
 * Idempotent seed for the 13–14 July 2026 release note (v2.12.0).
 * Run: npx tsx src/database/seed-july-14-2026-release.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const VERSION = '2.12.0'

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
    category: 'NEW_FEATURE', module: 'Barcode', badge: 'NEW', displayOrder: 0,
    featureName: 'Barcode label customization',
    description: 'Design 38×25mm thermal sticker labels with shop name, product name, barcode, and price. Adjust spacing and layout from a dedicated Barcode Labels settings page.',
  },
  {
    category: 'NEW_FEATURE', module: 'Purchase Orders', badge: 'NEW', displayOrder: 1,
    featureName: 'Bulk PO CSV import',
    description: 'Import many purchase-order lines at once from a CSV file to speed up goods receiving and purchasing workflows.',
  },
  {
    category: 'NEW_FEATURE', module: 'Appearance', badge: 'NEW', displayOrder: 2,
    featureName: 'Text size & font controls',
    description: 'Settings → Appearance now lets you change interface text size and fonts so the dashboard is easier to read on every screen.',
  },
  {
    category: 'NEW_FEATURE', module: 'Dashboard', badge: 'NEW', displayOrder: 3,
    featureName: 'Ready for Pickup KPI & filled empty panels',
    description: 'Dashboard now highlights repairs ready for pickup, shows a clearer Sales Overview today snapshot, Recent Activity that needs action, and a dedicated Business Health card.',
  },
  {
    category: 'NEW_FEATURE', module: 'Customers & Sales', badge: 'NEW', displayOrder: 4,
    featureName: 'Detail modals for customers, returns & exchanges',
    description: 'Open customers, returns, and exchanges in Sales-style detail modals with full context — no need to leave the list view for basic details.',
  },
  {
    category: 'IMPROVEMENT', module: 'Purchase Orders', badge: 'IMPROVED', displayOrder: 5,
    featureName: 'PO details, GRN & label printing',
    description: 'Purchase order details and goods-received flows are clearer, with improved barcode preview and label printing when receiving stock.',
  },
  {
    category: 'IMPROVEMENT', module: 'Sales', badge: 'IMPROVED', displayOrder: 6,
    featureName: 'Sales modal theming',
    description: 'Sale detail modals follow the same theme and contrast rules as the rest of the dashboard in both light and dark mode.',
  },
  {
    category: 'IMPROVEMENT', module: 'Repairs', badge: 'IMPROVED', displayOrder: 7,
    featureName: 'Expanded repair thermal print options',
    description: 'More control over what appears on repair intake / custody thermal slips, aligned with invoice thermal settings.',
  },
  {
    category: 'IMPROVEMENT', module: 'Profit Allocation', badge: 'IMPROVED', displayOrder: 8,
    featureName: 'Today / Yesterday / Total fund columns',
    description: 'Allocation Details show Today (from today’s profit), Yesterday (carried balance), and Total (running total). Soft-delete funds no longer reappear as defaults, and managers can manage funds. Page focuses on today’s allocation.',
  },
  {
    category: 'BUG_FIX', module: 'Appearance', badge: 'FIXED', displayOrder: 9,
    featureName: 'Light-mode text contrast',
    description: 'Fixed hard-to-read or invisible text across several dashboard screens when using light theme.',
  },
  {
    category: 'BUG_FIX', module: 'Barcode', badge: 'FIXED', displayOrder: 10,
    featureName: 'Dense barcode sticker overlap',
    description: 'Shop name, product name, barcode, digits, and price no longer overlap on small thermal stickers — content stacks cleanly on 38×25mm labels.',
  },
  {
    category: 'BUG_FIX', module: 'POS', badge: 'FIXED', displayOrder: 11,
    featureName: 'Thermal auto-print after sale',
    description: 'POS bills print more reliably after checkout. The print window no longer closes too early (which cancelled thermal jobs), and a hidden iframe fallback still prints if the popup is blocked.',
  },
  {
    category: 'BUG_FIX', module: 'Repairs', badge: 'FIXED', displayOrder: 12,
    featureName: 'Duplicate Job # column removed',
    description: 'The Jobs list no longer shows two identical # columns for the same job number.',
  },
]

async function main() {
  const existing = await prisma.release.findFirst({ where: { version: VERSION } })

  const data = {
    title: '13–14 July 2026 — Barcodes, PO Import, Profit Allocation & POS Print',
    summary:
      'Barcode label designer and settings, bulk PO CSV import, appearance fonts/sizes, dashboard pickup KPI and detail modals, profit allocation Today/Yesterday/Total columns, plus fixes for light-mode contrast, sticker overlap, and POS thermal auto-print.',
    releaseDate: new Date('2026-07-14'),
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
