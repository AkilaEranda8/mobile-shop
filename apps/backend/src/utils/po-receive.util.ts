import { Prisma } from '@prisma/client'
import { AppError } from '../middleware/error.middleware'
import {
  applyPoReceiveToVariations,
  hasVariants,
  type VariantRow,
  variantKey,
  resolvePoItemToVariantKey,
} from './product-variants'

export function round2(n: number) {
  return Math.round(n * 100) / 100
}

/** Weighted average unit cost after receiving new stock. */
export function weightedBuyingPrice(
  oldStock: number,
  oldBuyingPrice: number,
  incomingQty: number,
  incomingCost: number,
) {
  const nextStock = oldStock + incomingQty
  if (nextStock <= 0) {
    return round2(incomingQty > 0 ? incomingCost / incomingQty : oldBuyingPrice)
  }
  return round2((oldStock * oldBuyingPrice + incomingCost) / nextStock)
}

type PoReceiveItem = {
  id: string
  productId: string | null
  productName: string
  quantity: number
  receivedQuantity: number
  unitCost: number
  sku?: string | null
  storage?: string | null
  colorName?: string | null
}

type PoReceiveProduct = {
  id: string
  stock: number
  buyingPrice: number
  storageVariations: Prisma.JsonValue
}

function applyVariationReceive(
  variations: unknown,
  group: { item: PoReceiveItem }[],
  productBuyingPrice: number,
) {
  if (!hasVariants(variations)) return variations

  let updated = variations as VariantRow[]
  for (const { item } of group) {
    const keyBefore = resolvePoItemToVariantKey(updated, item)
    const oldStock = keyBefore
      ? (updated.find(v => variantKey(v) === keyBefore)?.stock ?? 0)
      : 0
    const oldCost = keyBefore
      ? (updated.find(v => variantKey(v) === keyBefore)?.costPrice ?? productBuyingPrice ?? 0)
      : productBuyingPrice

    const result = applyPoReceiveToVariations(updated, {
      sku: item.sku,
      storage: item.storage,
      colorName: item.colorName,
    }, item.quantity)
    updated = (result.variations as VariantRow[]) ?? updated

    if (result.matched && keyBefore) {
      updated = updated.map((v) => {
        if (variantKey(v) !== keyBefore) return v
        return {
          ...v,
          costPrice: weightedBuyingPrice(oldStock, oldCost, item.quantity, item.quantity * item.unitCost),
        }
      })
    }
  }
  return updated
}

export async function applyPurchaseOrderReceive(opts: {
  tx: Prisma.TransactionClient
  tenantId: string
  poId: string
  poNumber: string
  branchId: string
  performedBy: string
  items: PoReceiveItem[]
  resolveProduct: (item: PoReceiveItem) => Promise<{ productId: string; branchId: string } | null>
}) {
  const resolved: { item: PoReceiveItem; productId: string; branchId: string }[] = []

  for (const item of opts.items) {
    const pendingQty = Math.max(0, item.quantity - (item.receivedQuantity ?? 0))
    if (pendingQty <= 0) continue

    const resolvedProduct = await opts.resolveProduct(item)
    if (!resolvedProduct) {
      throw new AppError(`Cannot receive PO: product not linked for "${item.productName}"`, 400)
    }

    resolved.push({
      item: { ...item, quantity: pendingQty },
      productId: resolvedProduct.productId,
      branchId: resolvedProduct.branchId,
    })
  }

  const byProduct = new Map<string, typeof resolved>()
  for (const row of resolved) {
    if (!byProduct.has(row.productId)) byProduct.set(row.productId, [])
    byProduct.get(row.productId)!.push(row)
  }

  for (const [productId, group] of byProduct) {
    const product = await opts.tx.product.findUnique({ where: { id: productId } })
    if (!product) throw new AppError(`Product ${productId} not found during receive`, 404)

    const totalQty = group.reduce((s, r) => s + r.item.quantity, 0)
    const incomingCost = group.reduce((s, r) => s + r.item.quantity * r.item.unitCost, 0)
    const nextBuyingPrice = weightedBuyingPrice(product.stock, product.buyingPrice, totalQty, incomingCost)
    const updatedVariations = applyVariationReceive(product.storageVariations, group, product.buyingPrice)

    await opts.tx.product.update({
      where: { id: productId },
      data: {
        stock: { increment: totalQty },
        buyingPrice: nextBuyingPrice,
        ...(hasVariants(updatedVariations)
          ? { storageVariations: updatedVariations as Prisma.InputJsonValue }
          : {}),
      },
    })

    const branchId = group[0].branchId
    await opts.tx.stockMovement.createMany({
      data: group.map(({ item }) => ({
        productId,
        branchId,
        type: 'PURCHASE' as const,
        quantity: item.quantity,
        reference: `${opts.poId}:${item.id}`,
        note: `Received via PO ${opts.poNumber} (${item.sku ?? item.storage ?? item.productName})`,
        performedBy: opts.performedBy,
      })),
    })

    for (const { item } of group) {
      await opts.tx.pOItem.update({
        where: { id: item.id },
        data: { receivedQuantity: item.receivedQuantity + item.quantity },
      })
    }
  }
}
