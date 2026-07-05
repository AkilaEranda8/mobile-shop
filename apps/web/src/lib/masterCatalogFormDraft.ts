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
  description?: string
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

export function buildPhoneCatalogDescription(opts: {
  brandName: string
  modelName: string
  categoryName: string
  releaseYear?: number | null
  variants: MasterCatalogVariantDraft[]
}): string {
  const lines = [
    `${opts.brandName} ${opts.modelName}`.trim(),
    '',
    `Brand: ${opts.brandName}`,
    `Model: ${opts.modelName}`,
    `Category: ${opts.categoryName}`,
  ]
  if (opts.releaseYear) lines.push(`Release year: ${opts.releaseYear}`)
  if (opts.variants.length) {
    lines.push('', 'Variants:')
    for (const v of opts.variants) {
      lines.push(`• ${v.storage} · ${v.colorName}`)
    }
  }
  return lines.join('\n').slice(0, 2000)
}

export function buildAccessoryCatalogDescription(opts: {
  name: string
  brandName: string
  categoryName: string
  modelOptional?: string | null
}): string {
  const lines = [
    opts.name,
    '',
    `Brand: ${opts.brandName}`,
    `Category: ${opts.categoryName}`,
  ]
  if (opts.modelOptional?.trim()) lines.push(`Compatible model: ${opts.modelOptional.trim()}`)
  return lines.join('\n').slice(0, 2000)
}
