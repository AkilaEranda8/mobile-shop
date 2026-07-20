import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { getUserBranchIds } from '../../utils/active-branch'
import { destBranchSku, findBranchCatalogProduct } from '../../utils/branch-catalog'
import {
  countAvailableStock,
  findVariant,
  hasVariants,
  imeiMatchesVariant,
  imeiVariationFilter,
  listTransferableVariantsForBranch,
  variantLabel,
} from '../../utils/product-variants'
import { executeStockTransferEffects } from '../../utils/stock-transfer.util'
import { applyStockTransferEffectsIfEnabled } from '../inventory-engine/inventory-engine.service'
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

type TransferBody = {
  productId: string
  fromBranchId: string
  toBranchId: string
  quantity: number
  notes?: string
  variationKey?: string
  imeis?: string[]
}

async function validateTransferImeis(
  db: Prisma.TransactionClient | typeof prisma,
  opts: {
    productId: string
    fromBranchId: string
    imeis: string[]
    variationKey?: string
    sourceVariant: ReturnType<typeof findVariant>
  },
) {
  const { productId, fromBranchId, imeis, variationKey, sourceVariant } = opts
  const unique = [...new Set(imeis)]
  if (unique.length !== imeis.length) throw new AppError('Duplicate IMEIs in selection', 400)

  const records = await db.imeiRecord.findMany({
    where: {
      imei: { in: unique },
      productId,
      branchId: fromBranchId,
      status: 'IN_STOCK',
    },
    select: { imei: true, variation: true },
  })
  if (records.length !== unique.length) {
    throw new AppError('One or more IMEIs are invalid or not in stock at the source branch', 400)
  }
  if (variationKey && sourceVariant) {
    for (const row of records) {
      if (!imeiMatchesVariant(row, variationKey, sourceVariant)) {
        throw new AppError(`IMEI ${row.imei} does not match the selected variant`, 400)
      }
    }
  }
  return unique
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
    body: TransferBody,
  ) {
    const { productId, fromBranchId, toBranchId, notes, variationKey } = body
    let { quantity } = body
    const imeis = body.imeis?.map(i => i.trim()).filter(Boolean)
    if (fromBranchId === toBranchId) throw new AppError('Source and destination branch must differ', 400)
    if (quantity <= 0) throw new AppError('Quantity must be positive', 400)

    const allowed = await getUserBranchIds(userId, tenantId, role)
    if (!allowed.includes(fromBranchId)) throw new AppError('Branch access denied for source branch', 403)
    if (!allowed.includes(toBranchId)) throw new AppError('Branch access denied for destination branch', 403)

    const [fromBranch, toBranch] = await Promise.all([
      prisma.branch.findFirst({ where: { id: fromBranchId, tenantId, isActive: true } }),
      prisma.branch.findFirst({ where: { id: toBranchId, tenantId, isActive: true } }),
    ])
    if (!fromBranch || !toBranch) throw new AppError('Invalid branch', 400)

    const product = await prisma.product.findFirst({ where: { id: productId, tenantId, isActive: true } })
    if (!product) throw new AppError('Product not found', 404)
    if (product.branchId !== fromBranchId) throw new AppError('Product is not stocked at the source branch', 400)

    const variantMode = hasVariants(product.storageVariations)
    const transferableVariants = variantMode
      ? await listTransferableVariantsForBranch(prisma, {
          productId,
          trackImei: product.trackImei,
          storageVariations: product.storageVariations,
          branchId: fromBranchId,
        })
      : []
    if (transferableVariants.length > 0 && !variationKey) {
      throw new AppError('Select a variant to transfer', 400)
    }

    const sourceVariant = variationKey ? findVariant(product.storageVariations, variationKey) : null
    if (variationKey && !sourceVariant) throw new AppError('Variant not found on product', 404)

    const available = await countAvailableStock(
      prisma,
      product as TransferProduct,
      fromBranchId,
      variationKey,
    )
    if (available <= 0) throw new AppError('No stock available for this selection', 400)

    if (product.trackImei) {
      if (!imeis?.length) throw new AppError('Select IMEI units to transfer', 400)
      if (quantity !== imeis.length) {
        throw new AppError('Quantity must match the number of selected IMEIs', 400)
      }
      if (imeis.length > available) {
        throw new AppError('Insufficient stock for selected variant', 400)
      }
    } else if (quantity > available) {
      throw new AppError('Insufficient stock for selected variant', 400)
    }

    const isFullProduct = !variationKey && quantity === product.stock

    if (product.trackImei && imeis) {
      await validateTransferImeis(prisma, {
        productId,
        fromBranchId,
        imeis,
        variationKey,
        sourceVariant,
      })
    }

    const inStockImeiCount = product.trackImei
      ? await prisma.imeiRecord.count({
          where: {
            productId,
            branchId: fromBranchId,
            status: 'IN_STOCK',
            ...(variationKey && sourceVariant ? { OR: imeiVariationFilter(variationKey, sourceVariant) } : {}),
          },
        })
      : 0
    const isFullImeiTransfer = product.trackImei && !!imeis && imeis.length === inStockImeiCount

    const movementNote = [
      notes?.trim(),
      sourceVariant ? variantLabel(sourceVariant) : '',
      imeis?.length ? `IMEI: ${imeis.join(', ')}` : '',
    ].filter(Boolean).join(' · ') || undefined
    const reference = `TRF-${Date.now().toString(36).toUpperCase()}`

    return prisma.$transaction(async (tx) => {
      const transferInput = {
        tx,
        tenantId,
        product: product as TransferProduct,
        productId,
        fromBranchId,
        toBranchId,
        quantity,
        variationKey,
        imeis,
        isFullProduct,
        isFullImeiTransfer: !!isFullImeiTransfer,
        reference,
        movementNote,
        performedBy,
      }
      const engineResult = await applyStockTransferEffectsIfEnabled(transferInput)
      if (engineResult) return engineResult
      return executeStockTransferEffects(transferInput)
    })
  },

  async preview(
    tenantId: string,
    productId: string,
    toBranchId: string,
    fromBranchId?: string,
    variationKey?: string,
  ) {
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId, isActive: true },
      select: {
        id: true,
        sku: true,
        stock: true,
        trackImei: true,
        branchId: true,
        storageVariations: true,
      },
    })
    if (!product) throw new AppError('Product not found', 404)

    const sourceBranchId = fromBranchId || product.branchId
    const destSku = destBranchSku(product.sku, toBranchId)
    const destCatalog = await findBranchCatalogProduct(prisma, tenantId, product.sku, toBranchId)
    const hasSeparateDest = !!destCatalog && destCatalog.id !== product.id
    const variants = await listTransferableVariantsForBranch(prisma, {
      productId: product.id,
      trackImei: product.trackImei,
      storageVariations: product.storageVariations,
      branchId: sourceBranchId,
    })
    const requiresVariant = variants.length > 0
    const availableStock = await countAvailableStock(
      prisma,
      product,
      sourceBranchId,
      variationKey,
    )

    return {
      destSku,
      catalogReady: hasSeparateDest,
      catalogProductId: hasSeparateDest ? destCatalog!.id : null,
      willRelocate: !variationKey && product.stock > 0 && !hasSeparateDest,
      willMerge: hasSeparateDest || !!variationKey,
      trackImei: product.trackImei,
      requiresFullQuantity: false,
      requiresImeiSelection: product.trackImei,
      requiresVariant,
      variants,
      availableStock,
    }
  },

  async listTransferImeis(
    tenantId: string,
    productId: string,
    fromBranchId: string,
    variationKey?: string,
  ) {
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId, isActive: true },
      select: { id: true, trackImei: true, branchId: true, storageVariations: true },
    })
    if (!product) throw new AppError('Product not found', 404)
    if (!product.trackImei) return []
    if (product.branchId !== fromBranchId) return []

    const sourceVariant = variationKey ? findVariant(product.storageVariations, variationKey) : null
    if (variationKey && !sourceVariant) throw new AppError('Variant not found on product', 404)

    const rows = await prisma.imeiRecord.findMany({
      where: {
        productId,
        branchId: fromBranchId,
        status: 'IN_STOCK',
        ...(variationKey && sourceVariant ? { OR: imeiVariationFilter(variationKey, sourceVariant) } : {}),
      },
      select: { id: true, imei: true, variation: true },
      orderBy: { imei: 'asc' },
    })
    return rows
  },
}
