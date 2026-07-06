import { prisma } from '../../../../config/database'

export async function readRepairForAccounting(tenantId: string, repairId: string) {
  return prisma.repairTicket.findFirst({
    where: { id: repairId, tenantId },
    include: {
      spareParts: { include: { product: { select: { buyingPrice: true } } } },
    },
  })
}

