export type ReloadServiceType = 'RELOAD' | 'RECHARGE_CARD'

export interface CartItem {
  cartId: string
  productId: string | null
  name: string
  sku: string
  price: number
  originalPrice: number
  quantity: number
  imei?: string
  isService?: boolean
  isReload?: boolean
  reloadProvider?: string
  reloadType?: ReloadServiceType
  cost?: number
  serviceId?: string
  variationLabel?: string
  warrantyMonths?: number
  trackImei?: boolean
}

export interface PosFeatureFlags {
  hasIMEI: boolean
  hasFinance: boolean
  hasDailyReload: boolean
  hasServices: boolean
  hasDailyClosing: boolean
  hasWarranty: boolean
  hasRepairs: boolean
  hasCustomerCredit: boolean
}
