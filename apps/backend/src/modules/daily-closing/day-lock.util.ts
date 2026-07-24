import { prisma } from '../../config/database'
import { businessDateFromInstant, businessDateDb } from '../../utils/date-range'
import { assertBusinessDayOpen } from './daily-closing.service'
import { isDailyClosingEnabledForBranch } from '../../utils/tenant-feature.util'

export async function assertBusinessDayOpenIfEnabled(
  tenantId: string,
  branchId: string | undefined | null,
  at: Date = new Date(),
) {
  if (!branchId) return
  if (!(await isDailyClosingEnabledForBranch(tenantId, branchId))) return
  await assertBusinessDayOpen(tenantId, branchId, at)
}

export async function isBusinessDayClosed(
  tenantId: string,
  branchId: string,
  at: Date = new Date(),
): Promise<boolean> {
  if (!(await isDailyClosingEnabledForBranch(tenantId, branchId))) return false
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
