/**
 * Diagnose repair + daily closing day lock for collect-payment 403.
 * Run: npx tsx src/database/diagnose-repair-payment.ts <repairId>
 */
import { PrismaClient } from '@prisma/client'

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

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' })
  const closing = await prisma.dailyClosing.findFirst({
    where: {
      tenantId: r.tenantId,
      branchId: r.branchId,
      date: new Date(`${today}T00:00:00.000Z`),
    },
  })
  console.log('todayKey', today)
  console.log('closing', closing ? { status: closing.status, date: closing.date } : null)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
