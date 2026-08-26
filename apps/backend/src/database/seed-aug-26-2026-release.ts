/**
 * Idempotent seed for the 26 August 2026 customer release note (v2.17.0).
 * Shop-facing only — no internal/security/admin details.
 * Run: npx tsx src/database/seed-aug-26-2026-release.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const VERSION = '2.17.0'

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
    category: 'NEW_FEATURE', module: 'HR & Payroll', badge: 'NEW', displayOrder: 0,
    featureName: 'HR & Payroll module',
    description: 'A new HR section helps you manage staff profiles, departments, designations, attendance, leave, salary packages, commission, payroll runs, payslips, advances, and loans — in one place. Ask your shop owner to turn on HR & Payroll under Features if you do not see it yet.',
  },
  {
    category: 'NEW_FEATURE', module: 'HR & Payroll', badge: 'NEW', displayOrder: 1,
    featureName: 'Employees, departments & designations',
    description: 'Create employee HR profiles, organize teams into departments and job titles, and optionally link each employee to a staff login.',
  },
  {
    category: 'NEW_FEATURE', module: 'HR & Payroll', badge: 'NEW', displayOrder: 2,
    featureName: 'Shifts, attendance & leave',
    description: 'Define work shifts, record and correct attendance, set leave types and balances, and submit leave requests for approval.',
  },
  {
    category: 'NEW_FEATURE', module: 'HR & Payroll', badge: 'NEW', displayOrder: 3,
    featureName: 'Salary packages & commission preview',
    description: 'Assign basic salary and components to each employee, create commission rules for sales / repairs / hire purchase, and preview staff incentives for a date range.',
  },
  {
    category: 'NEW_FEATURE', module: 'HR & Payroll', badge: 'NEW', displayOrder: 4,
    featureName: 'Payroll runs linked to accounting',
    description: 'Create pay periods and draft payroll runs, then process, approve, and pay. Approved and paid runs post to your accounting books when Accounting is set up.',
  },
  {
    category: 'NEW_FEATURE', module: 'HR & Payroll', badge: 'NEW', displayOrder: 5,
    featureName: 'Payslip PDF & thermal print',
    description: 'Open any payslip to preview a branded A4 sheet, download a PDF, print A4, or print a thermal slip — using your shop name and logo from Invoice settings.',
  },
  {
    category: 'NEW_FEATURE', module: 'HR & Payroll', badge: 'NEW', displayOrder: 6,
    featureName: 'Salary advances & staff loans',
    description: 'Request, approve, and disburse advances or loans. Recoveries are deducted automatically when you pay the related payroll run.',
  },
]

async function main() {
  const existing = await prisma.release.findFirst({ where: { version: VERSION } })

  const data = {
    title: '26 August 2026 — HR & Payroll',
    summary:
      'New opt-in HR & Payroll module: employees, attendance, leave, salary, commission, payroll with accounting, payslip PDF/thermal print, advances and loans.',
    releaseDate: new Date('2026-08-26'),
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
