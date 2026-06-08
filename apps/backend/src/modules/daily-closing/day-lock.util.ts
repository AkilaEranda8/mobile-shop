import { prisma } from '../../config/database'
import { businessDateFromInstant, businessDateDb } from '../../utils/date-range'
import { assertBusinessDayOpen } from './daily-closing.service'

export async function assertBusinessDayOpenIfEnabled(
  tenantId: string,
  branchId: string | undefined | null,
  at: Date = new Date(),
) {
  if (!branchId) return
  const feat = await prisma.tenantFeature.findFirst({
    where: { tenantId, feature: 'DAILY_CLOSING', enabled: true },
  })
  if (!feat) return
  await assertBusinessDayOpen(tenantId, branchId, at)
}

export async function isBusinessDayClosed(
  tenantId: string,
  branchId: string,
  at: Date = new Date(),
): Promise<boolean> {
  const dateStr = businessDateFromInstant(at)
  const closed = await prisma.dailyClosing.findFirst({
    where: {
      tenantId,
      branchId,
      date: businessDateDb(dateStr),
      status: 'CLOSED',
    },
  })
  return !!closed
}
