export interface MasterCatalogVariantDraft {
  storage: string
  colorName: string
  colorHex: string
  sku?: string
}

export interface MasterCatalogFormDraft {
  name: string
  sku: string
  brandName: string
  categoryName: string
  deviceModel?: string
  trackImei: boolean
  warrantyMonths: number
  variants: MasterCatalogVariantDraft[]
}

function skuPart(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
    .toUpperCase() || 'ITEM'
}

export function buildMasterCatalogSku(brandName: string, modelName: string): string {
  return `MC-${skuPart(brandName)}-${skuPart(modelName)}`.slice(0, 80)
}

export function buildMasterCatalogAccessorySku(categoryName: string, name: string, brandName?: string | null): string {
  const parts = ['MC', skuPart(categoryName), brandName ? skuPart(brandName) : 'GEN', skuPart(name)]
  return parts.filter(Boolean).join('-').slice(0, 80)
}
