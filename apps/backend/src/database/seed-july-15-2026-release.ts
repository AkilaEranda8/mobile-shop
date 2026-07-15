/**
 * Idempotent seed for the 15 July 2026 release note (v2.13.0).
 * Run: npx tsx src/database/seed-july-15-2026-release.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const VERSION = '2.13.0'

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
    category: 'BUG_FIX', module: 'Finance & Reports', badge: 'FIXED', displayOrder: 0,
    featureName: 'Gross profit uses PO buying cost',
    description: 'Gross profit and COGS now use the purchase-order received buying price (including variant cost after receive), not the older buying price from Add Product. Each sale line also snapshots unit cost so reports stay accurate.',
  },
  {
    category: 'NEW_FEATURE', module: 'Daily Reload', badge: 'NEW', displayOrder: 1,
    featureName: 'Full Daily Reload report',
    description: 'New Daily Reload report page with provider and type breakdown so you can review reload / recharge activity in one place.',
  },
  {
    category: 'IMPROVEMENT', module: 'Suppliers', badge: 'IMPROVED', displayOrder: 2,
    featureName: 'Supplier details modal',
    description: 'Supplier details now open in a richer Sales-style layout with clearer PO summary, balances, and contact info.',
  },
  {
    category: 'BUG_FIX', module: 'Inventory', badge: 'FIXED', displayOrder: 3,
    featureName: 'Duplicate inventory # column',
    description: 'Inventory no longer shows the same # for products whose SKUs differ only by leading zeros (for example 00111 and 111).',
  },
  {
    category: 'BUG_FIX', module: 'Staff & Roles', badge: 'FIXED', displayOrder: 4,
    featureName: 'Staff list empty for managers',
    description: 'Staff & Roles now loads employees correctly when Keycloak tokens omit role claims — roles are resolved from the shop database.',
  },
  {
    category: 'BUG_FIX', module: 'Auth', badge: 'FIXED', displayOrder: 5,
    featureName: 'Keycloak login username conflict',
    description: 'Login no longer fails with authentication-service errors when Keycloak treats username as read-only.',
  },
  {
    category: 'SECURITY', module: 'Platform', badge: 'SECURITY', displayOrder: 6,
    featureName: 'Production secrets hardening',
    description: 'Deploy and Docker Compose load credentials from environment / server .env only. Production seed is blocked, and weak bootstrap admin passwords are rejected.',
  },
]

async function main() {
  const existing = await prisma.release.findFirst({ where: { version: VERSION } })

  const data = {
    title: '15 July 2026 — PO Cost Profit, Daily Reload Report & Fixes',
    summary:
      'Gross profit now follows PO-received buying cost, plus a full Daily Reload report, improved supplier details, inventory # and staff-list fixes, Keycloak login reliability, and production secrets hardening.',
    releaseDate: new Date('2026-07-15'),
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
