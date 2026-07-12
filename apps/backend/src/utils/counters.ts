import { redis } from '../config/redis'
import { prisma } from '../config/database'
import {
  analyzeProductSkus,
  deserializeSkuFormat,
  serializeSkuFormat,
  type SkuCodeFormat,
} from './product-sku-seq'
import {
  fetchTenantProductCodeSettings,
  syncProductCodeCounters,
  type ProductCodeSettings,
} from '../modules/products/product-code-settings.util'

export {
  analyzeProductSkus,
  formatSkuFromSeq,
  parseProductSkuSequence,
  type SkuCodeFormat,
} from './product-sku-seq'

function nextSeq(last: string | undefined, prefix: string): string {
  let seq = 1
  if (last) {
    const tail = last.slice(prefix.length + 1)
    const n = parseInt(tail, 10)
    if (!isNaN(n)) seq = n + 1
  }
  return `${prefix}-${String(seq).padStart(4, '0')}`
}

export async function generateInvoiceNumber(tenantId: string): Promise<string> {
  const key = `inv_seq:${tenantId}`
  const seeded = await redis.set(key, '0', 'NX')
  if (seeded === 'OK') {
    const all = await prisma.sale.findMany({ where: { tenantId }, select: { invoiceNumber: true } })
    let max = all.length
    for (const s of all) {
      const m = s.invoiceNumber?.match(/(\d+)$/)
      if (m) max = Math.max(max, parseInt(m[1], 10))
    }
    await redis.set(key, String(max))
  }
  const next = await redis.incr(key)
  return `INV-${String(next).padStart(5, '0')}`
}

export async function generateTicketNumber(tenantId: string): Promise<string> {
  const today = new Date()
  const prefix = `TKT-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`
  const last = await prisma.repairTicket.findFirst({
    where: { tenantId, ticketNumber: { startsWith: prefix } },
    orderBy: { ticketNumber: 'desc' },
    select: { ticketNumber: true },
  })
  return nextSeq(last?.ticketNumber, prefix)
}

export async function generatePONumber(tenantId: string): Promise<string> {
  const today = new Date()
  const prefix = `PO-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`
  const last = await prisma.purchaseOrder.findFirst({
    where: { tenantId, poNumber: { startsWith: prefix } },
    orderBy: { poNumber: 'desc' },
    select: { poNumber: true },
  })
  return nextSeq(last?.poNumber, prefix)
}

export async function generateReturnNumber(tenantId: string): Promise<string> {
  const today = new Date()
  const prefix = `RET-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
  const last = await prisma.saleReturn.findFirst({
    where: { tenantId, returnNumber: { startsWith: prefix } },
    orderBy: { returnNumber: 'desc' },
    select: { returnNumber: true },
  })
  return nextSeq(last?.returnNumber, prefix)
}

export function generateWarrantyCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'WR-'
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/** Short uppercase tenant prefix for product codes (max 6 chars). */
export function tenantProductPrefix(slug: string): string {
  const s = slug.replace(/[^a-z0-9]/gi, '').toUpperCase()
  if (!s) return 'TNT'
  return s.length <= 6 ? s : s.slice(0, 6)
}

function skuFormatRedisKey(tenantId: string) {
  return `product_sku_fmt:${tenantId}`
}

function skuSeqRedisKey(tenantId: string) {
  return `product_sku_seq:${tenantId}`
}

function barcodeSeqRedisKey(tenantId: string) {
  return `product_bc_seq:${tenantId}`
}

async function loadSkuFormat(tenantId: string, tenantSlug: string): Promise<SkuCodeFormat> {
  const defaultPrefix = `${tenantProductPrefix(tenantSlug)}-SKU`
  const fmtKey = skuFormatRedisKey(tenantId)
  const storedFmt = await redis.get(fmtKey)
  if (storedFmt) return deserializeSkuFormat(storedFmt, defaultPrefix)

  const products = await prisma.product.findMany({ where: { tenantId }, select: { sku: true } })
  const analysis = analyzeProductSkus(products.map(p => p.sku), defaultPrefix)
  const format = products.length > 0
    ? analysis.format
    : { type: 'prefixed' as const, prefix: defaultPrefix, pad: 5 }
  await redis.set(fmtKey, serializeSkuFormat(format))
  return format
}

function formatBarcode(prefix: string, seq: number, pad = 5): string {
  return `${prefix}-${String(seq).padStart(pad, '0')}`
}

function formatSkuWithSettings(format: SkuCodeFormat, seq: number, settings: ProductCodeSettings): string {
  const padded = String(seq).padStart(settings.skuPad, '0')
  if (format.type === 'numeric') return padded
  return `${format.prefix}-${padded}`
}

async function resolveNextSkuState(tenantId: string, tenantSlug: string) {
  const settings = await fetchTenantProductCodeSettings(tenantId)
  const synced = await syncProductCodeCounters(tenantId, tenantSlug, settings)
  const format = await loadSkuFormat(tenantId, tenantSlug)
  const nextSeq = synced.skuSeq + 1
  return { format, nextSeq, settings, barcodeSeq: synced.barcodeSeq + 1 }
}

export async function peekProductCodes(tenantId: string, tenantSlug: string): Promise<{ sku: string; barcode: string; prefix: string }> {
  const { format, nextSeq, settings, barcodeSeq } = await resolveNextSkuState(tenantId, tenantSlug)
  const bcPrefix = `${tenantProductPrefix(tenantSlug)}-BC`
  return {
    sku: formatSkuWithSettings(format, nextSeq, settings),
    barcode: formatBarcode(bcPrefix, barcodeSeq),
    prefix: tenantProductPrefix(tenantSlug),
  }
}

export async function generateProductSku(tenantId: string, tenantSlug: string): Promise<string> {
  const settings = await fetchTenantProductCodeSettings(tenantId)
  await syncProductCodeCounters(tenantId, tenantSlug, settings)
  const format = await loadSkuFormat(tenantId, tenantSlug)
  const next = await redis.incr(skuSeqRedisKey(tenantId))
  return formatSkuWithSettings(format, next, settings)
}

export async function generateProductBarcode(tenantId: string, tenantSlug: string): Promise<string> {
  const settings = await fetchTenantProductCodeSettings(tenantId)
  await syncProductCodeCounters(tenantId, tenantSlug, settings)
  const prefix = `${tenantProductPrefix(tenantSlug)}-BC`
  const next = await redis.incr(barcodeSeqRedisKey(tenantId))
  return formatBarcode(prefix, next)
}
