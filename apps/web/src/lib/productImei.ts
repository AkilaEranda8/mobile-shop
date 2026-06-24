/** Whether a product carries a unique IMEI (phones/tablets) or not (accessories, parts, etc.) */
export type ImeiProductType = 'device' | 'accessory'

const PHONE_CATEGORY_RE =
  /smart\s*phone|mobile\s*phone|handset|cell\s*phone|phone|tablet|ipad|tab\b/i

const NON_IMEI_CATEGORY_RE =
  /accessor|spare|part|charger|cable|case|cover|protector|screen\s*guard|service|repair|earbud|headphone|speaker|band|battery|glass|film|holder|stand|adapter|memory\s*card|sim\b/i

const PHONE_DEVICE_MODELS = new Set([
  'iPhone', 'iPad', 'Samsung Galaxy', 'Xiaomi', 'OnePlus', 'Google Pixel',
  'Oppo', 'Vivo', 'Huawei', 'Sony', 'Nokia', 'Motorola', 'Tablet',
])

const NON_IMEI_DEVICE_MODELS = new Set([
  'Earbuds', 'Speaker', 'Desktop', 'Laptop', 'MacBook', 'Smart Watch', 'Other',
])

export function imeiTypeToTrackFlag(type: ImeiProductType): boolean {
  return type === 'device'
}

export function trackFlagToImeiType(trackImei: boolean): ImeiProductType {
  return trackImei ? 'device' : 'accessory'
}

/** Suggest IMEI type from category / device model / variants. null = no strong hint. */
export function inferImeiProductType(opts: {
  categoryName?: string
  deviceModel?: string
  hasVariants?: boolean
}): ImeiProductType | null {
  const { categoryName = '', deviceModel = '', hasVariants = false } = opts

  if (deviceModel && PHONE_DEVICE_MODELS.has(deviceModel)) return 'device'
  if (deviceModel && NON_IMEI_DEVICE_MODELS.has(deviceModel)) return 'accessory'

  if (categoryName && NON_IMEI_CATEGORY_RE.test(categoryName)) return 'accessory'
  if (categoryName && PHONE_CATEGORY_RE.test(categoryName)) return 'device'

  if (hasVariants) return 'device'

  return null
}

export function imeiTypeLabel(type: ImeiProductType): string {
  return type === 'device' ? 'Phone / Tablet (has IMEI)' : 'No IMEI (accessory / part)'
}
