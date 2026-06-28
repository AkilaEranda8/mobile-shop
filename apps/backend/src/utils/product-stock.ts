import { Prisma } from '@prisma/client'

export async function syncImeiTrackedStock(
  tx: Prisma.TransactionClient,
  productId: string,
): Promise<void> {
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: { trackImei: true },
  })
  if (!product?.trackImei) return
  const imeiCount = await tx.imeiRecord.count({
    where: { productId, status: 'IN_STOCK' },
  })
  await tx.product.update({
    where: { id: productId },
    data: { stock: imeiCount },
  })
}
