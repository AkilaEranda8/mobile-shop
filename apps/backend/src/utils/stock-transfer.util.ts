import { AppError } from '../middleware/error.middleware'
import {
  destBranchSku,
  ensureBranchCatalogProduct,
  findBranchCatalogProduct,
} from './branch-catalog'
import { syncImeiTrackedStock } from './product-stock'
import {
  adjustVariantStock,
  findVariant,
  imeiMatchesVariant,
  mergeVariantStock,
} from './product-variants'
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

export type ExecuteStockTransferInput = {
  tx: Prisma.TransactionClient
  tenantId: string
  product: TransferProduct
  productId: string
  fromBranchId: string
  toBranchId: string
  quantity: number
  variationKey?: string
  imeis?: string[]
  isFullProduct: boolean
  isFullImeiTransfer: boolean
  reference: string
  movementNote?: string
  performedBy: string
}

async function validateTransferImeis(
  db: Prisma.TransactionClient,
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

async function recordTransferMovements(
  tx: Prisma.TransactionClient,
  opts: {
    sourceProductId: string
    destProductId: string
    fromBranchId: string
    toBranchId: string
    quantity: number
    reference: string
    note?: string
    performedBy: string
  },
) {
  const { sourceProductId, destProductId, fromBranchId, toBranchId, quantity, reference, note, performedBy } = opts
  await tx.stockMovement.createMany({
    data: [
      {
        productId: sourceProductId,
        branchId: fromBranchId,
        type: 'TRANSFER_OUT',
        quantity: -quantity,
        reference,
        note,
        performedBy,
      },
      {
        productId: destProductId,
        branchId: toBranchId,
        type: 'TRANSFER_IN',
        quantity,
        reference,
        note,
        performedBy,
      },
    ],
  })
}

/**
 * Stock transfer mutation (relocate / merge / partial).
 * Behavior mirrors legacy stock-transfer.service.ts transaction body.
 */
export async function executeStockTransferEffects(input: ExecuteStockTransferInput) {
  const {
    tx,
    tenantId,
    product,
    productId,
    fromBranchId,
    toBranchId,
    quantity,
    variationKey,
    imeis,
    isFullProduct,
    isFullImeiTransfer,
    reference,
    movementNote,
    performedBy,
  } = input

  const sourceVariant = variationKey ? findVariant(product.storageVariations, variationKey) : null
  const destCatalog = await findBranchCatalogProduct(tx, tenantId, product.sku, toBranchId)
  const mergeIntoDest = !!destCatalog && destCatalog.id !== productId

  if (isFullProduct && !mergeIntoDest && (!product.trackImei || isFullImeiTransfer)) {
    await tx.product.update({
      where: { id: productId },
      data: { branchId: toBranchId },
    })
    if (product.trackImei && imeis) {
      await tx.imeiRecord.updateMany({
        where: { imei: { in: imeis }, productId, branchId: fromBranchId, status: 'IN_STOCK' },
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
      note: movementNote,
      performedBy,
    })
    return { reference, productId, fromBranchId, toBranchId, quantity, mode: 'relocate' as const }
  }

  const destProduct = mergeIntoDest
    ? destCatalog!
    : await ensureBranchCatalogProduct(tx, tenantId, product, toBranchId)

  const sourceUpdate: Prisma.ProductUpdateInput = {
    stock: { decrement: quantity },
  }
  if (variationKey && sourceVariant) {
    sourceUpdate.storageVariations = adjustVariantStock(
      product.storageVariations,
      variationKey,
      -quantity,
    ) as Prisma.InputJsonValue
  }

  const destUpdate: Prisma.ProductUpdateInput = {
    stock: { increment: quantity },
  }
  if (variationKey && sourceVariant) {
    destUpdate.storageVariations = mergeVariantStock(
      destProduct.storageVariations,
      sourceVariant,
      quantity,
    ) as Prisma.InputJsonValue
  }

  await tx.product.update({ where: { id: productId }, data: sourceUpdate })
  await tx.product.update({ where: { id: destProduct.id }, data: destUpdate })

  if (product.trackImei && imeis) {
    await validateTransferImeis(tx, {
      productId,
      fromBranchId,
      imeis,
      variationKey,
      sourceVariant,
    })
    await tx.imeiRecord.updateMany({
      where: { imei: { in: imeis }, productId, branchId: fromBranchId, status: 'IN_STOCK' },
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
    note: movementNote,
    performedBy,
  })

  return {
    reference,
    productId,
    toProductId: destProduct.id,
    fromBranchId,
    toBranchId,
    quantity,
    variationKey: variationKey ?? null,
    imeis: imeis ?? null,
    mode: mergeIntoDest ? ('merge' as const) : ('partial' as const),
    destSku: destBranchSku(product.sku, toBranchId),
  }
}
