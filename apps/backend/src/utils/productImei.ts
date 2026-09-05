/** Shared serial/IMEI product-type inference (mirrors web lib/productImei.ts) */

const DEVICE_CATEGORY_RE =
  /smart\s*phone|mobile\s*phone|handset|cell\s*phone|phone|tablet|ipad|tab\b|laptop|notebook|macbook|desktop|computer|pc\b|chromebook|all[\s-]?in[\s-]?one/i

const NON_SERIAL_CATEGORY_RE =
  /accessor|spare|part|charger|cable|case|cover|protector|screen\s*guard|service|repair|earbud|headphone|speaker|band|battery|glass|film|holder|stand|adapter|memory\s*card|sim\b|mouse|keyboard|ram\b|ssd\b|hdd\b/i

export function inferTrackImeiFromMeta(opts: {
  categoryName?: string | null
  productName?: string | null
  hasVariants?: boolean
}): boolean | null {
  const categoryName = opts.categoryName ?? ''
  const productName = (opts.productName ?? '').toLowerCase()

  if (NON_SERIAL_CATEGORY_RE.test(categoryName)) return false
  if (DEVICE_CATEGORY_RE.test(categoryName)) return true

  if (productName && NON_SERIAL_CATEGORY_RE.test(productName)) return false
  if (productName && DEVICE_CATEGORY_RE.test(productName)) return true

  if (opts.hasVariants) return true

  return null
}
