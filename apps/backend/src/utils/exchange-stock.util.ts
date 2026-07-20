import { Prisma } from '@prisma/client'
import { syncImeiTrackedStock } from './product-stock'

function bumpVariantStock(
  variations: any[] | null | undefined,
  storage?: string | null,
  color?: string | null,
  buyPrice?: number,
): { variations: any[]; changed: boolean } {
  if (!storage || !color) return { variations: variations ?? [], changed: false }
  const list = Array.isArray(variations) ? [...variations] : []
  const idx = list.findIndex(v => v.storage === storage && v.colorName === color)
  if (idx >= 0) {
    list[idx] = { ...list[idx], stock: (list[idx].stock || 0) + 1 }
    return { variations: list, changed: true }
  }
  list.push({
    storage,
    colorName: color,
    colorHex: '#6b7280',
    sellingPrice: (buyPrice ?? 0) * 1.15,
    costPrice: buyPrice ?? 0,
    stock: 1,
    sku: `VAR-${Date.now().toString(36)}`,
  })
  return { variations: list, changed: true }
}

export type ExchangeTradeInStockInput = {
  tx: Prisma.TransactionClient
  branchId: string
  exchangeNumber: string
  performedBy: string
  tradeInProduct: {
    id: string
    storageVariations: unknown
  }
  oldImei: string
  oldBrand: string
  oldModel: string
  oldStorage?: string | null
  oldColor?: string | null
  buyPrice: number
  tradeInVariation?: string
  existingImei: boolean
}

export type ExchangeSoldStockInput = {
  tx: Prisma.TransactionClient
  branchId: string
  exchangeNumber: string
  invoiceNumber: string
  performedBy: string
  soldProductId: string
  soldImei: string
  soldVariation?: string | null
  customerId?: string | null
  saleId: string
}

/**
 * Exchange trade-in stock inbound (product + IMEI + EXCHANGE_IN movement).
 * Behavior mirrors legacy exchanges.service.ts.
 */
export async function executeExchangeTradeInStockEffects(input: ExchangeTradeInStockInput) {
  const {
    tx,
    branchId,
    exchangeNumber,
    performedBy,
    tradeInProduct,
    oldImei,
    oldBrand,
    oldModel,
    oldStorage,
    oldColor,
    buyPrice,
    tradeInVariation,
    existingImei,
  } = input

  const { variations, changed } = bumpVariantStock(
    tradeInProduct.storageVariations as any[],
    oldStorage,
    oldColor,
    buyPrice,
  )

  await tx.product.update({
    where: { id: tradeInProduct.id },
    data: {
      stock: { increment: 1 },
      buyingPrice: buyPrice,
      ...(changed ? { storageVariations: variations } : {}),
    },
  })

  if (existingImei) {
    await tx.imeiRecord.update({
      where: { imei: oldImei },
      data: {
        productId: tradeInProduct.id,
        branchId,
        status: 'IN_STOCK',
        variation: tradeInVariation,
        customerId: null,
        saleId: null,
      },
    })
  } else {
    await tx.imeiRecord.create({
      data: {
        imei: oldImei,
        productId: tradeInProduct.id,
        branchId,
        status: 'IN_STOCK',
        variation: tradeInVariation,
      },
    })
  }

  await syncImeiTrackedStock(tx, tradeInProduct.id)

  await tx.stockMovement.create({
    data: {
      productId: tradeInProduct.id,
      branchId,
      type: 'EXCHANGE_IN',
      quantity: 1,
      reference: exchangeNumber,
      note: `Exchange trade-in purchase — ${oldBrand} ${oldModel}`,
      performedBy,
    },
  })
}

/**
 * Exchange sold-unit stock outbound (IMEI SOLD + variant decrement + SALE movement).
 * Behavior mirrors legacy exchanges.service.ts.
 */
export async function executeExchangeSoldStockEffects(input: ExchangeSoldStockInput) {
  const {
    tx,
    branchId,
    exchangeNumber,
    invoiceNumber,
    performedBy,
    soldProductId,
    soldImei,
    soldVariation,
    customerId,
    saleId,
  } = input

  await tx.imeiRecord.update({
    where: { imei: soldImei },
    data: { status: 'SOLD', customerId: customerId ?? undefined, saleId },
  })

  const soldProduct = await tx.product.findUnique({
    where: { id: soldProductId },
    select: { storageVariations: true },
  })
  if (soldProduct?.storageVariations) {
    let updatedVariations = soldProduct.storageVariations as any[]
    if (Array.isArray(updatedVariations)) {
      let changedSold = false
      updatedVariations = updatedVariations.map((v: any) => {
        const matchSku = soldVariation && v.sku === soldVariation
        const matchProps = soldVariation && `${v.storage}::${v.colorName}` === soldVariation
        if (matchSku || matchProps) {
          changedSold = true
          return { ...v, stock: Math.max(0, (v.stock || 0) - 1) }
        }
        return v
      })
      if (changedSold) {
        await tx.product.update({
          where: { id: soldProductId },
          data: { storageVariations: updatedVariations },
        })
      }
    }
  }

  await syncImeiTrackedStock(tx, soldProductId)

  await tx.stockMovement.create({
    data: {
      productId: soldProductId,
      branchId,
      type: 'SALE',
      quantity: -1,
      reference: invoiceNumber,
      note: `Exchange sale — ${exchangeNumber}`,
      performedBy,
    },
  })
}
