/** Whether a product carries a unique serial/IMEI (devices) or not (accessories, parts, etc.) */
export type ImeiProductType = 'device' | 'accessory'

const DEVICE_CATEGORY_RE =
  /smart\s*phone|mobile\s*phone|handset|cell\s*phone|phone|tablet|ipad|tab\b|laptop|notebook|macbook|desktop|computer|pc\b|chromebook|all[\s-]?in[\s-]?one/i

const NON_SERIAL_CATEGORY_RE =
  /accessor|spare|part|charger|cable|case|cover|protector|screen\s*guard|service|repair|earbud|headphone|speaker|band|battery|glass|film|holder|stand|adapter|memory\s*card|sim\b|mouse|keyboard|ram\b|ssd\b|hdd\b/i

const SERIAL_DEVICE_MODELS = new Set([
  'iPhone', 'iPad', 'Samsung Galaxy', 'Xiaomi', 'OnePlus', 'Google Pixel',
  'Oppo', 'Vivo', 'Huawei', 'Sony', 'Nokia', 'Motorola', 'Tablet',
  'Laptop', 'Desktop', 'MacBook',
])

const NON_SERIAL_DEVICE_MODELS = new Set([
  'Earbuds', 'Speaker', 'Smart Watch', 'Other',
])

export function imeiTypeToTrackFlag(type: ImeiProductType): boolean {
  return type === 'device'
}

export function trackFlagToImeiType(trackImei: boolean): ImeiProductType {
  return trackImei ? 'device' : 'accessory'
}

/** Suggest serial-tracking type from category / device model / variants. null = no strong hint. */
export function inferImeiProductType(opts: {
  categoryName?: string
  deviceModel?: string
  productName?: string
  hasVariants?: boolean
}): ImeiProductType | null {
  const { categoryName = '', deviceModel = '', productName = '', hasVariants = false } = opts

  if (deviceModel && SERIAL_DEVICE_MODELS.has(deviceModel)) return 'device'
  if (deviceModel && NON_SERIAL_DEVICE_MODELS.has(deviceModel)) return 'accessory'

  if (categoryName && NON_SERIAL_CATEGORY_RE.test(categoryName)) return 'accessory'
  if (categoryName && DEVICE_CATEGORY_RE.test(categoryName)) return 'device'

  const name = productName.toLowerCase()
  if (name && NON_SERIAL_CATEGORY_RE.test(name)) return 'accessory'
  if (name && DEVICE_CATEGORY_RE.test(name)) return 'device'

  if (hasVariants) return 'device'

  return null
}

export function imeiTypeLabel(type: ImeiProductType): string {
  return type === 'device'
    ? 'Serialized unit (Serial / IMEI)'
    : 'No serial (accessory / part)'
}

export const IMEI_HEALTH_BANNER_DISMISS_KEY = 'hexalyte:dismiss-imei-health-alert'

export function isImeiHealthBannerDismissed(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(IMEI_HEALTH_BANNER_DISMISS_KEY) === '1'
}

export function dismissImeiHealthBanner(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(IMEI_HEALTH_BANNER_DISMISS_KEY, '1')
  }
}
