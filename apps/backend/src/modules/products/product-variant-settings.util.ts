export interface ProductVariantColor {
  name: string
  hex: string
}

export interface ProductVariantSettings {
  storageOptions: string[]
  colorOptions: ProductVariantColor[]
  subCategoryOptions: string[]
}

export const DEFAULT_SUB_CATEGORY_OPTIONS = [
  'Flagship', 'Mid Range', 'Budget', 'Entry Level', 'Premium', 'Ultra', 'Lite', 'Pro', 'Plus', 'Standard',
]

export const DEFAULT_PRODUCT_VARIANT_SETTINGS: ProductVariantSettings = {
  subCategoryOptions: [...DEFAULT_SUB_CATEGORY_OPTIONS],
  storageOptions: [
    '16GB', '32GB', '64GB', '128GB', '256GB', '512GB', '1TB', '2TB',
    'Basic', 'Standard', 'Pro', 'Max', 'Plus', 'Lite',
  ],
  colorOptions: [
    { name: 'Black', hex: '#1a1a1a' },
    { name: 'White', hex: '#e5e5e5' },
    { name: 'Silver', hex: '#c0c0c0' },
    { name: 'Gold', hex: '#d4af6e' },
    { name: 'Blue', hex: '#2563eb' },
    { name: 'Red', hex: '#dc2626' },
    { name: 'Green', hex: '#16a34a' },
    { name: 'Purple', hex: '#7c3aed' },
    { name: 'Pink', hex: '#db2777' },
    { name: 'Yellow', hex: '#ca8a04' },
    { name: 'Orange', hex: '#ea580c' },
    { name: 'Titanium', hex: '#8a8a8a' },
    { name: 'Midnight', hex: '#1e1b4b' },
    { name: 'Starlight', hex: '#f0ebe3' },
    { name: 'Graphite', hex: '#374151' },
  ],
}

function cleanHex(hex: unknown): string {
  if (typeof hex !== 'string') return '#6b7280'
  const v = hex.trim()
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : '#6b7280'
}

function dedupeStrings(items: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items) {
    const v = item.trim()
    if (!v) continue
    const key = v.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(v)
  }
  return out
}

function dedupeColors(items: ProductVariantColor[]): ProductVariantColor[] {
  const seen = new Set<string>()
  const out: ProductVariantColor[] = []
  for (const item of items) {
    const name = item.name?.trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ name, hex: cleanHex(item.hex) })
  }
  return out
}

export function normalizeProductVariantSettings(raw: unknown): ProductVariantSettings {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  let subCategoryOptions = [...DEFAULT_PRODUCT_VARIANT_SETTINGS.subCategoryOptions]
  let storageOptions = [...DEFAULT_PRODUCT_VARIANT_SETTINGS.storageOptions]
  let colorOptions = [...DEFAULT_PRODUCT_VARIANT_SETTINGS.colorOptions]

  if (Array.isArray(src.subCategoryOptions) && src.subCategoryOptions.length > 0) {
    const parsed = src.subCategoryOptions
      .filter((v): v is string => typeof v === 'string')
      .map(v => v.trim())
      .filter(Boolean)
    if (parsed.length > 0) subCategoryOptions = dedupeStrings(parsed)
  }

  if (Array.isArray(src.storageOptions) && src.storageOptions.length > 0) {
    const parsed = src.storageOptions
      .filter((v): v is string => typeof v === 'string')
      .map(v => v.trim())
      .filter(Boolean)
    if (parsed.length > 0) storageOptions = dedupeStrings(parsed)
  }

  if (Array.isArray(src.colorOptions) && src.colorOptions.length > 0) {
    const parsed = src.colorOptions
      .filter((v): v is Record<string, unknown> => v && typeof v === 'object')
      .map(v => ({ name: String(v.name ?? ''), hex: cleanHex(v.hex) }))
    const cleaned = dedupeColors(parsed)
    if (cleaned.length > 0) colorOptions = cleaned
  }

  return { subCategoryOptions, storageOptions, colorOptions }
}
