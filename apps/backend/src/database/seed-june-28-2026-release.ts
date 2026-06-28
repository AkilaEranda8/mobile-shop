/**
 * Idempotent seed for the 28 June 2026 release note (v2.7.0).
 * Run: npx tsx src/database/seed-june-28-2026-release.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const VERSION = '2.7.0'

type Item = {
  category: 'NEW_FEATURE' | 'IMPROVEMENT' | 'BUG_FIX'
  module: string
  featureName: string
  description: string
  badge: 'NEW' | 'IMPROVED' | 'FIXED'
  displayOrder: number
}

const ITEMS: Item[] = [
  {
    category: 'NEW_FEATURE', module: 'Onboarding', badge: 'NEW', displayOrder: 0,
    featureName: 'Trial setup guide',
    description: 'New TRIAL shops get a step-by-step setup coach on every page — shop profile, invoice, first product, and first sale — with Sinhala + English tips and a welcome modal.',
  },
  {
    category: 'NEW_FEATURE', module: 'Settings', badge: 'NEW', displayOrder: 1,
    featureName: 'In-app User Manual',
    description: 'Full Hexalyte user guide inside Settings → User Manual (English + Sinhala), matching the help docs shipped with this release.',
  },
  {
    category: 'NEW_FEATURE', module: 'Branches', badge: 'NEW', displayOrder: 2,
    featureName: 'Active branch switcher',
    description: 'Switch working branch from the header. POS, sales, inventory, reports, and daily closing respect the selected branch. Choice is remembered per user.',
  },
  {
    category: 'NEW_FEATURE', module: 'Inventory', badge: 'NEW', displayOrder: 3,
    featureName: 'Stock transfer between branches',
    description: 'Move stock from one branch to another with a dedicated Stock Transfer page — select products, quantities, and destination branch in one flow.',
  },
  {
    category: 'NEW_FEATURE', module: 'POS', badge: 'NEW', displayOrder: 4,
    featureName: 'Edit warranty in POS cart',
    description: 'Change warranty period and warranty note on cart items before checkout without leaving POS.',
  },
  {
    category: 'NEW_FEATURE', module: 'Inventory', badge: 'NEW', displayOrder: 5,
    featureName: 'Expanded product details view',
    description: 'Product details panel shows the same fields as Create Product — variants, pricing, warranty, and IMEI settings in one place.',
  },

  {
    category: 'IMPROVEMENT', module: 'Onboarding', badge: 'IMPROVED', displayOrder: 10,
    featureName: 'Setup guide UI polish',
    description: 'Light-mode friendly coach bar with readable trial badge, expand/dismiss controls, and page-specific tips on Settings, Inventory, and POS.',
  },
  {
    category: 'IMPROVEMENT', module: 'Invoice', badge: 'IMPROVED', displayOrder: 11,
    featureName: 'Stock form invoice layout',
    description: 'Stock form print layout improved for warranty note and footer text on dot-matrix / stock invoices.',
  },
  {
    category: 'IMPROVEMENT', module: 'Inventory', badge: 'IMPROVED', displayOrder: 12,
    featureName: 'Product CSV import',
    description: 'CSV import columns aligned with Create Product — buy/sell price, variants, warranty, and category mapping.',
  },
  {
    category: 'IMPROVEMENT', module: 'Admin', badge: 'IMPROVED', displayOrder: 13,
    featureName: 'Release notes branch targeting',
    description: 'Admin can target a release note to specific branches, plans, or tenants when publishing updates.',
  },
  {
    category: 'IMPROVEMENT', module: 'Branches', badge: 'IMPROVED', displayOrder: 14,
    featureName: 'Default branch per shop',
    description: 'Branches can be marked as default; new sessions pick the correct branch automatically for staff with multiple locations.',
  },

  {
    category: 'BUG_FIX', module: 'Settings', badge: 'FIXED', displayOrder: 20,
    featureName: 'Shop Information typing reset',
    description: 'Fixed Shop Info fields clearing while typing — form no longer reloads from server on every keystroke.',
  },
  {
    category: 'BUG_FIX', module: 'Onboarding', badge: 'FIXED', displayOrder: 21,
    featureName: 'Setup guide on dashboard routes',
    description: 'Guide now detects /dashboard/settings and /dashboard/inventory paths correctly and stays visible below the header on all pages.',
  },
  {
    category: 'BUG_FIX', module: 'POS', badge: 'FIXED', displayOrder: 22,
    featureName: 'POS warranty editor light mode',
    description: 'Warranty period/note editor in POS cart is readable in light theme with correct layout.',
  },
  {
    category: 'BUG_FIX', module: 'Purchase', badge: 'FIXED', displayOrder: 23,
    featureName: 'PO receive & IMEI registration',
    description: 'Purchase order receive runs in a DB transaction; IMEI registration timestamp tracked on receive.',
  },
]

async function main() {
  const existing = await prisma.release.findFirst({ where: { version: VERSION } })

  const data = {
    title: '28 June 2026 — Setup Guide, Branches & Stock Transfer',
    summary: 'Trial onboarding coach, in-app user manual, header branch switcher, stock transfer between branches, POS warranty editing, and shop settings fixes.',
    releaseDate: new Date('2026-06-28'),
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
