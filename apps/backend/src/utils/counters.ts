import { prisma } from '../config/database'
import { redis } from '../config/redis'

function nextSeq(last: string | undefined, prefix: string): string {
  let seq = 1
  if (last) {
    const tail = last.slice(prefix.length + 1) // strip "PREFIX-"
    const n = parseInt(tail, 10)
    if (!isNaN(n)) seq = n + 1
  }
  return `${prefix}-${String(seq).padStart(4, '0')}`
}

export async function generateInvoiceNumber(tenantId: string): Promise<string> {
  const key = `inv_seq:${tenantId}`
  // Seed Redis counter from DB on first use (SET NX = only if key absent)
  const seeded = await redis.set(key, '0', 'NX')
  if (seeded === 'OK') {
    // Key was just created — initialize from existing sale count / max number
    const all = await prisma.sale.findMany({ where: { tenantId }, select: { invoiceNumber: true } })
    let max = all.length
    for (const s of all) {
      const m = s.invoiceNumber?.match(/(\d+)$/)
      if (m) max = Math.max(max, parseInt(m[1], 10))
    }
    await redis.set(key, String(max))
  }
  // Atomic increment — no race condition regardless of concurrency
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

async function seedProductCodeSeq(
  tenantId: string,
  redisKey: string,
  prefix: string,
  field: 'sku' | 'barcode',
): Promise<void> {
  const seeded = await redis.set(redisKey, '0', 'NX')
  if (seeded !== 'OK') return

  const products = await prisma.product.findMany({
    where: { tenantId },
    select: { sku: true, barcode: true },
  })
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`^${escaped}-(\\d+)$`)
  let max = 0
  for (const p of products) {
    const val = field === 'sku' ? p.sku : p.barcode
    const m = val?.match(pattern)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  await redis.set(redisKey, String(max))
}

export async function generateProductSku(tenantId: string, tenantSlug: string): Promise<string> {
  const prefix = `${tenantProductPrefix(tenantSlug)}-SKU`
  const key = `product_sku_seq:${tenantId}`
  await seedProductCodeSeq(tenantId, key, prefix, 'sku')
  const next = await redis.incr(key)
  return `${prefix}-${String(next).padStart(5, '0')}`
}

export async function generateProductBarcode(tenantId: string, tenantSlug: string): Promise<string> {
  const prefix = `${tenantProductPrefix(tenantSlug)}-BC`
  const key = `product_bc_seq:${tenantId}`
  await seedProductCodeSeq(tenantId, key, prefix, 'barcode')
  const next = await redis.incr(key)
  return `${prefix}-${String(next).padStart(5, '0')}`
}
