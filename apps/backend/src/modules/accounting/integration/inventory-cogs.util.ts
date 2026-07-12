import { isReloadSaleItem } from '../../finance/reload-item.util'

export function round2(n: number) {
  return Math.round(n * 100) / 100
}

export function isMobileProduct(product: { trackImei?: boolean; category?: { name?: string; slug?: string } | null } | null) {
  if (!product) return false
  if (product.trackImei) return true
  const cat = `${product.category?.name ?? ''} ${product.category?.slug ?? ''}`.toLowerCase()
  return /mobile|phone|smartphone|handset/.test(cat)
}

export function isSparePartProduct(product: { category?: { name?: string; slug?: string } | null } | null) {
  if (!product) return false
  const cat = `${product.category?.name ?? ''} ${product.category?.slug ?? ''}`.toLowerCase()
  return /spare|part|component|battery|batteries|screen|display|lcd|charging\s*port|flex|cable|connector/.test(cat)
}

export type CogsLineItem = {
  productId: string
  productName: string
  sku: string
  imei: string | null
  quantity: number
  unitCost: number
  totalCost: number
  bucket: 'mobile' | 'accessory' | 'parts'
}

export function buildSaleCogsLines(
  items: Array<{
    productId: string | null
    productName: string
    sku: string
    imei: string | null
    quantity: number
    product: { buyingPrice: number; trackImei?: boolean; category?: { name?: string; slug?: string } | null } | null
  }>,
): { mobile: CogsLineItem[]; accessory: CogsLineItem[] } {
  const mobile: CogsLineItem[] = []
  const accessory: CogsLineItem[] = []

  for (const item of items) {
    if (!item.productId || !item.product) continue
    if (isReloadSaleItem(item)) continue

    const qty = Math.max(0, Number(item.quantity ?? 0))
    if (qty <= 0) continue

    const unitCost = round2(Math.max(0, Number(item.product.buyingPrice ?? 0)))
    const totalCost = round2(qty * unitCost)
    if (totalCost <= 0) continue

    const row: CogsLineItem = {
      productId: item.productId,
      productName: item.productName,
      sku: item.sku ?? '',
      imei: item.imei ?? null,
      quantity: qty,
      unitCost,
      totalCost,
      bucket: isMobileProduct(item.product) ? 'mobile' : 'accessory',
    }
    if (row.bucket === 'mobile') mobile.push(row)
    else accessory.push(row)
  }

  return { mobile, accessory }
}

export function buildRepairCogsLines(
  parts: Array<{
    productId: string
    productName: string
    quantity: number
    unitCost: number
    unitBuyCost: number
    product?: { buyingPrice: number } | null
  }>,
): CogsLineItem[] {
  const rows: CogsLineItem[] = []
  for (const part of parts) {
    const qty = Math.max(0, Number(part.quantity ?? 0))
    if (qty <= 0) continue
    const unitCost = round2(Math.max(0, Number(part.unitBuyCost || part.unitCost || part.product?.buyingPrice || 0)))
    const totalCost = round2(qty * unitCost)
    if (totalCost <= 0) continue
    rows.push({
      productId: part.productId,
      productName: part.productName,
      sku: '',
      imei: null,
      quantity: qty,
      unitCost,
      totalCost,
      bucket: 'parts',
    })
  }
  return rows
}

export function buildPurchaseInventoryLines(
  items: Array<{
    productId: string | null
    productName: string
    sku: string | null
    quantity: number
    unitCost: number
    total: number
    product: { buyingPrice: number; trackImei?: boolean; category?: { name?: string; slug?: string } | null } | null
  }>,
): { mobile: CogsLineItem[]; accessory: CogsLineItem[]; parts: CogsLineItem[] } {
  const mobile: CogsLineItem[] = []
  const accessory: CogsLineItem[] = []
  const parts: CogsLineItem[] = []

  for (const item of items) {
    const qty = Math.max(0, Number(item.quantity ?? 0))
    if (qty <= 0) continue
    const unitCost = round2(Math.max(0, Number(item.unitCost ?? item.product?.buyingPrice ?? 0)))
    const totalCost = round2(Math.max(0, Number(item.total ?? 0)) || qty * unitCost)
    if (totalCost <= 0) continue

    const row: CogsLineItem = {
      productId: item.productId ?? '',
      productName: item.productName,
      sku: item.sku ?? '',
      imei: null,
      quantity: qty,
      unitCost,
      totalCost,
      bucket: 'accessory',
    }

    if (item.product && isSparePartProduct(item.product)) {
      row.bucket = 'parts'
      parts.push(row)
    } else if (item.product && isMobileProduct(item.product)) {
      row.bucket = 'mobile'
      mobile.push(row)
    } else {
      accessory.push(row)
    }
  }

  return { mobile, accessory, parts }
}
