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
