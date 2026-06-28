export type VariantRow = {
  id?: string
  storage: string
  colorName: string
  colorHex?: string
  sku?: string
  stock?: number
  sellingPrice?: number
  costPrice?: number
}

export function variantKey(v: VariantRow): string {
  return v.id ?? `${v.storage}::${v.colorName}`
}

export function variantLabel(v: VariantRow): string {
  return `${v.storage} · ${v.colorName}`
}

export function variantMatches(row: VariantRow, key: string): boolean {
  return row.id === key || `${row.storage}::${row.colorName}` === key || (!!row.sku && row.sku === key)
}

export function findVariant(variations: unknown, key: string): VariantRow | null {
  if (!Array.isArray(variations)) return null
  return (variations as VariantRow[]).find(v => variantMatches(v, key)) ?? null
}

export function hasVariants(variations: unknown): boolean {
  return Array.isArray(variations) && variations.length > 0
}

export function variantStock(variations: unknown, key: string): number {
  return findVariant(variations, key)?.stock ?? 0
}

export function listTransferableVariants(variations: unknown): Array<VariantRow & { key: string; label: string }> {
  if (!Array.isArray(variations)) return []
  return (variations as VariantRow[])
    .filter(v => (v.stock ?? 0) > 0)
    .map(v => ({ ...v, key: variantKey(v), label: variantLabel(v) }))
}

type VariantStockRow = { key: string; label: string; stock: number }

/** Variants with transferable qty at a branch (IMEI count when trackImei, else variant.stock). */
export async function listTransferableVariantsForBranch(
  db: { imeiRecord: { findMany: (args: object) => Promise<Array<{ variation: string | null }>> } },
  opts: {
    productId: string
    trackImei: boolean
    storageVariations: unknown
    branchId: string
  },
): Promise<VariantStockRow[]> {
  const { productId, trackImei, storageVariations, branchId } = opts
  if (!hasVariants(storageVariations)) return []

  const variants = storageVariations as VariantRow[]

  if (!trackImei) {
    return listTransferableVariants(storageVariations).map(v => ({
      key: v.key,
      label: v.label,
      stock: v.stock ?? 0,
    }))
  }

  const rows = await db.imeiRecord.findMany({
    where: { productId, branchId, status: 'IN_STOCK' },
    select: { variation: true },
  })

  const result: VariantStockRow[] = []
  for (const v of variants) {
    const key = variantKey(v)
    const count = rows.filter(r => imeiMatchesVariant(r, key, v)).length
    if (count > 0) {
      result.push({ key, label: variantLabel(v), stock: count })
    }
  }
  return result
}

export async function countAvailableStock(
  db: { imeiRecord: { count: (args: object) => Promise<number> } },
  product: { id: string; trackImei: boolean; stock: number; storageVariations: unknown },
  branchId: string,
  variationKey?: string,
): Promise<number> {
  if (variationKey) {
    const variant = findVariant(product.storageVariations, variationKey)
    if (product.trackImei) {
      if (!variant) return 0
      return db.imeiRecord.count({
        where: {
          productId: product.id,
          branchId,
          status: 'IN_STOCK',
          OR: imeiVariationFilter(variationKey, variant),
        },
      })
    }
    return variantStock(product.storageVariations, variationKey)
  }
  if (product.trackImei) {
    return db.imeiRecord.count({
      where: { productId: product.id, branchId, status: 'IN_STOCK' },
    })
  }
  return product.stock
}

export function adjustVariantStock(variations: unknown, key: string, delta: number): unknown {
  if (!Array.isArray(variations)) return variations
  return (variations as VariantRow[]).map(v => {
    if (!variantMatches(v, key)) return v
    return { ...v, stock: Math.max(0, (v.stock ?? 0) + delta) }
  })
}

/** Add or increment a matching variant row on the destination product. */
export function mergeVariantStock(
  destVariations: unknown,
  sourceVariant: VariantRow,
  quantity: number,
): unknown {
  if (!Array.isArray(destVariations) || destVariations.length === 0) {
    return [{ ...sourceVariant, stock: quantity }]
  }
  const key = variantKey(sourceVariant)
  let matched = false
  const updated = (destVariations as VariantRow[]).map(v => {
    if (v.storage !== sourceVariant.storage || v.colorName !== sourceVariant.colorName) return v
    matched = true
    return { ...v, stock: (v.stock ?? 0) + quantity }
  })
  if (!matched) {
    updated.push({ ...sourceVariant, stock: quantity })
  }
  return updated
}

export function imeiVariationFilter(key: string, variant: VariantRow) {
  const parts = [{ variation: key }]
  if (variant.sku) parts.push({ variation: variant.sku })
  parts.push({ variation: `${variant.storage}::${variant.colorName}` })
  return parts
}

export function imeiMatchesVariant(
  record: { variation: string | null },
  key: string,
  variant: VariantRow | null,
): boolean {
  if (!variant) return true
  if (!record.variation) return false
  const v = record.variation
  return v === key || v === variant.sku || v === `${variant.storage}::${variant.colorName}`
}
