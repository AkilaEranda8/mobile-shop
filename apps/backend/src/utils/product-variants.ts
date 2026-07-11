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

export type PoItemVariantRef = {
  sku?: string | null
  storage?: string | null
  colorName?: string | null
}

function normalizeStorageToken(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '').replace(/gb$/i, '').trim()
}

function storageMatches(a: string, b: string): boolean {
  return a === b || normalizeStorageToken(a) === normalizeStorageToken(b)
}

function colorMatches(a: string, b: string): boolean {
  return a.toLowerCase().trim() === b.toLowerCase().trim()
}

function variantMatchesPoItem(variant: VariantRow, item: PoItemVariantRef): boolean {
  if (item.sku && variant.sku && variant.sku === item.sku) return true
  if (item.storage && item.colorName) {
    return storageMatches(variant.storage, item.storage) && colorMatches(variant.colorName, item.colorName)
  }
  if (item.storage) return storageMatches(variant.storage, item.storage)
  if (item.colorName) return colorMatches(variant.colorName, item.colorName)
  return false
}

/** Resolve a PO line item to a variant key (SKU, storage/color, or single-variant fallback). */
export function resolvePoItemToVariantKey(
  variations: unknown,
  item: PoItemVariantRef,
): string | null {
  if (!hasVariants(variations)) return null
  const variants = variations as VariantRow[]

  if (item.sku) {
    const bySku = variants.find(v => v.sku && v.sku === item.sku)
    if (bySku) return variantKey(bySku)
  }

  const direct = variants.find(v => variantMatchesPoItem(v, item))
  if (direct) return variantKey(direct)

  if (variants.length === 1) return variantKey(variants[0])

  return null
}

/** Apply received PO quantity to the matching variant row. */
export function applyPoReceiveToVariations(
  variations: unknown,
  item: PoItemVariantRef,
  quantity: number,
): { variations: unknown; matched: boolean } {
  const key = resolvePoItemToVariantKey(variations, item)
  if (!key) return { variations, matched: false }
  return {
    variations: adjustVariantStock(variations, key, quantity),
    matched: true,
  }
}

export function sumVariantStock(variations: unknown): number {
  if (!Array.isArray(variations)) return 0
  return (variations as VariantRow[]).reduce((sum, v) => sum + (v.stock ?? 0), 0)
}

/** Move parent stock surplus into variants when variant rows were never updated (legacy PO receives). */
export function reconcileVariantStockWithParent(
  variations: unknown,
  parentStock: number,
): unknown {
  if (!hasVariants(variations)) return variations
  const variants = variations as VariantRow[]
  const variantTotal = sumVariantStock(variations)
  const surplus = parentStock - variantTotal
  if (surplus <= 0) return variations

  const key = variants.length === 1
    ? variantKey(variants[0])
    : variantKey(variants.reduce((best, v) => ((v.stock ?? 0) > (best.stock ?? 0) ? v : best), variants[0]))

  return adjustVariantStock(variations, key, surplus)
}
