import { prisma } from '../../../../config/database'

export async function readSaleReturnForAccounting(tenantId: string, returnId: string) {
  return prisma.saleReturn.findFirst({
    where: { id: returnId, tenantId },
    include: {
      sale: {
        select: {
          id: true,
          invoiceNumber: true,
          branchId: true,
          items: { select: { productId: true, imei: true } },
        },
      },
      items: { include: { product: { include: { category: true } } } },
    },
  })
}
