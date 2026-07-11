import type { ProductVariation } from '@/types'

export type ImeiStockRow = {
  imei: string
  variation?: string | null
  branchId?: string
}

export function variantMatchLabels(variant: ProductVariation): string[] {
  const labels: string[] = []
  if (variant.id?.trim()) labels.push(variant.id.trim())
  if (variant.sku?.trim()) labels.push(variant.sku.trim())
  labels.push(`${variant.storage}::${variant.colorName}`)
  return [...new Set(labels)]
}

/** Match an IMEI record to a product variant (id, SKU, or storage/color). */
export function imeiMatchesProductVariant(
  record: { variation?: string | null },
  variant?: ProductVariation,
): boolean {
  if (!variant) return false
  const recVar = (record.variation ?? '').trim()
  if (!recVar) return false
  if (variantMatchLabels(variant).includes(recVar)) return true
  const [rStorage, rColor] = recVar.split('::').map(s => s.trim())
  return Boolean(rStorage && rColor && rStorage === variant.storage && rColor === variant.colorName)
}

/** IMEIs available for a variant in POS / exchange pickers. */
export function filterImeisForVariant(
  imeis: ImeiStockRow[],
  variant: ProductVariation | undefined,
  opts?: { variantCount?: number },
): ImeiStockRow[] {
  if (!variant) return []

  const matched = imeis.filter(i => imeiMatchesProductVariant(i, variant))
  if (matched.length > 0) return matched

  if ((variant.stock ?? 0) > 0) {
    const unlabeled = imeis.filter(i => !(i.variation ?? '').trim())
    if (unlabeled.length > 0) return unlabeled
  }

  if ((opts?.variantCount ?? 1) === 1 && imeis.length > 0) return imeis

  return []
}

export function parseImeiListResponse(res: unknown): ImeiStockRow[] {
  if (!res || typeof res !== 'object') return []
  const body = res as Record<string, unknown>
  if (Array.isArray(body.data)) return body.data as ImeiStockRow[]
  if (body.data && typeof body.data === 'object') {
    const nested = (body.data as Record<string, unknown>).data
    if (Array.isArray(nested)) return nested as ImeiStockRow[]
  }
  return []
}
