import { prisma } from '../../../../config/database'

export async function readPurchaseReturnForAccounting(tenantId: string, returnId: string) {
  return prisma.purchaseReturn.findFirst({
    where: { id: returnId, tenantId },
    include: {
      purchaseOrder: { select: { id: true, poNumber: true, tax: true, subtotal: true, total: true } },
      items: {
        include: {
          product: { include: { category: true } },
        },
      },
    },
  })
}
