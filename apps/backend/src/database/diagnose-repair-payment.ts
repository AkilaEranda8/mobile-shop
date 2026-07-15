/**
 * Diagnose repair collect-payment 403.
 * Run: npx tsx src/database/diagnose-repair-payment.ts [repairId]
 */
import { PrismaClient } from '@prisma/client'
import { businessDateDb, businessDateFromInstant } from '../utils/date-range'

const prisma = new PrismaClient()

async function main() {
  const repairId = process.argv[2] || 'cmrliyl7w006p3n7npbk643w8'
  const r = await prisma.repairTicket.findUnique({
    where: { id: repairId },
    select: {
      id: true, ticketNumber: true, status: true, branchId: true, tenantId: true,
      customerId: true, estimatedCost: true,
    },
  })
  console.log('repair', r)
  if (!r?.branchId || !r.tenantId) return

  const feat = await prisma.tenantFeature.findFirst({
    where: { tenantId: r.tenantId, feature: 'DAILY_CLOSING' },
  })
  console.log('dailyClosingFeature', feat)

  const todayKey = businessDateFromInstant()
  const closedToday = await prisma.dailyClosing.findFirst({
    where: {
      tenantId: r.tenantId,
      branchId: r.branchId,
      date: businessDateDb(todayKey),
      status: 'CLOSED',
    },
  })
  const closings = await prisma.dailyClosing.findMany({
    where: { tenantId: r.tenantId, branchId: r.branchId },
    orderBy: { date: 'desc' },
    take: 10,
    select: { date: true, status: true },
  })
  console.log('todayKey', todayKey)
  console.log('closedToday', closedToday ? { date: closedToday.date, status: closedToday.status } : null)
  console.log('recentClosings', closings)

  const user = await prisma.user.findFirst({
    where: {
      tenantId: r.tenantId,
      email: { equals: 'chamalhettiarachchi@gmail.com', mode: 'insensitive' },
    },
    select: { id: true, role: true, email: true, isActive: true },
  })
  console.log('user', user)
  if (user) {
    const branches = await prisma.userBranch.findMany({
      where: { userId: user.id },
      select: { branchId: true },
    })
    console.log('userBranches', branches)
  }

  // Simulate day-lock check message
  if (feat?.enabled && closedToday) {
    console.log('WOULD_403: Business day is closed')
  } else {
    console.log('dayLock: OPEN (would not 403 from day lock)')
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
