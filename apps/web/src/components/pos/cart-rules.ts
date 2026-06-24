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
  const root = saleResponse as { data?: { warranties?: Array<{ warrantyCode?: string }> }; warranties?: Array<{ warrantyCode?: string }> }
  const list = root?.data?.warranties ?? root?.warranties ?? []
  return list.map(w => w.warrantyCode).filter((c): c is string => Boolean(c))
}

export function formatWarrantyMonths(months: number): string {
  if (months < 12) return `${months} mo`
  if (months % 12 === 0) return `${months / 12} yr`
  return `${months} mo`
}
