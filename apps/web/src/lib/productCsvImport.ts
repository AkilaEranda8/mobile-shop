import { inferImeiProductType, imeiTypeToTrackFlag } from '@/lib/productImei'
import type { ProductCondition } from '@/lib/productCondition'

/** Canonical CSV columns aligned with Create Product form */
export const PRODUCT_CSV_COLUMNS = [
  'name',
  'sku',
  'brandName',
  'categoryName',
  'subCategory',
  'deviceModel',
  'barcode',
  'buyingPrice',
  'sellingPrice',
  'stock',
  'minStock',
  'condition',
  'trackImei',
  'warrantyMonths',
  'warrantyNote',
  'description',
] as const

export type ProductCsvColumn = (typeof PRODUCT_CSV_COLUMNS)[number]
export type ProductCsvRow = Partial<Record<ProductCsvColumn, string>>

const COL_ALIASES: Record<string, ProductCsvColumn> = {
  'product name': 'name',
  product: 'name',
  'item name': 'name',
  item: 'name',
  name: 'name',
  sku: 'sku',
  'sku code': 'sku',
  'product code': 'sku',
  category: 'categoryName',
  'category name': 'categoryName',
  categoryname: 'categoryName',
  brand: 'brandName',
  'brand name': 'brandName',
  brandname: 'brandName',
  'sub category': 'subCategory',
  subcategory: 'subCategory',
  'device model': 'deviceModel',
  devicemodel: 'deviceModel',
  model: 'deviceModel',
  barcode: 'barcode',
  'bar code': 'barcode',
  'cost price': 'buyingPrice',
  'buying price': 'buyingPrice',
  cost: 'buyingPrice',
  'purchase price': 'buyingPrice',
  buyingprice: 'buyingPrice',
  'selling price': 'sellingPrice',
  'sale price': 'sellingPrice',
  price: 'sellingPrice',
  'retail price': 'sellingPrice',
  sellingprice: 'sellingPrice',
  'stock qty': 'stock',
  'stock quantity': 'stock',
  qty: 'stock',
  quantity: 'stock',
  stock: 'stock',
  'min stock': 'minStock',
  'minimum stock': 'minStock',
  'min stock alert': 'minStock',
  'min qty': 'minStock',
  minstock: 'minStock',
  condition: 'condition',
  'track imei': 'trackImei',
  imei: 'trackImei',
  'has imei': 'trackImei',
  trackimei: 'trackImei',
  'warranty months': 'warrantyMonths',
  warranty: 'warrantyMonths',
  warrantymonths: 'warrantyMonths',
  'warranty note': 'warrantyNote',
  warrantynote: 'warrantyNote',
  description: 'description',
  desc: 'description',
}

export const PRODUCT_CSV_TEMPLATE = [
  PRODUCT_CSV_COLUMNS.join(','),
  'iPhone 15 Pro 256GB,IP15P-256,Apple,Smartphones,Flagship,iPhone,8850123456789,75000,89999,5,2,Brand New,true,12,1 year shop warranty,256GB Natural Titanium',
  'USB-C Cable 1m,USBC-1M,Generic,Accessories,,,8850999888777,450,890,50,10,Brand New,false,0,,Fast charge cable',
].join('\n')

function normalizeHeader(raw: string): ProductCsvColumn | string {
  const norm = raw.trim().toLowerCase().replace(/^"|"$/g, '').replace(/\s+/g, ' ')
  return COL_ALIASES[norm] ?? raw.trim().replace(/^"|"$/g, '')
}

/** Parse one CSV line respecting quoted commas */
export function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (c === ',' && !inQuotes) {
      out.push(cur.trim())
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur.trim())
  return out.map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"'))
}

export function parseProductCsv(text: string): { rows: ProductCsvRow[]; warnings: string[] } {
  const warnings: string[] = []
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/).filter(l => l.trim())
  if (lines.length === 0) return { rows: [], warnings: ['File is empty'] }

  const headerRaw = parseCsvLine(lines[0])
  const header = headerRaw.map(h => normalizeHeader(h))
  const unknown = headerRaw
    .filter((_, i) => !PRODUCT_CSV_COLUMNS.includes(header[i] as ProductCsvColumn))
    .map(h => h.trim())
  if (unknown.length > 0) {
    warnings.push(`Unknown columns ignored: ${unknown.join(', ')}`)
  }
  if (!header.includes('name')) warnings.push('Missing "name" column')
  if (!header.includes('categoryName')) warnings.push('Missing "categoryName" column')

  const rows: ProductCsvRow[] = []
  for (let li = 1; li < lines.length; li++) {
    const vals = parseCsvLine(lines[li])
    if (vals.every(v => !v.trim())) continue
    const row: ProductCsvRow = {}
    header.forEach((key, i) => {
      if (PRODUCT_CSV_COLUMNS.includes(key as ProductCsvColumn)) {
        row[key as ProductCsvColumn] = vals[i]?.trim() ?? ''
      }
    })
    rows.push(row)
  }
  return { rows, warnings }
}

function parseBool(raw?: string): boolean | undefined {
  const v = raw?.trim().toLowerCase()
  if (!v) return undefined
  if (['true', 'yes', '1', 'y'].includes(v)) return true
  if (['false', 'no', '0', 'n'].includes(v)) return false
  return undefined
}

function parseCondition(raw?: string): ProductCondition {
  const v = raw?.trim().toLowerCase()
  if (!v) return 'BRAND_NEW'
  if (v === 'used' || v === 'pre-owned' || v === 'preowned' || v === 'second hand') return 'USED'
  return 'BRAND_NEW'
}

function parseNumber(raw: string | undefined, fallback: number): number {
  const n = Number(String(raw ?? '').replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : fallback
}

export function validateProductCsvRow(row: ProductCsvRow, rowIndex: number): string[] {
  const errs: string[] = []
  const line = rowIndex + 2
  if (!row.name?.trim()) errs.push(`Row ${line}: Product name is required`)
  if (!row.categoryName?.trim()) errs.push(`Row ${line}: Category is required`)
  if (row.sellingPrice?.trim() && Number.isNaN(Number(row.sellingPrice.replace(/,/g, '')))) {
    errs.push(`Row ${line}: Invalid selling price`)
  }
  if (row.buyingPrice?.trim() && Number.isNaN(Number(row.buyingPrice.replace(/,/g, '')))) {
    errs.push(`Row ${line}: Invalid buying price`)
  }
  return errs
}

export function productCsvRowToPayload(row: ProductCsvRow) {
  const explicitImei = parseBool(row.trackImei)
  let trackImei: boolean | undefined = explicitImei
  if (trackImei === undefined) {
    const inferred = inferImeiProductType({
      categoryName: row.categoryName,
      productName: row.name,
      deviceModel: row.deviceModel,
    })
    if (inferred !== null) trackImei = imeiTypeToTrackFlag(inferred)
  }

  const sku = row.sku?.trim()
  const barcode = row.barcode?.trim()

  return {
    name: row.name!.trim(),
    sku: sku || undefined,
    brandName: row.brandName?.trim() || 'General',
    categoryName: row.categoryName!.trim(),
    subCategory: row.subCategory?.trim() || undefined,
    deviceModel: row.deviceModel?.trim() || undefined,
    barcode: barcode || sku || undefined,
    buyingPrice: parseNumber(row.buyingPrice, 0),
    sellingPrice: parseNumber(row.sellingPrice, 0),
    stock: Math.max(0, parseNumber(row.stock, 0)),
    minStock: Math.max(0, parseNumber(row.minStock, 5)),
    condition: parseCondition(row.condition),
    warrantyMonths: Math.max(0, parseNumber(row.warrantyMonths, 0)),
    warrantyNote: row.warrantyNote?.trim() || undefined,
    description: row.description?.trim() || undefined,
    ...(trackImei !== undefined ? { trackImei } : {}),
  }
}

export function escapeCsvCell(value: unknown): string {
  const s = String(value ?? '')
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function productToCsvRow(p: {
  name: string
  sku: string
  brandName?: string
  categoryName?: string
  subCategory?: string | null
  deviceModel?: string | null
  barcode?: string | null
  buyingPrice: number
  sellingPrice: number
  stock: number
  minStock: number
  condition?: string
  trackImei?: boolean
  warrantyMonths?: number
  warrantyNote?: string | null
  description?: string | null
}): string {
  return [
    escapeCsvCell(p.name),
    escapeCsvCell(p.sku),
    escapeCsvCell(p.brandName ?? ''),
    escapeCsvCell(p.categoryName ?? ''),
    escapeCsvCell(p.subCategory ?? ''),
    escapeCsvCell(p.deviceModel ?? ''),
    escapeCsvCell(p.barcode ?? ''),
    p.buyingPrice,
    p.sellingPrice,
    p.stock,
    p.minStock,
    escapeCsvCell(p.condition === 'USED' ? 'Used' : 'Brand New'),
    p.trackImei ? 'true' : 'false',
    p.warrantyMonths ?? 0,
    escapeCsvCell(p.warrantyNote ?? ''),
    escapeCsvCell(p.description ?? ''),
  ].join(',')
}
