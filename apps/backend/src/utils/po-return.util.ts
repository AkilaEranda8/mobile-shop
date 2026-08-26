import { Prisma } from '@prisma/client'
import { AppError } from '../middleware/error.middleware'
import {
  applyPoReceiveToVariations,
  hasVariants,
  type VariantRow,
  variantKey,
  resolvePoItemToVariantKey,
  sumVariantStock,
} from './product-variants'
import { round2, weightedBuyingPrice } from './po-receive.util'

type ReturnLine = {
  poItemId: string
  productId: string
  productName: string
  quantity: number
  unitCost: number
  sku?: string | null
  storage?: string | null
  colorName?: string | null
}

/** Reverse of PO receive — decrement stock and optionally reverse weighted average cost. */
export async function applyPurchaseOrderReturnStock(opts: {
  tx: Prisma.TransactionClient
  tenantId: string
  branchId: string
  returnNumber: string
  performedBy: string
  lines: ReturnLine[]
}) {
  const byProduct = new Map<string, ReturnLine[]>()
  for (const line of opts.lines) {
    if (!byProduct.has(line.productId)) byProduct.set(line.productId, [])
    byProduct.get(line.productId)!.push(line)
  }

  for (const [productId, group] of byProduct) {
    const product = await opts.tx.product.findUnique({ where: { id: productId } })
    if (!product) throw new AppError(`Product ${productId} not found during purchase return`, 404)
    if (product.tenantId !== opts.tenantId) throw new AppError('Product tenant mismatch', 400)

    const variantMode = hasVariants(product.storageVariations)
    const oldStock = variantMode ? sumVariantStock(product.storageVariations) : product.stock
    const totalQty = group.reduce((s, l) => s + l.quantity, 0)
    if (totalQty > oldStock) {
      throw new AppError(
        `Insufficient stock to return "${group[0].productName}" (have ${oldStock}, need ${totalQty})`,
        400,
      )
    }

    const outgoingCost = group.reduce((s, l) => s + l.quantity * l.unitCost, 0)
    const nextStock = oldStock - totalQty
    // Reverse weighted average when stock remains
    const nextBuyingPrice = nextStock <= 0
      ? product.buyingPrice
      : round2(Math.max(0, (oldStock * product.buyingPrice - outgoingCost) / nextStock))

    let updatedVariations = product.storageVariations
    if (variantMode) {
      let rows = product.storageVariations as VariantRow[]
      for (const line of group) {
        const keyBefore = resolvePoItemToVariantKey(rows, line)
        const oldVarStock = keyBefore
          ? (rows.find(v => variantKey(v) === keyBefore)?.stock ?? 0)
          : 0
        if (oldVarStock < line.quantity) {
          throw new AppError(
            `Insufficient variant stock for "${line.productName}" (have ${oldVarStock}, need ${line.quantity})`,
            400,
          )
        }
        const result = applyPoReceiveToVariations(rows, line, -line.quantity)
        rows = (result.variations as VariantRow[]) ?? rows
        if (result.matched && keyBefore) {
          const oldCost = rows.find(v => variantKey(v) === keyBefore)?.costPrice ?? product.buyingPrice
          // After decrement, reverse cost on remaining
          const remaining = Math.max(0, oldVarStock - line.quantity)
          rows = rows.map((v) => {
            if (variantKey(v) !== keyBefore) return v
            if (remaining <= 0) return { ...v, costPrice: oldCost }
            return {
              ...v,
              costPrice: weightedBuyingPrice(oldVarStock, oldCost, -line.quantity, -line.quantity * line.unitCost),
            }
          })
        }
      }
      updatedVariations = rows
    }

    await opts.tx.product.update({
      where: { id: productId },
      data: {
        buyingPrice: nextBuyingPrice,
        ...(variantMode
          ? {
              storageVariations: updatedVariations as Prisma.InputJsonValue,
              stock: sumVariantStock(updatedVariations),
            }
          : {
              stock: { decrement: totalQty },
            }),
      },
    })

    await opts.tx.stockMovement.createMany({
      data: group.map(line => ({
        productId,
        branchId: opts.branchId,
        type: 'PURCHASE_RETURN' as const,
        quantity: -line.quantity,
        reference: opts.returnNumber,
        note: `Purchase return ${opts.returnNumber}`,
        performedBy: opts.performedBy,
      })),
    })
  }
}
