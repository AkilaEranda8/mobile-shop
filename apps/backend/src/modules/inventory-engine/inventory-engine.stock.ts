import { Prisma } from '@prisma/client'
import { AppError } from '../../middleware/error.middleware'
import { hasVariants, sumVariantStock } from '../../utils/product-variants'
import { prisma } from '../../config/database'

/** Prisma client or interactive transaction client. */
export type InventoryDb = Prisma.TransactionClient | typeof prisma

export type StockLocationKey = {
  productId: string
  branchId: string
  /** When set, on-hand/ATP resolve to that variant's stock (sku match). */
  sku?: string | null
}

export type ConsumeStockInput = StockLocationKey & {
  quantity: number
  variationLabel?: string | null
  reference?: string | null
  performedBy: string
  /** Prefer WHOLESALE_DISPATCH when enum exists; else SALE. Default SALE. */
  movementType?: 'SALE' | 'WHOLESALE_DISPATCH' | string
  /** Optional product display name for error messages (avoids extra fetch). */
  productName?: string
}

export type SoftReserveImeiInput = {
  imei: string
  reservedBy: string
  /** Default 5 minutes. */
  ttlMs?: number
}

export type ConsumeImeiInput = {
  imei: string
  saleId?: string | null
  wholesaleInvoiceId?: string | null
  customerId?: string | null
  dealerId?: string | null
  branchId?: string | null
  /** Soft-reserve owner allowed to hard-commit while hold is still active. */
  reservedBy?: string | null
}

const DEFAULT_IMEI_SOFT_RESERVE_TTL_MS = 5 * 60 * 1000

/** Pure ATP math — no MOQ / credit. */
export function computeAtp(onHand: number, reserved: number): number {
  return onHand - reserved
}

function dmmfModel(name: string) {
  return Prisma.dmmf.datamodel.models.find((m) => m.name === name)
}

function dmmfModelHasField(modelName: string, fieldName: string): boolean {
  return dmmfModel(modelName)?.fields.some((f) => f.name === fieldName) ?? false
}

function dmmfHasModel(name: string): boolean {
  return Boolean(dmmfModel(name))
}

function dmmfEnumHasValue(enumName: string, value: string): boolean {
  return (
    Prisma.dmmf.datamodel.enums
      .find((e) => e.name === enumName)
      ?.values.some((v) => v.name === value) ?? false
  )
}

/** True once W1 migration adds softReservedUntil / softReservedBy on ImeiRecord. */
export function isImeiSoftReserveSchemaReady(): boolean {
  return (
    dmmfModelHasField('ImeiRecord', 'softReservedUntil') &&
    dmmfModelHasField('ImeiRecord', 'softReservedBy')
  )
}

export function isStockReservationModelReady(): boolean {
  return dmmfHasModel('StockReservation')
}

export function resolveConsumeMovementType(
  preferred?: string | null,
): 'SALE' | 'WHOLESALE_DISPATCH' | string {
  if (preferred && dmmfEnumHasValue('StockMovementType', preferred)) {
    return preferred
  }
  if (preferred === 'WHOLESALE_DISPATCH') {
    return 'SALE'
  }
  return preferred && dmmfEnumHasValue('StockMovementType', preferred) ? preferred : 'SALE'
}

function assertSoftReserveSchema(): void {
  if (!isImeiSoftReserveSchemaReady()) {
    throw new AppError(
      'IMEI soft-reserve requires migration: add ImeiRecord.softReservedUntil and softReservedBy',
      500,
    )
  }
}

/**
 * Raw on-hand at branch (variant stock when sku matches a variation; else parent stock).
 * Does not subtract reservations.
 */
export async function getOnHand(db: InventoryDb, key: StockLocationKey): Promise<number> {
  const product = await db.product.findFirst({
    where: { id: key.productId, branchId: key.branchId },
    select: { stock: true, storageVariations: true },
  })
  if (!product) return 0

  if (key.sku && hasVariants(product.storageVariations)) {
    const variants = product.storageVariations as Array<{ sku?: string; stock?: number }>
    const match = variants.find((v) => v?.sku && v.sku === key.sku)
    if (match) return Number(match.stock ?? 0)
  }

  if (hasVariants(product.storageVariations)) {
    return sumVariantStock(product.storageVariations)
  }
  return product.stock
}

/**
 * Reserved qty = StockReservation sum (when model exists) + active IMEI soft-reserves
 * for serialized units (when soft-reserve columns exist). Otherwise 0 / soft-only.
 */
export async function getReservedQty(db: InventoryDb, key: StockLocationKey): Promise<number> {
  let reserved = 0

  if (isStockReservationModelReady()) {
    const stockReservation = (db as unknown as {
      stockReservation?: {
        aggregate: (args: unknown) => Promise<{ _sum: { quantity: number | null } }>
      }
    }).stockReservation
    if (stockReservation?.aggregate) {
      const where: Record<string, unknown> = {
        productId: key.productId,
        branchId: key.branchId,
        status: 'ACTIVE',
      }
      if (key.sku) where.sku = key.sku
      try {
        const agg = await stockReservation.aggregate({
          where,
          _sum: { quantity: true },
        })
        reserved += Number(agg._sum?.quantity ?? 0)
      } catch {
        // Model shape may differ until W4 — treat as zero reservation rows.
      }
    }
  }

  if (isImeiSoftReserveSchemaReady()) {
    const now = new Date()
    const count = await db.imeiRecord.count({
      where: {
        productId: key.productId,
        branchId: key.branchId,
        status: 'IN_STOCK',
        // Soft-reserve columns — cast until Prisma types regenerate after W1.
        ...( {
          softReservedUntil: { gt: now },
        } as Prisma.ImeiRecordWhereInput),
      },
    })
    reserved += count
  }

  return reserved
}

/** ATP = onHand − reserved (no MOQ / dealer credit). */
export async function getAtp(db: InventoryDb, key: StockLocationKey): Promise<number> {
  const [onHand, reserved] = await Promise.all([getOnHand(db, key), getReservedQty(db, key)])
  return computeAtp(onHand, reserved)
}

/**
 * Optimistic stock consume: variant JSON update or product.updateMany stock gte qty.
 * Writes StockMovement (SALE or WHOLESALE_DISPATCH when enum exists).
 */
export async function consumeStock(tx: Prisma.TransactionClient, input: ConsumeStockInput): Promise<void> {
  const qty = Number(input.quantity)
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new AppError('Consume quantity must be a positive number', 400)
  }

  const product = await tx.product.findFirst({
    where: { id: input.productId, branchId: input.branchId },
    select: { stock: true, name: true, storageVariations: true },
  })
  if (!product) {
    throw new AppError('Product not available at this branch', 400)
  }

  const name = input.productName ?? product.name
  const variantMode = hasVariants(product.storageVariations)
  const available = variantMode ? sumVariantStock(product.storageVariations) : product.stock
  if (available < qty) {
    throw new AppError(
      `Insufficient stock for "${name}". Available: ${available}, Requested: ${qty}`,
      400,
    )
  }

  if (variantMode) {
    let updatedVariations = product.storageVariations as Array<Record<string, unknown>>
    let changed = false
    updatedVariations = updatedVariations.map((v) => {
      const matchSku = input.sku && v.sku === input.sku
      const matchProps =
        input.variationLabel && `${v.storage}::${v.colorName}` === input.variationLabel
      if (matchSku || matchProps) {
        changed = true
        return { ...v, stock: Math.max(0, Number(v.stock || 0) - qty) }
      }
      return v
    })
    if (!changed) {
      throw new AppError(
        `Insufficient stock for "${name}". Variant not found for this sale line`,
        400,
      )
    }
    await tx.product.update({
      where: { id: input.productId },
      data: {
        storageVariations: updatedVariations as Prisma.InputJsonValue,
        stock: sumVariantStock(updatedVariations),
      },
    })
  } else {
    const dec = await tx.product.updateMany({
      where: { id: input.productId, branchId: input.branchId, stock: { gte: qty } },
      data: { stock: { decrement: qty } },
    })
    if (dec.count === 0) {
      throw new AppError(
        `Insufficient stock for "${name}". Available: ${product.stock}, Requested: ${qty}`,
        400,
      )
    }
  }

  const movementType = resolveConsumeMovementType(input.movementType ?? 'SALE')
  await tx.stockMovement.create({
    data: {
      productId: input.productId,
      branchId: input.branchId,
      // Cast: WHOLESALE_DISPATCH may be absent until wholesale enum migration.
      type: movementType as 'SALE',
      quantity: -qty,
      reference: input.reference ?? undefined,
      performedBy: input.performedBy,
    },
  })
}

/**
 * Soft-reserve an IN_STOCK IMEI for TTL (default 5 min).
 * Requires ImeiRecord.softReservedUntil / softReservedBy (W1 migration).
 */
export async function softReserveImei(
  db: InventoryDb,
  input: SoftReserveImeiInput,
): Promise<{ softReservedUntil: Date }> {
  assertSoftReserveSchema()
  const ttlMs = input.ttlMs ?? DEFAULT_IMEI_SOFT_RESERVE_TTL_MS
  const until = new Date(Date.now() + ttlMs)
  const now = new Date()

  const existing = await db.imeiRecord.findUnique({ where: { imei: input.imei } })
  if (!existing) {
    throw new AppError(`IMEI ${input.imei} not found`, 404)
  }
  if (existing.status !== 'IN_STOCK') {
    throw new AppError(`IMEI ${input.imei} is not available (status: ${existing.status})`, 400)
  }

  // Reject if held by someone else and not expired.
  const held = existing as typeof existing & {
    softReservedUntil?: Date | null
    softReservedBy?: string | null
  }
  if (
    held.softReservedUntil &&
    held.softReservedUntil > now &&
    held.softReservedBy &&
    held.softReservedBy !== input.reservedBy
  ) {
    throw new AppError(`IMEI ${input.imei} is soft-reserved by another session`, 409)
  }

  const updated = await db.imeiRecord.updateMany({
    where: {
      imei: input.imei,
      status: 'IN_STOCK',
    },
    data: {
      softReservedUntil: until,
      softReservedBy: input.reservedBy,
    } as unknown as Prisma.ImeiRecordUpdateManyMutationInput,
  })
  if (updated.count === 0) {
    throw new AppError(`IMEI ${input.imei} could not be soft-reserved`, 409)
  }
  return { softReservedUntil: until }
}

/** Clear soft-reserve metadata (cart remove / TTL release). */
export async function releaseImeiSoftReserve(db: InventoryDb, imei: string): Promise<void> {
  assertSoftReserveSchema()
  await db.imeiRecord.updateMany({
    where: { imei },
    data: {
      softReservedUntil: null,
      softReservedBy: null,
    } as unknown as Prisma.ImeiRecordUpdateManyMutationInput,
  })
}

/**
 * Hard-commit IMEI → SOLD via conditional updateMany.
 * Allows consume when softReservedUntil is null, expired, or reservedBy matches.
 */
export async function consumeImei(tx: Prisma.TransactionClient, input: ConsumeImeiInput): Promise<void> {
  const now = new Date()
  const softReady = isImeiSoftReserveSchemaReady()

  const softAllow: Prisma.ImeiRecordWhereInput[] = softReady
    ? [
        { softReservedUntil: null } as unknown as Prisma.ImeiRecordWhereInput,
        { softReservedUntil: { lte: now } } as unknown as Prisma.ImeiRecordWhereInput,
        ...(input.reservedBy
          ? ([{ softReservedBy: input.reservedBy }] as unknown as Prisma.ImeiRecordWhereInput[])
          : []),
      ]
    : []

  const where: Prisma.ImeiRecordWhereInput = {
    imei: input.imei,
    status: 'IN_STOCK',
    ...(input.branchId ? { branchId: input.branchId } : {}),
    ...(softAllow.length > 0 ? { OR: softAllow } : {}),
  }

  const data: Prisma.ImeiRecordUpdateManyMutationInput & Record<string, unknown> = {
    status: 'SOLD',
  }
  if (input.saleId !== undefined) data.saleId = input.saleId
  if (input.customerId !== undefined) data.customerId = input.customerId
  if (input.wholesaleInvoiceId !== undefined && dmmfModelHasField('ImeiRecord', 'wholesaleInvoiceId')) {
    data.wholesaleInvoiceId = input.wholesaleInvoiceId
  }
  if (input.dealerId !== undefined && dmmfModelHasField('ImeiRecord', 'dealerId')) {
    data.dealerId = input.dealerId
  }
  if (softReady) {
    data.softReservedUntil = null
    data.softReservedBy = null
  }

  const result = await tx.imeiRecord.updateMany({ where, data })
  if (result.count === 0) {
    throw new AppError(
      `IMEI ${input.imei} is not available to sell (not IN_STOCK or soft-reserved by another session)`,
      400,
    )
  }
}
