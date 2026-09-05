/**
 * Idempotent seed: Customer Credit Control release note (v2.16.0).
 * Run locally: npx tsx src/database/seed-credit-control-release.ts
 * Or apply via production SQL (see script footer comments).
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const VERSION = '2.16.0'

const ITEMS = [
  {
    category: 'NEW_FEATURE' as const,
    module: 'Customers',
    featureName: 'Credit Control Panel',
    description:
      'Customers page → Credit Control: overview of outstanding balances, SMS + WhatsApp reminder templates, automation settings, and one-click / bulk overdue reminders.',
    badge: 'NEW' as const,
    displayOrder: 0,
  },
  {
    category: 'NEW_FEATURE' as const,
    module: 'Customers',
    featureName: 'Automatic overdue reminders',
    description:
      'Turn on hourly auto reminders for customers with unpaid invoices older than your min days overdue. Cooldown prevents duplicate messages. Channels: SMS and/or WhatsApp.',
    badge: 'NEW' as const,
    displayOrder: 1,
  },
  {
    category: 'IMPROVEMENT' as const,
    module: 'SMS Gateway',
    featureName: 'Credit reminder SMS template',
    description:
      'New creditReminder template in SMS → Templates (and inside Credit Control). Variables: customerName, dueAmount, shopName, invoiceCount, oldestDueDate.',
    badge: 'IMPROVED' as const,
    displayOrder: 2,
  },
  {
    category: 'IMPROVEMENT' as const,
    module: 'Customers',
    featureName: 'Templated WhatsApp / SMS from customer detail',
    description:
      'Customer detail Send WhatsApp Reminder (and Send SMS Reminder) now uses your Credit Control templates instead of hardcoded text.',
    badge: 'IMPROVED' as const,
    displayOrder: 3,
  },
]

async function main() {
  const existing = await prisma.release.findFirst({ where: { version: VERSION } })
  if (existing) {
    console.log(`Release ${VERSION} already exists (${existing.id}) — skipping create`)
    if (existing.status !== 'PUBLISHED') {
      await prisma.release.update({
        where: { id: existing.id },
        data: { status: 'PUBLISHED', popupEnabled: true, active: true },
      })
      console.log('Published existing draft')
    }
    return
  }

  const release = await prisma.release.create({
    data: {
      version: VERSION,
      title: '5 September 2026 — Customer Credit Control',
      summary:
        'New Credit Control panel on Customers: SMS + WhatsApp overdue reminder templates, manual/bulk send, and optional hourly automation — when Customer Credit is enabled.',
      releaseDate: new Date('2026-09-05T00:00:00.000Z'),
      status: 'PUBLISHED',
      popupEnabled: true,
      active: true,
      targetType: 'ALL',
      targetPlans: [],
      targetTenants: [],
      targetBranches: [],
      createdBy: 'Admin',
      items: {
        create: ITEMS.map(item => ({
          category: item.category,
          module: item.module,
          featureName: item.featureName,
          description: item.description,
          badge: item.badge,
          displayOrder: item.displayOrder,
        })),
      },
    },
  })
  console.log(`Created and published release ${VERSION} (${release.id})`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
