import { prisma } from '../../../../config/database'

export async function readSaleForAccounting(tenantId: string, saleId: string) {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, tenantId },
    include: {
      items: { include: { product: { include: { category: true } } } },
      payments: true,
    },
  })
  return sale
}

