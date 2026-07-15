/**
 * Compare Sales totals vs dashboard financials for a tenant.
 * Run: npx tsx src/database/diagnose-dashboard-sales.ts <tenant-slug>
 */
import { PrismaClient } from '@prisma/client'
import { getDailyRevenueBreakdown } from '../modules/finance/business-financials.service'
import { businessDateFromInstant, shiftBusinessDate } from '../utils/date-range'

const prisma = new PrismaClient()

async function main() {
  const key = process.argv[2] || 'sahasma-gift-corner-and-i-phone-market-mrggsibo'
  const tenant = await prisma.tenant.findFirst({
    where: { OR: [{ slug: key }, { id: key }] },
    select: { id: true, slug: true, name: true },
  })
  if (!tenant) throw new Error('tenant not found')

  const branch = await prisma.branch.findFirst({
    where: { tenantId: tenant.id, isActive: true },
    select: { id: true, name: true },
  })
  if (!branch) throw new Error('branch not found')

  const sales = await prisma.sale.findMany({
    where: { tenantId: tenant.id, branchId: branch.id, status: { not: 'RETURNED' } },
    select: { invoiceNumber: true, total: true, source: true, createdAt: true, status: true },
    orderBy: { createdAt: 'desc' },
  })
  const sumAll = sales.reduce((s, x) => s + Number(x.total), 0)
  const sumPos = sales.filter(x => x.source !== 'REPAIR').reduce((s, x) => s + Number(x.total), 0)
  const sumRepair = sales.filter(x => x.source === 'REPAIR').reduce((s, x) => s + Number(x.total), 0)

  console.log('tenant', tenant.slug, 'branch', branch.id)
  console.log('sales count', sales.length, 'sumAll', sumAll, 'sumPos', sumPos, 'sumRepair', sumRepair)
  console.log('sales', sales.map(s => ({
    inv: s.invoiceNumber,
    total: s.total,
    source: s.source,
    at: s.createdAt.toISOString(),
  })))

  const closings = await prisma.dailyClosing.findMany({
    where: { tenantId: tenant.id, branchId: branch.id },
    orderBy: { date: 'desc' },
    take: 10,
    select: { date: true, status: true, totalSales: true, grossSales: true, repairIncome: true, salesCount: true },
  })
  console.log('closings', closings)

  const to = businessDateFromInstant()
  const from = shiftBusinessDate(to, -29)
  const rows = await getDailyRevenueBreakdown(tenant.id, from, to, branch.id)
  const dashTotal = rows.reduce((a, r) => a + r.totalRevenue, 0)
  console.log('dashRange', from, '→', to)
  console.log('dashTotal', dashTotal)
  console.log('nonzeroDays', rows.filter(r => r.totalRevenue > 0))
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
