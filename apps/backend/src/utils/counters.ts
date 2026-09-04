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

async function nextWholesaleSeq(
  tenantId: string,
  redisKey: string,
  prefix: string,
  seedMax: () => Promise<number>,
): Promise<string> {
  const key = `${redisKey}:${tenantId}`
  const seeded = await redis.set(key, '0', 'NX')
  if (seeded === 'OK') {
    await redis.set(key, String(await seedMax()))
  }
  const next = await redis.incr(key)
  const ym = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}`
  return `${prefix}-${ym}-${String(next).padStart(5, '0')}`
}

function maxTrailingDigits(values: Array<string | null | undefined>): number {
  let max = 0
  for (const v of values) {
    const m = v?.match(/(\d+)$/)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return max
}

/** Wholesale B2B invoice numbers (separate sequence from retail INV-*). */
export async function generateWholesaleInvoiceNumber(tenantId: string): Promise<string> {
  return nextWholesaleSeq(tenantId, 'wsi_seq', 'WSI', async () => {
    const all = await prisma.wholesaleInvoice.findMany({
      where: { tenantId },
      select: { invoiceNumber: true },
    })
    return maxTrailingDigits(all.map((r) => r.invoiceNumber))
  })
}

export async function generateWholesaleQuoteNumber(tenantId: string): Promise<string> {
  return nextWholesaleSeq(tenantId, 'wsq_seq', 'WSQ', async () => {
    const all = await prisma.wholesaleQuotation.findMany({
      where: { tenantId },
      select: { quoteNumber: true },
    })
    return maxTrailingDigits(all.map((r) => r.quoteNumber))
  })
}

export async function generateWholesaleOrderNumber(tenantId: string): Promise<string> {
  return nextWholesaleSeq(tenantId, 'wso_seq', 'WSO', async () => {
    const all = await prisma.wholesaleSalesOrder.findMany({
      where: { tenantId },
      select: { orderNumber: true },
    })
    return maxTrailingDigits(all.map((r) => r.orderNumber))
  })
}

export async function generateWholesalePickNumber(tenantId: string): Promise<string> {
  return nextWholesaleSeq(tenantId, 'wpk_seq', 'WPK', async () => {
    const all = await prisma.wholesalePickList.findMany({
      where: { tenantId },
      select: { pickNumber: true },
    })
    return maxTrailingDigits(all.map((r) => r.pickNumber))
  })
}

export async function generateWholesaleDispatchNumber(tenantId: string): Promise<string> {
  return nextWholesaleSeq(tenantId, 'wds_seq', 'WDS', async () => {
    const all = await prisma.wholesaleDispatch.findMany({
      where: { tenantId },
      select: { dispatchNumber: true },
    })
    return maxTrailingDigits(all.map((r) => r.dispatchNumber))
  })
}

export async function generateWholesaleTripNumber(tenantId: string): Promise<string> {
  return nextWholesaleSeq(tenantId, 'wtr_seq', 'WTR', async () => {
    const all = await prisma.wholesaleDeliveryTrip.findMany({
      where: { tenantId },
      select: { tripNumber: true },
    })
    return maxTrailingDigits(all.map((r) => r.tripNumber))
  })
}

export async function generateWholesaleReturnNumber(tenantId: string): Promise<string> {
  return nextWholesaleSeq(tenantId, 'wrm_seq', 'WRM', async () => {
    const all = await prisma.wholesaleReturn.findMany({
      where: { tenantId },
      select: { returnNumber: true },
    })
    return maxTrailingDigits(all.map((r) => r.returnNumber))
  })
}

export async function generateWholesaleCreditNoteNumber(tenantId: string): Promise<string> {
  return nextWholesaleSeq(tenantId, 'wcn_seq', 'WCN', async () => {
    const all = await prisma.wholesaleCreditNote.findMany({
      where: { tenantId },
      select: { creditNoteNumber: true },
    })
    return maxTrailingDigits(all.map((r) => r.creditNoteNumber))
  })
}

export async function generateDealerPaymentReceiptNumber(tenantId: string): Promise<string> {
  return nextWholesaleSeq(tenantId, 'dpr_seq', 'DPR', async () => {
    const all = await prisma.dealerPayment.findMany({
      where: { tenantId },
      select: { receiptNumber: true },
    })
    return maxTrailingDigits(all.map((r) => r.receiptNumber))
  })
}

export async function generateVanLoadNumber(tenantId: string): Promise<string> {
  return nextWholesaleSeq(tenantId, 'vld_seq', 'VLD', async () => {
    const all = await prisma.vanLoadSheet.findMany({
      where: { tenantId },
      select: { loadNumber: true },
    })
    return maxTrailingDigits(all.map((r) => r.loadNumber))
  })
}

export async function generateVanSettlementNumber(tenantId: string): Promise<string> {
  return nextWholesaleSeq(tenantId, 'vst_seq', 'VST', async () => {
    const all = await prisma.vanSettlement.findMany({
      where: { tenantId },
      select: { settlementNumber: true },
    })
    return maxTrailingDigits(all.map((r) => r.settlementNumber))
  })
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

export async function generatePurchaseReturnNumber(tenantId: string): Promise<string> {
  const today = new Date()
  const prefix = `PR-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
  const last = await prisma.purchaseReturn.findFirst({
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
