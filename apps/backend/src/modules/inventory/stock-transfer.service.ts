import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { getUserBranchIds } from '../../utils/active-branch'
import {
  destBranchSku,
  ensureBranchCatalogProduct,
  findBranchCatalogProduct,
} from '../../utils/branch-catalog'
import { syncImeiTrackedStock } from '../../utils/product-stock'
import { Prisma } from '@prisma/client'

type TransferProduct = {
  id: string
  sku: string
  stock: number
  trackImei: boolean
  branchId: string
  name: string
  barcode: string | null
  categoryId: string
  brandId: string
  description: string | null
  buyingPrice: number
  sellingPrice: number
  mrp: number
  warrantyMonths: number
  warrantyNote: string | null
  imageUrl: string | null
  minStock: number
  storageVariations: unknown
  colorVariations: unknown
  subCategory: string | null
  deviceModel: string | null
  condition: string
}

async function recordTransferMovements(
  tx: Prisma.TransactionClient,
  opts: {
    sourceProductId: string
    destProductId: string
    fromBranchId: string
    toBranchId: string
    quantity: number
    reference: string
    notes?: string
    performedBy: string
  },
) {
  const { sourceProductId, destProductId, fromBranchId, toBranchId, quantity, reference, notes, performedBy } = opts
  await tx.stockMovement.createMany({
    data: [
      {
        productId: sourceProductId,
        branchId: fromBranchId,
        type: 'TRANSFER_OUT',
        quantity: -quantity,
        reference,
        note: notes,
        performedBy,
      },
      {
        productId: destProductId,
        branchId: toBranchId,
        type: 'TRANSFER_IN',
        quantity,
        reference,
        note: notes,
        performedBy,
      },
    ],
  })
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

    const isFull = quantity === product.stock
    if (product.trackImei && !isFull) {
      throw new AppError('IMEI-tracked products must be transferred in full quantity', 400)
    }

    const reference = `TRF-${Date.now().toString(36).toUpperCase()}`

    return prisma.$transaction(async (tx) => {
      const destCatalog = await findBranchCatalogProduct(tx, tenantId, product.sku, toBranchId)
      const mergeIntoDest = !!destCatalog && destCatalog.id !== productId

      // No pre-created catalog at destination — move the product row in full transfers.
      if (isFull && !mergeIntoDest) {
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
        await recordTransferMovements(tx, {
          sourceProductId: productId,
          destProductId: productId,
          fromBranchId,
          toBranchId,
          quantity,
          reference,
          notes,
          performedBy,
        })
        return { reference, productId, fromBranchId, toBranchId, quantity, mode: 'relocate' as const }
      }

      const destProduct = mergeIntoDest
        ? destCatalog!
        : await ensureBranchCatalogProduct(tx, tenantId, product as TransferProduct, toBranchId)

      await tx.product.update({
        where: { id: productId },
        data: { stock: { decrement: quantity } },
      })
      await tx.product.update({
        where: { id: destProduct.id },
        data: { stock: { increment: quantity } },
      })

      if (product.trackImei) {
        await tx.imeiRecord.updateMany({
          where: { productId, branchId: fromBranchId, status: 'IN_STOCK' },
          data: { productId: destProduct.id, branchId: toBranchId },
        })
        await syncImeiTrackedStock(tx, productId)
        await syncImeiTrackedStock(tx, destProduct.id)
      }

      await recordTransferMovements(tx, {
        sourceProductId: productId,
        destProductId: destProduct.id,
        fromBranchId,
        toBranchId,
        quantity,
        reference,
        notes,
        performedBy,
      })

      return {
        reference,
        productId,
        toProductId: destProduct.id,
        fromBranchId,
        toBranchId,
        quantity,
        mode: mergeIntoDest ? ('merge' as const) : ('partial' as const),
        destSku: destBranchSku(product.sku, toBranchId),
      }
    })
  },

  async preview(
    tenantId: string,
    productId: string,
    toBranchId: string,
  ) {
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId, isActive: true },
      select: { id: true, sku: true, stock: true, trackImei: true, branchId: true },
    })
    if (!product) throw new AppError('Product not found', 404)

    const destSku = destBranchSku(product.sku, toBranchId)
    const destCatalog = await findBranchCatalogProduct(prisma, tenantId, product.sku, toBranchId)
    const hasSeparateDest = !!destCatalog && destCatalog.id !== product.id

    return {
      destSku,
      catalogReady: hasSeparateDest,
      catalogProductId: hasSeparateDest ? destCatalog!.id : null,
      willRelocate: product.stock > 0 && !hasSeparateDest,
      willMerge: hasSeparateDest,
      trackImei: product.trackImei,
      requiresFullQuantity: product.trackImei,
    }
  },
}
