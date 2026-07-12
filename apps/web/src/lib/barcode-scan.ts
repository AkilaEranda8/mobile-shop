/** Shared barcode / SKU / IMEI scan helpers (keyboard-wedge scanners). */

export function normalizeScanCode(raw: string): string {
  return raw.trim().replace(/\s+/g, '')
}

export function isImeiCode(code: string): boolean {
  return /^\d{15}$/.test(normalizeScanCode(code))
}

export type ProductVariation = {
  id?: string
  storage?: string
  colorName?: string
  sku?: string
  sellingPrice?: number
  stock?: number
}

export function productMatchesCode(product: {
  barcode?: string | null
  sku?: string
  storageVariations?: ProductVariation[] | null
}, code: string): boolean {
  const c = normalizeScanCode(code).toLowerCase()
  if (!c) return false
  if (String(product.barcode ?? '').toLowerCase() === c) return true
  if (String(product.sku ?? '').toLowerCase() === c) return true
  for (const v of product.storageVariations ?? []) {
    if (String(v.sku ?? '').toLowerCase() === c) return true
  }
  return false
}

export function findProductByCode<T extends {
  id: string
  name: string
  barcode?: string | null
  sku?: string
  storageVariations?: ProductVariation[] | null
  trackImei?: boolean
}>(
  products: T[],
  code: string,
): { product: T; variation?: ProductVariation } | null {
  const c = normalizeScanCode(code).toLowerCase()
  if (!c) return null

  for (const p of products) {
    for (const v of p.storageVariations ?? []) {
      if (String(v.sku ?? '').toLowerCase() === c) {
        return { product: p, variation: v }
      }
    }
    if (String(p.barcode ?? '').toLowerCase() === c || String(p.sku ?? '').toLowerCase() === c) {
      return { product: p }
    }
  }
  return null
}

export function productSearchHaystack(p: {
  name?: string
  sku?: string
  barcode?: string | null
  brandName?: string
  categoryName?: string
  storageVariations?: ProductVariation[] | null
}): string {
  const variantSkus = (p.storageVariations ?? []).map(v => v.sku ?? '').join(' ')
  return `${p.name ?? ''} ${p.sku ?? ''} ${p.barcode ?? ''} ${p.brandName ?? ''} ${p.categoryName ?? ''} ${variantSkus}`.toLowerCase()
}
