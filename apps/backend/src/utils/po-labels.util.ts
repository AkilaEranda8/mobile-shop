import type { Prisma } from '@prisma/client'
import { generateProductBarcode } from './counters'

export type PoLabelRow = {
  productId: string
  poItemId: string
  barcode: string
  name: string
  sku: string
  price: number
  qty: number
  trackImei: boolean
}

type PoItemLike = {
  id: string
  productId: string | null
  productName: string
  sku?: string | null
  quantity: number
  receivedQuantity?: number | null
}

type ProductLike = {
  id: string
  name: string
  sku: string
  barcode: string | null
  sellingPrice: number
  trackImei: boolean
}

/** Ensure accessory product has a scannable barcode saved (SKU first, else generate BC). */
export async function ensureProductBarcode(
  tx: Prisma.TransactionClient,
  tenantId: string,
  tenantSlug: string,
  product: ProductLike,
): Promise<string | null> {
  if (product.trackImei) return product.barcode?.trim() || product.sku?.trim() || null

  let barcode = product.barcode?.trim() || ''
  if (!barcode && product.sku?.trim()) barcode = product.sku.trim()
  if (!barcode) barcode = await generateProductBarcode(tenantId, tenantSlug)

  if (barcode !== (product.barcode?.trim() || '')) {
    await tx.product.update({ where: { id: product.id }, data: { barcode } })
  }
  return barcode
}

export function resolveLabelBarcode(product: ProductLike): string | null {
  if (product.trackImei) return null
  return product.barcode?.trim() || product.sku?.trim() || null
}

export function buildLabelsFromPoItems(
  items: PoItemLike[],
  productMap: Map<string, ProductLike>,
): PoLabelRow[] {
  const labels: PoLabelRow[] = []

  for (const item of items) {
    const productId = item.productId
    if (!productId) continue
    const p = productMap.get(productId)
    if (!p || p.trackImei) continue

    const barcode = resolveLabelBarcode(p)
    if (!barcode) continue

    const qty = Math.max(1, item.receivedQuantity ?? item.quantity ?? 1)
    labels.push({
      productId,
      poItemId: item.id,
      barcode,
      name: item.productName || p.name,
      sku: item.sku?.trim() || p.sku,
      price: Number(p.sellingPrice),
      qty,
      trackImei: false,
    })
  }

  return labels
}
