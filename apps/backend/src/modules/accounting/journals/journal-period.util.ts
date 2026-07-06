import { prisma } from '../../../config/database'
import { businessDateDb } from '../../../utils/date-range'
import { AppError } from '../../../middleware/error.middleware'

export async function resolveOpenPeriodForDate(
  tenantId: string,
  entryDate: Date,
  skipPeriodStatusCheck?: boolean,
) {
  const key = entryDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' }).slice(0, 7)
  const existing = await prisma.accountingPeriod.findUnique({
    where: { tenantId_name: { tenantId, name: key } },
  })
  if (existing) {
    if (existing.status === 'HARD_CLOSED' && !skipPeriodStatusCheck) {
      throw new AppError('Accounting period is hard-closed', 403)
    }
    if (existing.status === 'SOFT_CLOSED' && !skipPeriodStatusCheck) {
      throw new AppError('Accounting period is soft-closed', 403)
    }
    return existing
  }
  const [y, m] = key.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = new Date(Date.UTC(y, m, 0))
  return prisma.accountingPeriod.create({
    data: { tenantId, name: key, startDate: start, endDate: end, status: 'OPEN' },
  })
}
