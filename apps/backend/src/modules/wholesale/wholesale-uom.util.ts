import type { WholesaleSellUnit } from '@prisma/client'
import { AppError } from '../../middleware/error.middleware'

export type ProductUomFields = {
  unitsPerBox: number | null
  unitsPerCarton: number | null
  name?: string
}

/**
 * Convert sell-unit quantity (PIECE / BOX / CARTON) to stock base units (pieces).
 */
export function sellUnitToStockQty(
  quantity: number,
  sellUnit: WholesaleSellUnit | string,
  product: ProductUomFields,
): number {
  const qty = Number(quantity)
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new AppError('Quantity must be a positive number', 400)
  }
  const unit = String(sellUnit || 'PIECE').toUpperCase() as WholesaleSellUnit
  const label = product.name ? `"${product.name}"` : 'product'

  if (unit === 'PIECE') return qty
  if (unit === 'BOX') {
    const per = product.unitsPerBox
    if (!per || per <= 0) {
      throw new AppError(`Product ${label} has no unitsPerBox configured`, 400)
    }
    return qty * per
  }
  if (unit === 'CARTON') {
    const per = product.unitsPerCarton
    if (!per || per <= 0) {
      throw new AppError(`Product ${label} has no unitsPerCarton configured`, 400)
    }
    return qty * per
  }
  throw new AppError(`Unsupported sell unit: ${sellUnit}`, 400)
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
