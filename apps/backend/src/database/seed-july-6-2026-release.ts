/**
 * Idempotent seed for the 6 July 2026 release note (v2.10.0).
 * Run: npx tsx src/database/seed-july-6-2026-release.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const VERSION = '2.10.0'

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
    category: 'NEW_FEATURE', module: 'Finance', badge: 'NEW', displayOrder: 0,
    featureName: 'Profit & Loss statement page',
    description: 'New Finance → Profit & Loss page with full P&L breakdown — income sources, expense categories, daily profit trend, product category table, efficiency ratios, and CSV export.',
  },
  {
    category: 'NEW_FEATURE', module: 'Finance', badge: 'NEW', displayOrder: 1,
    featureName: 'P&L statement API',
    description: 'Backend /finance/pl-statement endpoint aggregates period income, costs, expenses, and insights using the same math as Daily Closing.',
  },
  {
    category: 'BUG_FIX', module: 'Finance', badge: 'FIXED', displayOrder: 2,
    featureName: 'Manual transactions save correctly',
    description: 'Finance and Expenses pages now pass branchId when recording income or expenses. Backend falls back to the active branch and validates input with Zod.',
  },
  {
    category: 'BUG_FIX', module: 'Expenses', badge: 'FIXED', displayOrder: 3,
    featureName: 'Accurate expense KPIs',
    description: 'Expenses page shows operating expenses only (not COGS/refunds) and uses the same date range as the transaction list.',
  },
  {
    category: 'BUG_FIX', module: 'Daily Closing', badge: 'FIXED', displayOrder: 4,
    featureName: 'Opening cash & day reopen',
    description: 'Empty opening cash no longer breaks totals. Reopening a closed day reverses profit allocation and clears the saved daily summary.',
  },
  {
    category: 'BUG_FIX', module: 'Reports', badge: 'FIXED', displayOrder: 5,
    featureName: 'Branch & date filters on reports',
    description: 'Inventory, repairs, delivery, and daily reload reports respect the active branch. Delivery tab supports custom from/to dates. Top products align to the selected period.',
  },
  {
    category: 'IMPROVEMENT', module: 'Reports', badge: 'IMPROVED', displayOrder: 6,
    featureName: 'Reports & Analytics consolidated',
    description: 'Analytics redirects to Reports. All tabs show loading and error states with retry. Deep links use ?tab= (e.g. /dashboard/reports?tab=pl). Dashboard links point to Reports.',
  },
  {
    category: 'IMPROVEMENT', module: 'Profit Allocation', badge: 'IMPROVED', displayOrder: 7,
    featureName: 'Historical fund balances',
    description: 'Period summary opening and closing balances come from the transaction ledger. Default funds are generic (no hard-coded tenant names). Managers can save allocations.',
  },
  {
    category: 'IMPROVEMENT', module: 'Finance', badge: 'IMPROVED', displayOrder: 8,
    featureName: 'Faster long-range reports',
    description: 'Closed business days use cached Daily Closing records instead of recomputing full previews — quicker P&L and revenue breakdowns for 30–365 day ranges.',
  },
  {
    category: 'IMPROVEMENT', module: 'Category Report', badge: 'IMPROVED', displayOrder: 9,
    featureName: 'Category vs allocation guide',
    description: 'Info banner explains product categories (inventory) vs Profit Allocation revenue buckets so totals are easier to interpret.',
  },
]

async function main() {
  const existing = await prisma.release.findFirst({ where: { version: VERSION } })

  const data = {
    title: '6 July 2026 — Profit & Loss & Finance Fixes',
    summary: 'New Profit & Loss page with full business breakdown, finance data integrity fixes, accurate reports with branch filters, and improved profit allocation balances.',
    releaseDate: new Date('2026-07-06'),
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
