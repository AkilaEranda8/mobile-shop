import type { CartItem } from './types'

/** Lines that must stay qty=1 (IMEI, reload, warranty-tracked phones). */
export function isQtyLockedLine(item: CartItem): boolean {
  if (item.isReload || item.isService) return true
  if (item.imei) return true
  if ((item.warrantyMonths ?? 0) > 0 && item.trackImei) return true
  return false
}

export function getWarrantyCartItems(cart: CartItem[], hasWarranty: boolean): CartItem[] {
  if (!hasWarranty) return []
  return cart.filter(i => !i.isService && !i.isReload && (i.warrantyMonths ?? 0) > 0)
}

export function cartNeedsCustomer(cart: CartItem[], hasWarranty: boolean): boolean {
  return getWarrantyCartItems(cart, hasWarranty).length > 0
}

export function cartNeedsOnline(cart: CartItem[], hasWarranty: boolean): boolean {
  return cart.some(i => i.isReload) || getWarrantyCartItems(cart, hasWarranty).length > 0
}

export function extractSaleWarrantyCodes(saleResponse: unknown): string[] {
  return extractSaleWarranties(saleResponse).map(w => w.warrantyCode)
}

export interface SaleWarrantyLine {
  warrantyCode: string
  productName?: string
  imei?: string
  endDate?: string
  monthsDuration?: number
}

export function extractSaleWarranties(saleResponse: unknown): SaleWarrantyLine[] {
  const root = saleResponse as {
    data?: { warranties?: Array<Record<string, unknown>> }
    warranties?: Array<Record<string, unknown>>
  }
  const list = root?.data?.warranties ?? root?.warranties ?? []
  return list
    .map(w => ({
      warrantyCode: String(w.warrantyCode ?? ''),
      productName: w.productName != null ? String(w.productName) : undefined,
      imei: w.imei != null ? String(w.imei) : undefined,
      endDate: w.endDate != null ? String(w.endDate) : undefined,
      monthsDuration: w.monthsDuration != null ? Number(w.monthsDuration) : undefined,
    }))
    .filter(w => Boolean(w.warrantyCode))
}

export function formatWarrantyMonths(months: number): string {
  if (months < 12) return `${months} mo`
  if (months % 12 === 0) return `${months / 12} yr`
  return `${months} mo`
}

/** Full text for invoices and receipts (e.g. "12 months", "1 year"). */
export function formatWarrantyPeriodLabel(months: number): string {
  if (months <= 0) return ''
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`
  if (months % 12 === 0) {
    const years = months / 12
    return `${years} year${years === 1 ? '' : 's'}`
  }
  return `${months} months`
}

export function matchWarrantyMonths(
  w: { imei?: string; productName?: string; monthsDuration?: number },
  items: Array<{ productName?: string; imei?: string; warrantyMonths?: number }>,
  fallback?: number,
): number {
  if ((w.monthsDuration ?? 0) > 0) return w.monthsDuration!
  const byImei = w.imei ? items.find(i => i.imei === w.imei) : undefined
  const byName = w.productName ? items.find(i => i.productName === w.productName) : undefined
  return byImei?.warrantyMonths ?? byName?.warrantyMonths ?? fallback ?? 0
}
