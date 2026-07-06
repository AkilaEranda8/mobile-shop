/** Build a variant SKU from a base tenant SKU + storage/color. */
export function variantSkuFromBase(baseSku: string, storage: string, colorName: string): string {
  const storagePart = storage.replace(/\s/g, '') || 'VAR'
  const colorPart = (colorName || 'CLR').slice(0, 3).toUpperCase().replace(/\s/g, '')
  const suffix = `-${storagePart}-${colorPart}`
  const max = 50
  const base = baseSku.trim() || 'SKU'
  if (base.length + suffix.length <= max) return `${base}${suffix}`
  return `${base.slice(0, max - suffix.length)}${suffix}`
}
