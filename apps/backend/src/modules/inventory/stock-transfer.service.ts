import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { getUserBranchIds } from '../../utils/active-branch'

function destSku(baseSku: string, toBranchId: string) {
  const suffix = `-BR${toBranchId.slice(-6).toUpperCase()}`
  const max = 100 - suffix.length
  return `${baseSku.slice(0, max)}${suffix}`
}

export const stockTransferService = {
  async list(tenantId: string, params?: { branchId?: string; limit?: number }) {
    const limit = Math.min(params?.limit ?? 50, 200)
    const where: any = {
      type: { in: ['TRANSFER_IN', 'TRANSFER_OUT'] as const },
      product: { tenantId },
      ...(params?.branchId && { branchId: params.branchId }),
    }
    const rows = await prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        branch: { select: { id: true, name: true } },
      },
    })
    return rows
  },

  async transfer(
    tenantId: string,
    userId: string,
    role: string,
    performedBy: string,
    body: { productId: string; fromBranchId: string; toBranchId: string; quantity: number; notes?: string },
  ) {
    const { productId, fromBranchId, toBranchId, quantity, notes } = body
    if (fromBranchId === toBranchId) throw new AppError('Source and destination branch must differ', 400)
    if (quantity <= 0) throw new AppError('Quantity must be positive', 400)

    const allowed = await getUserBranchIds(userId, tenantId, role)
    if (!allowed.includes(fromBranchId)) throw new AppError('Branch access denied for source branch', 403)

    const [fromBranch, toBranch] = await Promise.all([
      prisma.branch.findFirst({ where: { id: fromBranchId, tenantId, isActive: true } }),
      prisma.branch.findFirst({ where: { id: toBranchId, tenantId, isActive: true } }),
    ])
    if (!fromBranch || !toBranch) throw new AppError('Invalid branch', 400)

    const product = await prisma.product.findFirst({ where: { id: productId, tenantId, isActive: true } })
    if (!product) throw new AppError('Product not found', 404)
    if (product.branchId !== fromBranchId) throw new AppError('Product is not stocked at the source branch', 400)
    if (product.stock < quantity) throw new AppError('Insufficient stock at source branch', 400)

    if (product.trackImei && quantity !== product.stock) {
      throw new AppError('IMEI-tracked products must be transferred in full quantity', 400)
    }

    const reference = `TRF-${Date.now().toString(36).toUpperCase()}`

    return prisma.$transaction(async (tx) => {
      if (quantity === product.stock) {
        await tx.product.update({
          where: { id: productId },
          data: { branchId: toBranchId },
        })
        if (product.trackImei) {
          await tx.imeiRecord.updateMany({
            where: { productId, branchId: fromBranchId, status: 'IN_STOCK' },
            data: { branchId: toBranchId },
          })
        }
        await tx.stockMovement.createMany({
          data: [
            {
              productId,
              branchId: fromBranchId,
              type: 'TRANSFER_OUT',
              quantity: -quantity,
              reference,
              note: notes,
              performedBy,
            },
            {
              productId,
              branchId: toBranchId,
              type: 'TRANSFER_IN',
              quantity,
              reference,
              note: notes,
              performedBy,
            },
          ],
        })
        return { reference, productId, fromBranchId, toBranchId, quantity, mode: 'full' as const }
      }

      if (product.trackImei) {
        throw new AppError('Partial transfer not supported for IMEI products', 400)
      }

      const sku = destSku(product.sku, toBranchId)
      let destProduct = await tx.product.findFirst({
        where: { tenantId, sku, isActive: true },
      })

      if (!destProduct) {
        destProduct = await tx.product.create({
          data: {
            tenantId,
            branchId: toBranchId,
            name: product.name,
            sku,
            barcode: product.barcode,
            categoryId: product.categoryId,
            brandId: product.brandId,
            description: product.description,
            buyingPrice: product.buyingPrice,
            sellingPrice: product.sellingPrice,
            mrp: product.mrp,
            trackImei: false,
            warrantyMonths: product.warrantyMonths,
            warrantyNote: product.warrantyNote,
            stock: 0,
            minStock: product.minStock,
            storageVariations: product.storageVariations ?? undefined,
            colorVariations: product.colorVariations ?? undefined,
            subCategory: product.subCategory,
            deviceModel: product.deviceModel,
            condition: product.condition,
          },
        })
      } else if (destProduct.branchId !== toBranchId) {
        throw new AppError('Destination SKU exists at another branch', 409)
      }

      await tx.product.update({
        where: { id: productId },
        data: { stock: { decrement: quantity } },
      })
      await tx.product.update({
        where: { id: destProduct.id },
        data: { stock: { increment: quantity } },
      })

      await tx.stockMovement.createMany({
        data: [
          {
            productId,
            branchId: fromBranchId,
            type: 'TRANSFER_OUT',
            quantity: -quantity,
            reference,
            note: notes,
            performedBy,
          },
          {
            productId: destProduct.id,
            branchId: toBranchId,
            type: 'TRANSFER_IN',
            quantity,
            reference,
            note: notes,
            performedBy,
          },
        ],
      })

      return {
        reference,
        productId,
        toProductId: destProduct.id,
        fromBranchId,
        toBranchId,
        quantity,
        mode: 'partial' as const,
      }
    })
  },
}
