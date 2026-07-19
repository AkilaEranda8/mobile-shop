/**
 * Idempotent seed for the 18 July 2026 release note (v2.14.0).
 * Run: npx tsx src/database/seed-july-18-2026-release.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const VERSION = '2.14.0'

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
    category: 'NEW_FEATURE', module: 'Feature Suggestions', badge: 'NEW', displayOrder: 0,
    featureName: 'Send and track feature suggestions',
    description: 'Shop users can now submit feature ideas from the dashboard, review their suggestion history, and receive notifications when the platform team updates the status or sends a response.',
  },
  {
    category: 'NEW_FEATURE', module: 'Platform Admin', badge: 'NEW', displayOrder: 1,
    featureName: 'Feature suggestion management inbox',
    description: 'Platform administrators can review suggestions across all shops, filter and prioritize requests, update progress, add internal notes, and send public responses to users.',
  },
  {
    category: 'IMPROVEMENT', module: 'Supplier Payments', badge: 'IMPROVED', displayOrder: 2,
    featureName: 'Safer multi-PO supplier payments',
    description: 'A supplier payment can now be allocated accurately across multiple received purchase orders. Overpayments, empty selections, invalid purchase orders, and duplicate allocations are blocked.',
  },
  {
    category: 'IMPROVEMENT', module: 'Accounting', badge: 'IMPROVED', displayOrder: 3,
    featureName: 'Automatic Main Cash and Main Bank posting',
    description: 'Cash supplier payments reduce the branch Main Cash account automatically. Bank and cheque payments use the default Main Bank accounting mapping, with no manual bank selector required.',
  },
  {
    category: 'IMPROVEMENT', module: 'Supplier Payments', badge: 'IMPROVED', displayOrder: 4,
    featureName: 'Cleaner payment history table',
    description: 'Payments covering many purchase orders now show a compact invoice list with a “+ more” indicator, preventing long PO lists from overlapping other table columns.',
  },
  {
    category: 'BUG_FIX', module: 'Daily Closing', badge: 'FIXED', displayOrder: 5,
    featureName: 'Correct cash drawer calculation',
    description: 'Only cash supplier payments reduce expected drawer cash. Bank, card, UPI, wallet, and cheque payments no longer create incorrect cash shortages or overages during day closing.',
  },
  {
    category: 'BUG_FIX', module: 'Accounts Payable', badge: 'FIXED', displayOrder: 6,
    featureName: 'Reliable payment and PO balances',
    description: 'Supplier balances, purchase-order paid and due amounts, AP journals, and multi-PO allocations now update together in one transaction and remain safe when accounting jobs retry.',
  },
  {
    category: 'BUG_FIX', module: 'Customer Credit', badge: 'FIXED', displayOrder: 7,
    featureName: 'Credit settlements no longer double-count',
    description: 'Settling a customer credit balance now reduces or removes the matching CREDIT payment row, keeping sale payments, outstanding balances, and accounting totals aligned.',
  },
]

async function main() {
  const existing = await prisma.release.findFirst({ where: { version: VERSION } })

  const data = {
    title: '18 July 2026 — Feature Suggestions, Supplier Payments & Accounting',
    summary:
      'Submit and track feature ideas, manage suggestions from the platform admin, allocate supplier payments across multiple POs, post cash and bank payments automatically, and benefit from more accurate daily closing, AP, and customer-credit calculations.',
    releaseDate: new Date('2026-07-18'),
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
