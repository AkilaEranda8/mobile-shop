import { prisma } from '../../../../config/database'

export async function readPurchaseForAccounting(tenantId: string, purchaseOrderId: string) {
  return prisma.purchaseOrder.findFirst({
    where: { id: purchaseOrderId, tenantId },
    include: {
      items: { include: { product: { include: { category: true } } } },
      imeiRecords: { select: { imei: true, productId: true, poItemId: true, variation: true } },
    },
  })
}
