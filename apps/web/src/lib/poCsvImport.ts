import { parseCsvLine, escapeCsvCell } from '@/lib/productCsvImport'
import { findProductByCode, normalizeScanCode } from '@/lib/barcode-scan'

/** Canonical CSV columns for Purchase Order bulk import */
export const PO_CSV_COLUMNS = [
  'sku',
  'productName',
  'storage',
  'colorName',
  'quantity',
  'unitCost',
] as const

export type PoCsvColumn = (typeof PO_CSV_COLUMNS)[number]
export type PoCsvRow = Partial<Record<PoCsvColumn, string>>

const COL_ALIASES: Record<string, PoCsvColumn> = {
  sku: 'sku',
  'sku code': 'sku',
  'product sku': 'sku',
  'variant sku': 'sku',
  barcode: 'sku',
  'product name': 'productName',
  product: 'productName',
  productname: 'productName',
  name: 'productName',
  item: 'productName',
  'item name': 'productName',
  storage: 'storage',
  variant: 'storage',
  'storage size': 'storage',
  size: 'storage',
  color: 'colorName',
  colour: 'colorName',
  colorname: 'colorName',
  'color name': 'colorName',
  quantity: 'quantity',
  qty: 'quantity',
  'order qty': 'quantity',
  'unit cost': 'unitCost',
  unitcost: 'unitCost',
  cost: 'unitCost',
  'buying price': 'unitCost',
  'cost price': 'unitCost',
  price: 'unitCost',
}

export const PO_CSV_TEMPLATE = [
  PO_CSV_COLUMNS.join(','),
  // Sample: variant SKU (preferred) — must already exist in inventory
  'IP15P-256-NT,,,2,75000',
  // Sample: product name + storage + color — must match an existing variant
  ',iPhone 15 Pro,256GB,Natural Titanium,1,76000',
  // Sample: simple product without variants
  'USBC-1M,USB-C Cable 1m,,,20,450',
].join('\n')

function normalizeHeader(raw: string): PoCsvColumn | string {
  const norm = raw.trim().toLowerCase().replace(/^"|"$/g, '').replace(/\s+/g, ' ')
  return COL_ALIASES[norm] ?? raw.trim().replace(/^"|"$/g, '')
}

function normalizeStorageVariations(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function resolvePoUnitCost(
  product: { buyingPrice?: number | string | null },
  variation?: { costPrice?: number | string | null },
) {
  const varCost = variation?.costPrice != null && variation.costPrice !== '' ? Number(variation.costPrice) : NaN
  const buyCost = product?.buyingPrice != null && product.buyingPrice !== '' ? Number(product.buyingPrice) : NaN
  if (Number.isFinite(varCost) && varCost > 0) return varCost
  if (Number.isFinite(buyCost) && buyCost > 0) return buyCost
  return '' as const
}

export function parsePoCsv(text: string): { rows: PoCsvRow[]; warnings: string[] } {
  const warnings: string[] = []
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length < 2) {
    return { rows: [], warnings: ['CSV must include a header row and at least one data row'] }
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader)
  const known = new Set<string>(PO_CSV_COLUMNS)
  const mapped = headers.filter(h => known.has(h as string))
  if (!mapped.includes('quantity') && !mapped.includes('sku') && !mapped.includes('productName')) {
    warnings.push('Could not recognise CSV headers. Use the downloaded template.')
  }

  const rows: PoCsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i])
    if (cells.every(c => !c.trim())) continue
    const row: PoCsvRow = {}
    headers.forEach((h, idx) => {
      if (known.has(h as string)) {
        row[h as PoCsvColumn] = (cells[idx] ?? '').trim()
      }
    })
    rows.push(row)
  }
  return { rows, warnings }
}

export type PoCatalogProduct = {
  id: string
  name: string
  sku?: string
  barcode?: string | null
  buyingPrice?: number | string | null
  storageVariations?: unknown
}

export type ResolvedPoCsvItem = {
  productId: string
  productName: string
  quantity: number
  unitCost: number
  total: number
  receivedQuantity: number
  storage?: string
  colorName?: string
  sku?: string
}

export type PoCsvValidatedRow = {
  line: number
  raw: PoCsvRow
  ok: boolean
  errors: string[]
  item?: ResolvedPoCsvItem
}

function norm(s?: string | null) {
  return String(s ?? '').trim().toLowerCase()
}

function findVariant(
  vars: any[],
  opts: { sku?: string; storage?: string; colorName?: string },
): any | undefined {
  const sku = normalizeScanCode(opts.sku ?? '').toLowerCase()
  if (sku) {
    const bySku = vars.find(v => String(v.sku ?? '').toLowerCase() === sku)
    if (bySku) return bySku
  }
  const storage = norm(opts.storage)
  const color = norm(opts.colorName)
  if (storage || color) {
    return vars.find(v => {
      const vs = norm(v.storage)
      const vc = norm(v.colorName)
      const storageOk = !storage || vs === storage
      const colorOk = !color || vc === color
      return storageOk && colorOk && (storage || color)
    })
  }
  return undefined
}

/**
 * Resolve one CSV row against existing inventory.
 * Rejects unknown products / missing variants — never creates catalog items.
 */
export function validatePoCsvRow(
  row: PoCsvRow,
  line: number,
  products: PoCatalogProduct[],
): PoCsvValidatedRow {
  const errors: string[] = []
  const sku = (row.sku ?? '').trim()
  const productName = (row.productName ?? '').trim()
  const storage = (row.storage ?? '').trim()
  const colorName = (row.colorName ?? '').trim()
  const qtyRaw = (row.quantity ?? '').trim()
  const costRaw = (row.unitCost ?? '').trim()

  const quantity = Number(qtyRaw)
  if (!qtyRaw || !Number.isFinite(quantity) || quantity <= 0) {
    errors.push('quantity must be a number greater than 0')
  }

  let product: PoCatalogProduct | undefined
  let variation: any | undefined

  if (sku) {
    const hit = findProductByCode(products as any, sku)
    if (!hit) {
      errors.push(`SKU/barcode "${sku}" not found in inventory`)
    } else {
      product = hit.product
      variation = hit.variation
      const vars = normalizeStorageVariations(product.storageVariations)
      if (vars.length > 0 && !variation) {
        variation = findVariant(vars, { sku, storage, colorName })
        if (!variation) {
          errors.push(
            `Product "${product.name}" has variants — use a variant SKU or storage + color that exists`,
          )
        }
      }
    }
  } else if (productName) {
    const matches = products.filter(p => norm(p.name) === norm(productName))
    if (matches.length === 0) {
      errors.push(`Product "${productName}" not found in inventory`)
    } else if (matches.length > 1) {
      errors.push(`Multiple products named "${productName}" — use SKU instead`)
    } else {
      product = matches[0]
      const vars = normalizeStorageVariations(product.storageVariations)
      if (vars.length > 0) {
        variation = findVariant(vars, { storage, colorName })
        if (!variation) {
          errors.push(
            `Variant not found for "${product.name}"` +
              (storage || colorName
                ? ` (storage="${storage}", color="${colorName}")`
                : ' — provide storage + colorName or variant SKU'),
          )
        }
      }
    }
  } else {
    errors.push('Provide sku or productName')
  }

  let unitCost = costRaw !== '' ? Number(costRaw) : NaN
  if (costRaw !== '' && (!Number.isFinite(unitCost) || unitCost < 0)) {
    errors.push('unitCost must be a valid number ≥ 0')
  }

  if (product && errors.length === 0) {
    if (!Number.isFinite(unitCost) || unitCost <= 0) {
      const resolved = resolvePoUnitCost(product, variation)
      unitCost = resolved === '' ? NaN : Number(resolved)
    }
    if (!Number.isFinite(unitCost) || unitCost <= 0) {
      errors.push('unitCost missing and no buying/cost price on inventory item')
    }
  }

  if (errors.length || !product || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost <= 0) {
    return { line, raw: row, ok: false, errors: errors.length ? errors : ['Invalid row'] }
  }

  const resolvedSku = (variation?.sku as string | undefined) || sku || undefined

  return {
    line,
    raw: row,
    ok: true,
    errors: [],
    item: {
      productId: product.id,
      productName: product.name,
      quantity,
      unitCost,
      total: quantity * unitCost,
      receivedQuantity: 0,
      storage: variation?.storage ?? (storage || undefined),
      colorName: variation?.colorName ?? (colorName || undefined),
      sku: resolvedSku,
    },
  }
}

export function validatePoCsvRows(
  rows: PoCsvRow[],
  products: PoCatalogProduct[],
): PoCsvValidatedRow[] {
  return rows.map((row, i) => validatePoCsvRow(row, i + 2, products))
}

export function downloadPoCsvTemplate() {
  const blob = new Blob([PO_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'purchase-order-import-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function buildPoCsvSampleFromCatalog(products: PoCatalogProduct[], limit = 5): string {
  const lines = [PO_CSV_COLUMNS.join(',')]
  let n = 0
  for (const p of products) {
    if (n >= limit) break
    const vars = normalizeStorageVariations(p.storageVariations)
    if (vars.length > 0) {
      const v = vars[0]
      const cost = resolvePoUnitCost(p, v)
      lines.push([
        escapeCsvCell(v.sku || ''),
        escapeCsvCell(p.name),
        escapeCsvCell(v.storage ?? ''),
        escapeCsvCell(v.colorName ?? ''),
        '1',
        escapeCsvCell(cost === '' ? '' : cost),
      ].join(','))
      n++
    } else {
      const cost = resolvePoUnitCost(p)
      lines.push([
        escapeCsvCell(p.sku || ''),
        escapeCsvCell(p.name),
        '',
        '',
        '1',
        escapeCsvCell(cost === '' ? '' : cost),
      ].join(','))
      n++
    }
  }
  return lines.join('\n')
}
