/**
 * Idempotent seed: Hexalyte Windows Desktop App release note (v2.19.0).
 * Run: npx tsx src/database/seed-desktop-app-release.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const VERSION = '2.19.0'

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
    category: 'NEW_FEATURE',
    module: 'Desktop App',
    badge: 'NEW',
    displayOrder: 0,
    featureName: 'Hexalyte for Windows',
    description:
      'Install the Hexalyte desktop app on Windows for a full-screen shop experience — the same Hexalyte you use in the browser, in its own window. Download from the website header (Desktop App) or https://app.hexalyte.com/downloads/Hexalyte-Setup.exe',
  },
  {
    category: 'NEW_FEATURE',
    module: 'Desktop App',
    badge: 'NEW',
    displayOrder: 1,
    featureName: 'Opens straight to login',
    description:
      'The desktop app opens at the login screen (not the public marketing page), so staff can sign in and start work faster.',
  },
  {
    category: 'NEW_FEATURE',
    module: 'Desktop App',
    badge: 'NEW',
    displayOrder: 2,
    featureName: 'Shop PIN unlock on desktop',
    description:
      'After the first email/password login, Hexalyte remembers your shop. Next launches can use PIN unlock when POS Quick PIN is enabled for your shop — same as on your shop subdomain in the browser.',
  },
  {
    category: 'IMPROVEMENT',
    module: 'Desktop App',
    badge: 'IMPROVED',
    displayOrder: 3,
    featureName: 'Automatic updates',
    description:
      'When a new desktop version is available, Hexalyte downloads and installs it in the background, then closes and reopens with the update — no Save As / Downloads folder steps.',
  },
  {
    category: 'IMPROVEMENT',
    module: 'Desktop App',
    badge: 'IMPROVED',
    displayOrder: 4,
    featureName: 'Change shop from the menu',
    description:
      'Use File → Change Shop… in the desktop app to clear the saved shop and sign in to a different shop with email/password again.',
  },
]

async function main() {
  const existing = await prisma.release.findFirst({ where: { version: VERSION } })

  const data = {
    title: '5 September 2026 — Hexalyte Desktop App (Windows)',
    summary:
      'New Windows desktop app: install once, open straight to login, PIN unlock after first sign-in, and silent auto-updates that restart Hexalyte for you.',
    releaseDate: new Date('2026-09-05T12:00:00.000Z'),
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
    console.log(`Updated release ${VERSION} (${ITEMS.length} items)`)
  } else {
    await prisma.release.create({
      data: {
        version: VERSION,
        createdBy: 'Admin',
        ...data,
      },
    })
    console.log(`Created and published release ${VERSION} (${ITEMS.length} items)`)
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
