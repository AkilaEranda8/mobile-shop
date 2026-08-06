/**
 * Idempotent seed for the 6 August 2026 customer release note (v2.15.0).
 * Shop-facing only — no internal/security/admin details.
 * Run: npx tsx src/database/seed-aug-6-2026-release.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const VERSION = '2.15.0'

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
    category: 'IMPROVEMENT', module: 'Purchase Orders', badge: 'IMPROVED', displayOrder: 0,
    featureName: 'Faster product search on New Purchase Order',
    description: 'When creating a purchase order, typing even a single letter (for example “A”) now searches your full product list and shows matching items quickly — no more empty or incomplete dropdowns.',
  },
  {
    category: 'IMPROVEMENT', module: 'Profit Allocation', badge: 'IMPROVED', displayOrder: 1,
    featureName: 'Period and daily profit totals',
    description: 'On Profit Allocation & Fund Management, choosing 7 Days, 30 Days, or This Month now shows combined sales, profit, and allocated amounts for the whole period, plus a day-by-day totals table.',
  },
  {
    category: 'IMPROVEMENT', module: 'Staff & Permissions', badge: 'IMPROVED', displayOrder: 2,
    featureName: 'Hide product buy prices with Product Cost permission',
    description: 'When Product Cost is set to Hide for a role, buying prices stay hidden across inventory, purchase orders, sales, repairs, and related screens — so only authorized staff can see costs.',
  },
  {
    category: 'IMPROVEMENT', module: 'POS & Customers', badge: 'IMPROVED', displayOrder: 3,
    featureName: 'Redeem customer store credit at checkout',
    description: 'If your shop owes a customer store credit, you can apply it directly at POS checkout when settling a sale.',
  },
  {
    category: 'IMPROVEMENT', module: 'Returns', badge: 'IMPROVED', displayOrder: 4,
    featureName: 'Flexible return settlements',
    description: 'Sale returns can still settle against customer credit, and cash refunds remain available when you need them.',
  },
  {
    category: 'BUG_FIX', module: 'Daily Closing', badge: 'FIXED', displayOrder: 5,
    featureName: 'Safer day closing dates',
    description: 'Future-dated day closes are blocked, and the system warns you if you try to close a day that has no sales but a cash count — helping prevent wrong-day closings and large variances.',
  },
]

async function main() {
  const existing = await prisma.release.findFirst({ where: { version: VERSION } })

  const data = {
    title: '6 August 2026 — Purchase Orders, Profit Totals & Staff Cost Privacy',
    summary:
      'Faster product search on new purchase orders, combined daily and period totals on Profit Allocation, hide buy prices when Product Cost permission is off, redeem store credit at POS, and safer daily closing date checks.',
    releaseDate: new Date('2026-08-06'),
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
