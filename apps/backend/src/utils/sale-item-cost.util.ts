import { Prisma } from '@prisma/client'
import { findVariant, hasVariants, type VariantRow } from './product-variants'

export type SaleItemCostProduct = {
  buyingPrice?: number | null
  storageVariations?: unknown
}

export type SaleItemCostRef = {
  sku?: string | null
  variationLabel?: string | null
}

/** Unit cost for a sale line — variant PO cost when applicable, else product buying price. */
export function resolveSaleItemUnitCost(
  product: SaleItemCostProduct | null | undefined,
  opts: SaleItemCostRef = {},
): number {
  if (!product) return 0
  const fallback = Number(product.buyingPrice ?? 0)

  if (!hasVariants(product.storageVariations)) return fallback

  const sku = opts.sku?.trim()
  if (sku) {
    const bySku = (product.storageVariations as VariantRow[]).find(v => v.sku && v.sku === sku)
    if (bySku?.costPrice != null && Number(bySku.costPrice) > 0) {
      return Number(bySku.costPrice)
    }
  }

  const variationLabel = opts.variationLabel?.trim()
  if (variationLabel) {
    const variant = findVariant(product.storageVariations, variationLabel)
    if (variant?.costPrice != null && Number(variant.costPrice) > 0) {
      return Number(variant.costPrice)
    }
  }

  return fallback
}

/** SQL expression for one sale line unit cost (requires Product p, optional Service sv joins). */
export function saleItemUnitCostSql() {
  return Prisma.sql`CASE
    WHEN si."unitCost" > 0 THEN si."unitCost"
    WHEN si."productId" IS NOT NULL AND jsonb_typeof(p."storageVariations"::jsonb) = 'array' THEN COALESCE(
      NULLIF((
        SELECT (elem->>'costPrice')::float
        FROM jsonb_array_elements(p."storageVariations"::jsonb) AS elem
        WHERE si.sku <> '' AND elem->>'sku' = si.sku
        LIMIT 1
      ), 0),
      p."buyingPrice",
      0
    )
    WHEN si."productId" IS NOT NULL THEN COALESCE(p."buyingPrice", 0)
    ELSE COALESCE(sv.cost, 0)
  END`
}

/** SQL expression for sale line COGS (quantity × unit cost). */
export function saleItemCogsSql() {
  return Prisma.sql`si.quantity * (${saleItemUnitCostSql()})`
}

/** Prisma-friendly COGS for catalog products vs services (analytics legacy shape). */
export function saleItemCogsExpr() {
  return Prisma.sql`CASE
    WHEN si."productId" IS NOT NULL THEN si.quantity * (${saleItemUnitCostSql()})
    ELSE si.quantity * COALESCE(sv.cost, 0)
  END`
}
