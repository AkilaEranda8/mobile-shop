/** Shared IMEI product-type inference (mirrors web lib/productImei.ts) */

const PHONE_CATEGORY_RE =
  /smart\s*phone|mobile\s*phone|handset|cell\s*phone|phone|tablet|ipad|tab\b/i

const NON_IMEI_CATEGORY_RE =
  /accessor|spare|part|charger|cable|case|cover|protector|screen\s*guard|service|repair|earbud|headphone|speaker|band|battery|glass|film|holder|stand|adapter|memory\s*card|sim\b/i

export function inferTrackImeiFromMeta(opts: {
  categoryName?: string | null
  productName?: string | null
  hasVariants?: boolean
}): boolean | null {
  const categoryName = opts.categoryName ?? ''
  const productName = (opts.productName ?? '').toLowerCase()

  if (NON_IMEI_CATEGORY_RE.test(categoryName)) return false
  if (PHONE_CATEGORY_RE.test(categoryName)) return true

  if (productName && NON_IMEI_CATEGORY_RE.test(productName)) return false
  if (productName && PHONE_CATEGORY_RE.test(productName)) return true

  if (opts.hasVariants) return true

  return null
}
