/** Build a variant SKU from a base tenant SKU + storage/color. */
export function variantSkuFromBase(baseSku: string, storage: string, colorName: string): string {
  const storagePart = storage.replace(/\s/g, '') || 'VAR'
  const colorPart = (colorName || 'CLR').slice(0, 3).toUpperCase().replace(/\s/g, '')
  const suffix = `-${storagePart}-${colorPart}`
  const max = 50
  const base = baseSku.trim() || 'SKU'
  if (base.length + suffix.length <= max) return `${base}${suffix}`
  return `${base.slice(0, max - suffix.length)}${suffix}`
}

/** Numeric sequence from base product SKU (00001, 00001-128GB-BLA, TENANT-SKU-00012). */
export function parseSkuOrderNumber(sku: string): number | null {
  const s = sku.trim()
  if (!s) return null
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  const base = s.match(/^(\d+)-/)
  if (base) {
    const n = parseInt(base[1], 10)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  const prefixed = s.match(/^(.+-SKU)-(\d+)$/i)
  if (prefixed) {
    const n = parseInt(prefixed[2], 10)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  return null
}

/** Display label for # column — keeps zero-padding for numeric SKUs. */
export function formatSkuOrderLabel(sku: string, orderNum: number): string {
  const s = sku.trim()
  if (/^\d+$/.test(s)) return s
  if (/^\d+-/.test(s)) return String(orderNum).padStart(5, '0')
  return String(orderNum)
}

export function compareSkuOrder(aSku: string, bSku: string): number {
  const na = parseSkuOrderNumber(aSku)
  const nb = parseSkuOrderNumber(bSku)
  if (na != null && nb != null) return na - nb
  if (na != null) return -1
  if (nb != null) return 1
  return aSku.localeCompare(bSku)
}
