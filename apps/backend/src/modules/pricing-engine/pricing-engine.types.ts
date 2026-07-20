/** POS / catalog price mode: non-retail modes fall back to retail when unset (0). */
export type PriceMode = 'retail' | 'wholesale' | 'credit'

export type PricingCatalogItem = {
  sellingPrice?: number | null
  wholesalePrice?: number | null
  creditPrice?: number | null
  price?: number | null
}

export type PricingProductSnapshot = PricingCatalogItem & {
  id?: string
  name?: string
  storageVariations?: unknown
}

export type ResolveSaleLinePriceInput = {
  product: PricingProductSnapshot
  sku?: string | null
  variationLabel?: string | null
  mode: PriceMode
  clientUnitPrice?: number | null
  /** When true (POS_PRICE_EDIT), keep client price if valid. */
  allowManualOverride: boolean
}

export type ResolvedSaleLinePrice = {
  unitPrice: number
  catalogPrice: number
  mode: PriceMode
  overridden: boolean
  source: 'catalog' | 'client_override' | 'service'
}
