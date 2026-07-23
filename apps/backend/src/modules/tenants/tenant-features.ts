export const ALL_FEATURES: string[] = [
  'POS', 'REPAIRS', 'WARRANTY', 'WHATSAPP', 'ANALYTICS', 'REPORTS',
  'FINANCE', 'DELIVERY', 'EXCHANGES', 'STAFF', 'SUPPLIERS', 'IMEI', 'SERVICES',
  'DAILY_RELOAD', 'CUSTOMER_CREDIT', 'DAILY_CLOSING', 'PROFIT_ALLOCATION', 'ACCOUNTING',
  'WHOLESALE_PRICING', 'CREDIT_PRICING', 'POS_PRICE_EDIT', 'POS_BILL_DATE',
  'INVENTORY_ENGINE', 'PRICING_ENGINE', 'WORKFLOW_VALIDATORS',
]

export const OPT_IN_FEATURES: string[] = [
  'DAILY_RELOAD', 'CUSTOMER_CREDIT', 'DAILY_CLOSING', 'PROFIT_ALLOCATION', 'ACCOUNTING',
  'WHOLESALE_PRICING', 'CREDIT_PRICING', 'POS_PRICE_EDIT', 'POS_BILL_DATE',
  'INVENTORY_ENGINE', 'PRICING_ENGINE', 'WORKFLOW_VALIDATORS',
]

/** Features that require admin-set monthly price when enabled */
export const PRICED_FEATURES: string[] = ['POS', 'SERVICES']

export type TenantFeatureRow = { feature: string; enabled: boolean; price?: number | null }

export function buildFeatureMap(rows: TenantFeatureRow[]) {
  const map: Record<string, boolean> = {}
  for (const f of ALL_FEATURES) {
    if (OPT_IN_FEATURES.includes(f)) map[f] = false
    else map[f] = true
  }
  for (const r of rows) map[r.feature] = r.enabled
  return map
}

export function buildPriceMap(rows: Pick<TenantFeatureRow, 'feature' | 'price'>[]) {
  const prices: Record<string, number | null> = {}
  for (const f of PRICED_FEATURES) prices[f] = null
  for (const r of rows) {
    if (PRICED_FEATURES.includes(r.feature) && r.price != null) {
      prices[r.feature] = r.price
    }
  }
  return prices
}
