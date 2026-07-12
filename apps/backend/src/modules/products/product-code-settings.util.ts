import { prisma } from '../../config/database'
import { redis } from '../../config/redis'
import { analyzeProductSkus, serializeSkuFormat, type SkuCodeFormat } from '../../utils/product-sku-seq'

export interface ProductCodeSettings {
  skuStartNumber: number
  barcodeStartNumber: number
  skuPad: number
}

export const DEFAULT_PRODUCT_CODE_SETTINGS: ProductCodeSettings = {
  skuStartNumber: 1,
  barcodeStartNumber: 1,
  skuPad: 5,
}

function tenantProductPrefix(slug: string): string {
  const s = slug.replace(/[^a-z0-9]/gi, '').toUpperCase()
  if (!s) return 'TNT'
  return s.length <= 6 ? s : s.slice(0, 6)
}

function parsePositiveInt(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.floor(n)
}

export function normalizeProductCodeSettings(raw: unknown): ProductCodeSettings {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    skuStartNumber: parsePositiveInt(src.skuStartNumber, DEFAULT_PRODUCT_CODE_SETTINGS.skuStartNumber),
    barcodeStartNumber: parsePositiveInt(src.barcodeStartNumber, DEFAULT_PRODUCT_CODE_SETTINGS.barcodeStartNumber),
    skuPad: Math.min(12, Math.max(3, parsePositiveInt(src.skuPad, DEFAULT_PRODUCT_CODE_SETTINGS.skuPad))),
  }
}

export async function fetchTenantProductCodeSettings(tenantId: string): Promise<ProductCodeSettings> {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { productCodeSettings: true },
  })
  return normalizeProductCodeSettings(t?.productCodeSettings)
}

function skuSeqRedisKey(tenantId: string) {
  return `product_sku_seq:${tenantId}`
}

function barcodeSeqRedisKey(tenantId: string) {
  return `product_bc_seq:${tenantId}`
}

function skuFormatRedisKey(tenantId: string) {
  return `product_sku_fmt:${tenantId}`
}

function maxSeqFromBarcodeValues(values: string[], prefix: string): number {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`^${escaped}-(\\d+)$`)
  let max = 0
  for (const val of values) {
    const m = val?.match(pattern)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return max
}

export async function syncProductCodeCounters(
  tenantId: string,
  tenantSlug: string,
  settings?: ProductCodeSettings,
): Promise<{ format: SkuCodeFormat; skuSeq: number; barcodeSeq: number }> {
  const cfg = settings ?? await fetchTenantProductCodeSettings(tenantId)
  const defaultPrefix = `${tenantProductPrefix(tenantSlug)}-SKU`
  const barcodePrefix = `${tenantProductPrefix(tenantSlug)}-BC`

  const products = await prisma.product.findMany({
    where: { tenantId },
    select: { sku: true, barcode: true },
  })

  const skuAnalysis = analyzeProductSkus(products.map(p => p.sku), defaultPrefix)
  const barcodeMax = maxSeqFromBarcodeValues(
    products.map(p => p.barcode ?? ''),
    barcodePrefix,
  )

  const skuFloor = Math.max(0, cfg.skuStartNumber - 1)
  const barcodeFloor = Math.max(0, cfg.barcodeStartNumber - 1)
  const skuSynced = Math.max(skuAnalysis.maxSeq, skuFloor)
  const barcodeSynced = Math.max(barcodeMax, barcodeFloor)

  const skuKey = skuSeqRedisKey(tenantId)
  const bcKey = barcodeSeqRedisKey(tenantId)
  const fmtKey = skuFormatRedisKey(tenantId)

  const redisSku = parseInt((await redis.get(skuKey)) ?? '0', 10) || 0
  const redisBc = parseInt((await redis.get(bcKey)) ?? '0', 10) || 0

  const nextSkuSeq = Math.max(redisSku, skuSynced)
  const nextBcSeq = Math.max(redisBc, barcodeSynced)

  await redis.set(skuKey, String(nextSkuSeq))
  await redis.set(bcKey, String(nextBcSeq))

  if (products.length > 0 || !(await redis.get(fmtKey))) {
    await redis.set(fmtKey, serializeSkuFormat(skuAnalysis.format))
  }

  return { format: skuAnalysis.format, skuSeq: nextSkuSeq, barcodeSeq: nextBcSeq }
}

export async function applyProductCodeSettings(
  tenantId: string,
  tenantSlug: string,
  settings: ProductCodeSettings,
): Promise<ProductCodeSettings> {
  await syncProductCodeCounters(tenantId, tenantSlug, settings)
  return settings
}
