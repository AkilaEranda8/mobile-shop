export type ConfigDomain =
  | 'invoice'
  | 'reload'
  | 'paymentMethod'
  | 'productVariant'
  | 'productCode'

export type ConfigDomainMeta = {
  domain: ConfigDomain
  /** Prisma Tenant JSON column */
  column: string
  description: string
}

export const CONFIG_DOMAIN_META: ConfigDomainMeta[] = [
  { domain: 'invoice', column: 'invoiceSettings', description: 'Invoice / thermal / barcode label settings' },
  { domain: 'reload', column: 'reloadSettings', description: 'Daily reload commission settings' },
  { domain: 'paymentMethod', column: 'paymentMethodSettings', description: 'POS payment method enablement' },
  { domain: 'productVariant', column: 'productVariantSettings', description: 'Product variant UI/behavior' },
  { domain: 'productCode', column: 'productCodeSettings', description: 'SKU / barcode generation' },
]
