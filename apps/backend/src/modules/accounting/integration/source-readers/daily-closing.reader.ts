import { prisma } from '../../../../config/database'
import { businessDateKeyFromInstant } from '../../../../utils/date-range'

export async function readDailyClosingForAccounting(tenantId: string, closingId: string) {
  const closing = await prisma.dailyClosing.findFirst({
    where: { id: closingId, tenantId },
    include: {
      branch: { select: { name: true } },
      cashCount: true,
    },
  })
  if (!closing) return null
  return {
    ...closing,
    dateKey: businessDateKeyFromInstant(closing.date),
  }
}
