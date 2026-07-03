/**
 * Idempotent seed for the 3 July 2026 release note (v2.9.0).
 * Run: npx tsx src/database/seed-july-3-2026-release.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const VERSION = '2.9.0'

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
    category: 'NEW_FEATURE', module: 'Settings', badge: 'NEW', displayOrder: 0,
    featureName: 'Payment Receipt invoice template',
    description: 'New A4 layout with item table, bank payment information, and balance due — similar to formal payment receipts. Select it under Settings → Invoice.',
  },
  {
    category: 'NEW_FEATURE', module: 'Settings', badge: 'NEW', displayOrder: 1,
    featureName: 'Invoice template picker & live preview',
    description: 'Choose between Classic, Kasthuri, and Payment Receipt templates. All three layouts preview side by side with your logo and company details before you save.',
  },
  {
    category: 'IMPROVEMENT', module: 'POS', badge: 'IMPROVED', displayOrder: 2,
    featureName: 'Unified A4 invoices',
    description: 'POS, Sales PDF download, and Repair quotes all use the template you pick in Settings — one choice applies everywhere.',
  },
  {
    category: 'IMPROVEMENT', module: 'Settings', badge: 'IMPROVED', displayOrder: 3,
    featureName: 'Invoice settings API',
    description: 'Template list and invoice customize values are validated and stored via API. Extended bank/payment info field supports multiple accounts on Payment Receipt bills.',
  },
  {
    category: 'IMPROVEMENT', module: 'Daily Reload', badge: 'IMPROVED', displayOrder: 4,
    featureName: 'Reload UI only when enabled',
    description: 'Daily Reload, recharge card, and related profit funds appear only when the DAILY_RELOAD feature is turned on in Settings — cleaner screens for shops that do not sell reloads.',
  },
  {
    category: 'BUG_FIX', module: 'Daily Closing', badge: 'FIXED', displayOrder: 5,
    featureName: 'Reload & recharge alignment',
    description: 'Daily closing, settlement, and profit allocation now handle recharge card SKUs and branch-scoped reload records correctly across branches.',
  },
]

async function main() {
  const existing = await prisma.release.findFirst({ where: { version: VERSION } })

  const data = {
    title: '3 July 2026 — Invoice Templates & Reload Controls',
    summary: 'Payment Receipt A4 template with side-by-side previews in Settings, unified invoices across POS and sales, and reload/recharge UI gated by the Daily Reload feature.',
    releaseDate: new Date('2026-07-03'),
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
