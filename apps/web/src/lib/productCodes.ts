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
    const n = Number(s)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  const base = s.match(/^(\d+)-/)
  if (base) {
    const n = Number(base[1])
    return Number.isFinite(n) && n > 0 ? n : null
  }
  const prefixed = s.match(/^(.+-SKU)-(\d+)$/i)
  if (prefixed) {
    const n = Number(prefixed[2])
    return Number.isFinite(n) && n > 0 ? n : null
  }
  return null
}

/** Display label for # column — always keep the stored digits (00111 ≠ 111). */
export function formatSkuOrderLabel(sku: string, _orderNum?: number): string {
  const s = sku.trim()
  if (/^\d+$/.test(s)) return s
  const base = s.match(/^(\d+)-/)
  if (base) return base[1]
  const prefixed = s.match(/^(.+-SKU)-(\d+)$/i)
  if (prefixed) return prefixed[2]
  return s
}

/** Sort key that treats 00111 and 111 as different (pad then lexicographic). */
function numericSkuSortKey(sku: string): string | null {
  const s = sku.trim()
  if (/^\d+$/.test(s)) return s
  const base = s.match(/^(\d+)-/)
  if (base) return base[1]
  return null
}

export function compareSkuOrder(aSku: string, bSku: string): number {
  const ka = numericSkuSortKey(aSku)
  const kb = numericSkuSortKey(bSku)
  if (ka != null && kb != null) {
    const width = Math.max(ka.length, kb.length)
    const cmp = ka.padStart(width, '0').localeCompare(kb.padStart(width, '0'))
    if (cmp !== 0) return cmp
    // Same padded value but different stored strings (00111 vs 111) — longer pad first
    if (ka.length !== kb.length) return kb.length - ka.length
    return aSku.localeCompare(bSku)
  }
  const na = parseSkuOrderNumber(aSku)
  const nb = parseSkuOrderNumber(bSku)
  if (na != null && nb != null) return na - nb
  if (na != null) return -1
  if (nb != null) return 1
  return aSku.localeCompare(bSku)
}
