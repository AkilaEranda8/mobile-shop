/**
 * Idempotent seed for the 24 August 2026 customer release note (v2.16.0).
 * Shop-facing only — no internal/security/admin details.
 * Run: npx tsx src/database/seed-aug-24-2026-release.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const VERSION = '2.16.0'

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
    category: 'NEW_FEATURE', module: 'SMS', badge: 'NEW', displayOrder: 0,
    featureName: 'SMS hub for customer messages',
    description: 'A new SMS page under Messaging lets you connect a gateway, edit message templates, and review send stats and history in one place.',
  },
  {
    category: 'NEW_FEATURE', module: 'SMS', badge: 'NEW', displayOrder: 1,
    featureName: 'Hexalyte SMS Gateway',
    description: 'You can now send SMS through Hexalyte SMS Gateway. Enter User ID, API Key, and your approved Sender ID (mask) on the Connection tab, then enable the gateway.',
  },
  {
    category: 'NEW_FEATURE', module: 'POS', badge: 'NEW', displayOrder: 2,
    featureName: 'Send SMS after a sale',
    description: 'After a POS sale completes, tap Send SMS to Customer when the customer has a phone number. Messages are not sent automatically — you choose when to send.',
  },
  {
    category: 'NEW_FEATURE', module: 'Repairs', badge: 'NEW', displayOrder: 3,
    featureName: 'Send SMS from a repair ticket',
    description: 'On a repair ticket, tap Send SMS to notify the customer using your repair template. The message goes only when you tap the button, not when the job is completed.',
  },
]

async function main() {
  const existing = await prisma.release.findFirst({ where: { version: VERSION } })

  const data = {
    title: '24 August 2026 — SMS Hub, POS & Repair SMS',
    summary:
      'Connect Hexalyte SMS Gateway from a new SMS hub, then send sale and repair messages only when you tap Send SMS — no automatic texts after checkout or job completion.',
    releaseDate: new Date('2026-08-24'),
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
