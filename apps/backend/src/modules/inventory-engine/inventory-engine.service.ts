import { AppError } from '../../middleware/error.middleware'
import { hasVariants, sumVariantStock } from '../../utils/product-variants'
import { applyPurchaseOrderReceive } from '../../utils/po-receive.util'
import {
  executeExchangeSoldStockEffects,
  executeExchangeTradeInStockEffects,
} from '../../utils/exchange-stock.util'
import { executeStockTransferEffects } from '../../utils/stock-transfer.util'
import { isInventoryEngineEnabled } from './inventory-engine.feature'
import type { Prisma } from '@prisma/client'
import type {
  ApplyExchangeSoldStockInput,
  ApplyExchangeTradeInStockInput,
  ApplyPurchaseOrderReceiveInput,
  ApplyRepairSparePartsStockInput,
  ApplySaleReturnStockInput,
  ApplySaleStockInput,
  ApplyStockAdjustmentInput,
  ApplyStockTransferInput,
} from './inventory-engine.types'

/**
 * Inventory Engine — Phase 1: sale stock decrement + StockMovement + IMEI status.
 * Behavior mirrors legacy inline logic in sales.service.ts (delegate parity).
 */
export async function applySaleStockEffects(input: ApplySaleStockInput): Promise<void> {
  const { tx, branchId, saleId, invoiceNumber, cashierName, customerId, items } = input

  for (const item of items) {
    if (!item.productId) continue
    const product = await tx.product.findUnique({
      where: { id: item.productId },
      select: { stock: true, name: true, storageVariations: true },
    })
    if (!product) continue

    const variantMode = hasVariants(product.storageVariations)
    const available = variantMode ? sumVariantStock(product.storageVariations) : product.stock
    if (available < item.quantity) {
      throw new AppError(
        `Insufficient stock for "${product.name}". Available: ${available}, Requested: ${item.quantity}`,
        400,
      )
    }

    if (variantMode) {
      let updatedVariations = product.storageVariations as any[]
      let changed = false
      updatedVariations = updatedVariations.map((v: any) => {
        const matchSku = item.sku && v.sku === item.sku
        const matchProps =
          item.variationLabel && `${v.storage}::${v.colorName}` === item.variationLabel
        if (matchSku || matchProps) {
          changed = true
          return { ...v, stock: Math.max(0, (v.stock || 0) - item.quantity) }
        }
        return v
      })
      if (!changed) {
        throw new AppError(
          `Insufficient stock for "${product.name}". Variant not found for this sale line`,
          400,
        )
      }
      await tx.product.update({
        where: { id: item.productId },
        data: {
          storageVariations: updatedVariations,
          stock: sumVariantStock(updatedVariations),
        },
      })
    } else {
      const dec = await tx.product.updateMany({
        where: { id: item.productId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      })
      if (dec.count === 0) {
        throw new AppError(
          `Insufficient stock for "${product.name}". Available: ${product.stock}, Requested: ${item.quantity}`,
          400,
        )
      }
    }

    await tx.stockMovement.create({
      data: {
        productId: item.productId,
        branchId,
        type: 'SALE',
        quantity: -item.quantity,
        reference: invoiceNumber,
        performedBy: cashierName,
      },
    })

    if (item.imei) {
      const existingImei = await tx.imeiRecord.findUnique({ where: { imei: item.imei } })
      if (existingImei) {
        await tx.imeiRecord.update({
          where: { imei: item.imei },
          data: {
            status: 'SOLD',
            customerId: customerId ?? existingImei.customerId,
            saleId,
          },
        })
      } else if (item.productId) {
        await tx.imeiRecord.create({
          data: {
            imei: item.imei,
            productId: item.productId,
            branchId,
            status: 'SOLD',
            variation: item.variationLabel ?? undefined,
            customerId: customerId ?? undefined,
            saleId,
          },
        })
      }
    }
  }
}

/** Returns true when the engine handled stock (tenant flag ON). */
export async function applySaleStockEffectsIfEnabled(input: ApplySaleStockInput): Promise<boolean> {
  if (!(await isInventoryEngineEnabled(input.tenantId))) return false
  await applySaleStockEffects(input)
  return true
}

/**
 * Phase 1: delegate PO receive stock effects to existing PO receive util,
 * while providing a single engine entrypoint for future extraction.
 */
export async function applyPurchaseOrderReceiveEffects(input: ApplyPurchaseOrderReceiveInput): Promise<void> {
  await applyPurchaseOrderReceive({
    tx: input.tx,
    tenantId: input.tenantId,
    poId: input.poId,
    poNumber: input.poNumber,
    branchId: input.branchId,
    performedBy: input.performedBy,
    items: input.items,
    resolveProduct: input.resolveProduct,
  })
}

/** Returns true when the engine handled stock (tenant flag ON). */
export async function applyPurchaseOrderReceiveEffectsIfEnabled(
  input: ApplyPurchaseOrderReceiveInput,
): Promise<boolean> {
  if (!(await isInventoryEngineEnabled(input.tenantId))) return false
  await applyPurchaseOrderReceiveEffects(input)
  return true
}

/**
 * Phase 1: sale return restock + StockMovement + IMEI reset.
 * Mirrors legacy inline logic in sales.routes.ts (delegate parity).
 */
export async function applySaleReturnStockEffects(input: ApplySaleReturnStockInput): Promise<void> {
  const { tx, branchId, returnNumber, invoiceNumber, reason, performedBy, items } = input

  for (const ri of items) {
    if (ri.productId) {
      const product = await tx.product.findUnique({
        where: { id: ri.productId },
        select: { storageVariations: true },
      })
      await tx.product.update({
        where: { id: ri.productId },
        data: { stock: { increment: Number(ri.quantity) } },
      })

      if (product?.storageVariations && ri.sku) {
        let updated = product.storageVariations as any[]
        if (Array.isArray(updated)) {
          let changed = false
          updated = updated.map((v: any) => {
            if (v?.sku && v.sku === ri.sku) {
              changed = true
              return { ...v, stock: Number(v.stock ?? 0) + Number(ri.quantity) }
            }
            return v
          })
          if (changed) {
            await tx.product.update({
              where: { id: ri.productId },
              data: { storageVariations: updated },
            })
          }
        }
      }

      await tx.stockMovement.create({
        data: {
          productId: ri.productId,
          branchId,
          type: 'RETURN',
          quantity: Number(ri.quantity),
          reference: returnNumber,
          note: `Return for ${invoiceNumber} — ${reason}`,
          performedBy,
        },
      })
    }

    const imeiToReset = ri.imei
    if (imeiToReset) {
      await tx.imeiRecord.updateMany({
        where: { imei: imeiToReset, ...(ri.productId ? { productId: ri.productId } : {}) },
        data: { status: 'IN_STOCK', saleId: null, customerId: null },
      })
    }
  }
}

/** Returns true when the engine handled stock (tenant flag ON). */
export async function applySaleReturnStockEffectsIfEnabled(
  input: ApplySaleReturnStockInput,
): Promise<boolean> {
  if (!(await isInventoryEngineEnabled(input.tenantId))) return false
  await applySaleReturnStockEffects(input)
  return true
}

/**
 * Phase 1: repair spare-part stock decrement + StockMovement (REPAIR_USE).
 * Mirrors legacy inline logic in repairs.service.ts (delegate parity).
 */
export async function applyRepairSparePartsStockEffects(
  input: ApplyRepairSparePartsStockInput,
): Promise<void> {
  const { tx, branchId, ticketNumber, performedBy, items } = input

  for (const p of items) {
    if (!p.productId) continue
    const prod = await tx.product.findUnique({
      where: { id: p.productId },
      select: { stock: true, name: true },
    })
    if (!prod) continue

    const dec = await tx.product.updateMany({
      where: { id: p.productId, stock: { gte: p.quantity } },
      data: { stock: { decrement: p.quantity } },
    })
    if (dec.count === 0) {
      throw new AppError(
        `Insufficient stock for "${prod.name}". Available: ${prod.stock}, Required: ${p.quantity}`,
        400,
      )
    }
    await tx.stockMovement.create({
      data: {
        productId: p.productId,
        branchId,
        type: 'REPAIR_USE',
        quantity: -p.quantity,
        reference: ticketNumber,
        note: `Spare part used in repair ${ticketNumber}`,
        performedBy,
      },
    })
  }
}

/** Returns true when the engine handled stock (tenant flag ON). */
export async function applyRepairSparePartsStockEffectsIfEnabled(
  input: ApplyRepairSparePartsStockInput,
): Promise<boolean> {
  if (!(await isInventoryEngineEnabled(input.tenantId))) return false
  await applyRepairSparePartsStockEffects(input)
  return true
}

/**
 * Phase 1: stock transfer effects (relocate / merge / partial + movements + IMEI).
 * Delegates to existing stock-transfer util for behavior parity.
 */
export async function applyStockTransferEffects(input: ApplyStockTransferInput) {
  return executeStockTransferEffects(input)
}

/** Returns result when engine handled stock; null when flag OFF. */
export async function applyStockTransferEffectsIfEnabled(input: ApplyStockTransferInput) {
  if (!(await isInventoryEngineEnabled(input.tenantId))) return null
  return applyStockTransferEffects(input)
}

/**
 * Phase 1: exchange trade-in stock inbound.
 * Delegates to exchange-stock util for behavior parity.
 */
export async function applyExchangeTradeInStockEffects(input: ApplyExchangeTradeInStockInput) {
  await executeExchangeTradeInStockEffects(input)
}

export async function applyExchangeTradeInStockEffectsIfEnabled(
  input: ApplyExchangeTradeInStockInput,
): Promise<boolean> {
  if (!(await isInventoryEngineEnabled(input.tenantId))) return false
  await applyExchangeTradeInStockEffects(input)
  return true
}

/**
 * Phase 1: exchange sold-unit stock outbound.
 * Delegates to exchange-stock util for behavior parity.
 */
export async function applyExchangeSoldStockEffects(input: ApplyExchangeSoldStockInput) {
  await executeExchangeSoldStockEffects(input)
}

export async function applyExchangeSoldStockEffectsIfEnabled(
  input: ApplyExchangeSoldStockInput,
): Promise<boolean> {
  if (!(await isInventoryEngineEnabled(input.tenantId))) return false
  await applyExchangeSoldStockEffects(input)
  return true
}

/** Resolve absolute target stock from adjustment input (variants win when present). */
export function resolveAdjustmentTargetStock(input: {
  targetStock?: number
  targetStorageVariations?: unknown
}): number {
  if (input.targetStorageVariations !== undefined && hasVariants(input.targetStorageVariations)) {
    return sumVariantStock(input.targetStorageVariations)
  }
  if (input.targetStock === undefined) {
    throw new AppError('Stock adjustment requires targetStock or variant stocks', 400)
  }
  const n = Number(input.targetStock)
  if (!Number.isFinite(n) || n < 0) throw new AppError('Stock cannot be negative', 400)
  return Math.floor(n)
}

/**
 * Catalog / manual absolute stock set.
 * Writes product stock (+ optional variants) and StockMovement ADJUSTMENT with signed delta.
 */
export async function applyStockAdjustmentEffects(input: ApplyStockAdjustmentInput): Promise<{
  previousEffectiveStock: number
  targetStock: number
  delta: number
}> {
  const {
    tx,
    productId,
    branchId,
    performedBy,
    reference,
    note,
    previousEffectiveStock: previousOverride,
    movementOnly,
  } = input

  const product = await tx.product.findUnique({
    where: { id: productId },
    select: { stock: true, storageVariations: true, name: true },
  })
  if (!product) throw new AppError('Product not found for stock adjustment', 404)

  const previousEffectiveStock =
    previousOverride !== undefined
      ? previousOverride
      : hasVariants(product.storageVariations)
        ? sumVariantStock(product.storageVariations)
        : product.stock

  const targetStock = resolveAdjustmentTargetStock(input)
  const delta = targetStock - previousEffectiveStock

  if (!movementOnly) {
    const data: Prisma.ProductUpdateInput = { stock: targetStock }
    if (input.targetStorageVariations !== undefined) {
      data.storageVariations = input.targetStorageVariations as Prisma.InputJsonValue
    }
    await tx.product.update({ where: { id: productId }, data })
  }

  if (delta !== 0) {
    await tx.stockMovement.create({
      data: {
        productId,
        branchId,
        type: 'ADJUSTMENT',
        quantity: delta,
        reference: reference ?? `ADJUST:${productId}`,
        note: note ?? `Stock adjustment for ${product.name}`,
        performedBy,
      },
    })
  }

  return { previousEffectiveStock, targetStock, delta }
}

/** Returns result when engine handled adjustment; null when flag OFF. */
export async function applyStockAdjustmentEffectsIfEnabled(
  input: ApplyStockAdjustmentInput,
): Promise<{ previousEffectiveStock: number; targetStock: number; delta: number } | null> {
  if (!(await isInventoryEngineEnabled(input.tenantId))) return null
  return applyStockAdjustmentEffects(input)
}
