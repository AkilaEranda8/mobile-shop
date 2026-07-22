import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { generateWarrantyCode } from '../../utils/counters'
import { parsePosReloadItem } from '../daily-reload/pos-reload.util'

export function buildWarrantyQrUrl(warrantyCode: string): string {
  const base = process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || ''
  const path = `/warranty/verify/${warrantyCode}`
  return base ? `${base.replace(/\/$/, '')}${path}` : path
}

function warrantyMonthsForItem(
  item: { warrantyMonths?: number; productId?: string | null },
  product?: { warrantyMonths: number } | null,
): number {
  const fromItem = Number(item.warrantyMonths ?? 0)
  if (fromItem > 0) return fromItem
  return Number(product?.warrantyMonths ?? 0)
}

async function assertNoActiveWarrantyForImei(
  tx: Prisma.TransactionClient,
  tenantId: string,
  imei: string,
) {
  const existing = await tx.warranty.findFirst({
    where: {
      tenantId,
      imei,
      status: { in: ['ACTIVE', 'CLAIMED'] },
    },
  })
  if (existing) {
    throw new AppError(
      `IMEI ${imei} already has an active warranty (${existing.warrantyCode})`,
      400,
    )
  }
}

async function uniqueWarrantyCode(tx: Prisma.TransactionClient): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = generateWarrantyCode()
    const exists = await tx.warranty.findUnique({ where: { warrantyCode: code }, select: { id: true } })
    if (!exists) return code
  }
  throw new AppError('Could not generate unique warranty code', 500)
}

export async function createWarrantiesFromSaleItems(
  tx: Prisma.TransactionClient,
  opts: {
    tenantId: string
    saleId: string
    invoiceNumber: string
    customerId?: string | null
    customerName: string
    customerPhone?: string
    items: Array<{
      productId?: string | null
      productName: string
      sku?: string
      imei?: string
      quantity?: number
      warrantyMonths?: number
      reloadProvider?: string
      reloadType?: string
    }>
  },
) {
  const feat = await tx.tenantFeature.findFirst({
    where: { tenantId: opts.tenantId, feature: 'WARRANTY', enabled: true },
  })
  if (!feat) return []

  const sale = await tx.sale.findFirst({
    where: { id: opts.saleId, tenantId: opts.tenantId },
    select: { branchId: true },
  })
  if (!sale) throw new AppError('Sale not found for warranty creation', 404)

  const eligible: Array<{
    productId: string
    productName: string
    brandName: string
    imei?: string
    months: number
    quantity: number
  }> = []

  for (const item of opts.items) {
    if (parsePosReloadItem(item)) continue
    if (!item.productId) continue

    const product = await tx.product.findUnique({
      where: { id: item.productId },
      select: { id: true, name: true, warrantyMonths: true, trackImei: true, brand: { select: { name: true } } },
    })
    if (!product) continue

    const months = warrantyMonthsForItem(item, product)
    if (months <= 0) continue

    const imei = item.imei?.trim() || undefined
    const qty = Math.max(1, Number(item.quantity ?? 1))
    const brandName = product.brand?.name ?? ''

    if (product.trackImei && !imei) {
      throw new AppError(`IMEI required for warranty product "${product.name}"`, 400)
    }

    // IMEI-tracked items need one unit per line (unique serial → one warranty).
    if (product.trackImei && qty > 1) {
      throw new AppError(`Warranty product "${product.name}" must be sold one unit per line`, 400)
    }

    // One warranty covers the full line quantity (accessories / non-IMEI).
    eligible.push({
      productId: product.id,
      productName: item.productName || product.name,
      brandName,
      imei,
      months,
      quantity: qty,
    })
  }

  if (eligible.length === 0) return []

  if (!opts.customerId) {
    throw new AppError('Customer is required when selling warranty-eligible products', 400)
  }

  return createWarrantyRows(tx, {
    tenantId: opts.tenantId,
    branchId: sale.branchId,
    saleId: opts.saleId,
    invoiceNumber: opts.invoiceNumber,
    customerId: opts.customerId,
    customerName: opts.customerName,
    customerPhone: opts.customerPhone,
    rows: eligible,
    checkImeiConflict: true,
  })
}

async function createWarrantyRows(
  tx: Prisma.TransactionClient,
  opts: {
    tenantId: string
    branchId?: string | null
    saleId: string
    invoiceNumber: string
    customerId: string
    customerName: string
    customerPhone?: string
    rows: Array<{
      productId?: string | null
      productName: string
      brandName: string
      imei?: string
      months: number
      quantity?: number
    }>
    checkImeiConflict?: boolean
  },
) {
  const created = []
  const start = new Date()

  for (const row of opts.rows) {
    if (opts.checkImeiConflict && row.imei) {
      await assertNoActiveWarrantyForImei(tx, opts.tenantId, row.imei)
    }

    const end = new Date(start)
    end.setMonth(end.getMonth() + row.months)
    const warrantyCode = await uniqueWarrantyCode(tx)
    const quantity = Math.max(1, Number(row.quantity ?? 1))

    const w = await tx.warranty.create({
      data: {
        tenantId: opts.tenantId,
        branchId: opts.branchId ?? undefined,
        warrantyCode,
        saleId: opts.saleId,
        invoiceNumber: opts.invoiceNumber,
        customerId: opts.customerId,
        customerName: opts.customerName,
        customerPhone: opts.customerPhone ?? '',
        productId: row.productId ?? undefined,
        productName: row.productName,
        brandName: row.brandName,
        imei: row.imei,
        quantity,
        startDate: start,
        endDate: end,
        monthsDuration: row.months,
        status: 'ACTIVE',
        qrUrl: buildWarrantyQrUrl(warrantyCode),
      },
    })
    created.push(w)
  }

  return created
}

/** Register one combined repair warranty in Warranty Management on payment. */
export async function createWarrantiesFromRepair(
  tx: Prisma.TransactionClient,
  opts: {
    tenantId: string
    branchId?: string | null
    saleId: string
    invoiceNumber: string
    ticketNumber: string
    customerId?: string | null
    customerName: string
    customerPhone?: string
    deviceBrand: string
    deviceModel: string
    imei?: string | null
    serviceWarrantyMonths: number
    spareParts: Array<{
      productId: string
      productName: string
      quantity: number
      warrantyMonths?: number
      warrantyNote?: string | null
    }>
  },
) {
  const feat = await tx.tenantFeature.findFirst({
    where: { tenantId: opts.tenantId, feature: 'WARRANTY', enabled: true },
  })
  if (!feat) return []

  const serviceMonths = Math.max(0, Number(opts.serviceWarrantyMonths) || 0)
  const partLines: string[] = []
  let maxPartMonths = 0

  for (const part of opts.spareParts) {
    const months = Math.max(0, Number(part.warrantyMonths) || 0)
    if (months > maxPartMonths) maxPartMonths = months
    const qty = Math.max(1, Number(part.quantity) || 1)
    const note = part.warrantyNote?.trim()
    if (months > 0) {
      partLines.push(`${part.productName} x${qty} (${months} mo${note ? ` — ${note}` : ''})`)
    } else if (note) {
      partLines.push(`${part.productName} x${qty} (${note})`)
    }
  }

  const monthsDuration = Math.max(serviceMonths, maxPartMonths)
  if (monthsDuration <= 0) return []

  if (!opts.customerId) {
    throw new AppError('Customer is required to register repair warranty', 400)
  }

  const deviceLabel = `${opts.deviceBrand} ${opts.deviceModel}`.trim()
  const summaryParts = [
    `Ticket ${opts.ticketNumber}`,
    serviceMonths > 0 ? `Service: ${serviceMonths} mo` : null,
    partLines.length > 0 ? `Parts: ${partLines.join(', ')}` : null,
  ].filter(Boolean)

  const productName = `Repair – ${deviceLabel} | ${summaryParts.join(' | ')}`

  return createWarrantyRows(tx, {
    tenantId: opts.tenantId,
    branchId: opts.branchId,
    saleId: opts.saleId,
    invoiceNumber: opts.invoiceNumber,
    customerId: opts.customerId,
    customerName: opts.customerName,
    customerPhone: opts.customerPhone,
    rows: [{
      productId: null,
      productName,
      brandName: opts.deviceBrand || 'Repair',
      imei: opts.imei?.trim() || undefined,
      months: monthsDuration,
    }],
    checkImeiConflict: false,
  })
}

export async function voidWarrantiesForSaleReturn(
  tx: Prisma.TransactionClient,
  tenantId: string,
  saleId: string,
  imeis: string[],
) {
  const imeiFilter = imeis.filter(Boolean)
  await tx.warranty.updateMany({
    where: {
      tenantId,
      saleId,
      status: { in: ['ACTIVE', 'CLAIMED'] },
      ...(imeiFilter.length > 0 ? { imei: { in: imeiFilter } } : {}),
    },
    data: { status: 'VOID' },
  })
}

export async function verifyWarrantyByCode(code: string) {
  const w = await prisma.warranty.findUnique({
    where: { warrantyCode: code.trim().toUpperCase() },
    include: {
      claims: { orderBy: { createdAt: 'desc' }, take: 5 },
      tenant: { select: { name: true, slug: true } },
    },
  })
  if (!w) throw new AppError('Warranty not found', 404)

  if (w.status === 'ACTIVE' && w.endDate < new Date()) {
    await prisma.warranty.update({
      where: { id: w.id },
      data: { status: 'EXPIRED' },
    }).catch(() => {})
    w.status = 'EXPIRED'
  }

  return {
    warrantyCode: w.warrantyCode,
    status: w.status,
    productName: w.productName,
    brandName: w.brandName,
    imei: w.imei,
    customerName: w.customerName,
    startDate: w.startDate,
    endDate: w.endDate,
    monthsDuration: w.monthsDuration,
    invoiceNumber: w.invoiceNumber,
    shopName: w.tenant.name,
    claims: w.claims.map(c => ({
      id: c.id,
      issue: c.issue,
      claimType: c.claimType,
      status: c.status,
      createdAt: c.createdAt,
    })),
  }
}

export async function createClaim(
  tenantId: string,
  warrantyId: string,
  body: { issue: string; claimType?: string },
) {
  const w = await prisma.warranty.findFirst({ where: { id: warrantyId, tenantId } })
  if (!w) throw new AppError('Warranty not found', 404)
  if (w.status === 'VOID' || w.status === 'EXPIRED') {
    throw new AppError('Cannot file claim on void or expired warranty', 400)
  }

  const claimType = body.claimType === 'SOFTWARE' ? 'SOFTWARE' : 'HARDWARE'

  const claim = await prisma.$transaction(async tx => {
    const created = await tx.warrantyClaim.create({
      data: {
        warrantyId: w.id,
        issue: body.issue,
        claimType,
      },
    })
    if (w.status === 'ACTIVE') {
      await tx.warranty.update({ where: { id: w.id }, data: { status: 'CLAIMED' } })
    }
    if (w.imei) {
      await tx.imeiRecord.updateMany({
        where: { imei: w.imei },
        data: { status: 'UNDER_WARRANTY_CLAIM' },
      })
    }
    return created
  })

  return claim
}

export async function linkRepairToClaim(
  tenantId: string,
  warrantyClaimId: string,
  repairTicketId: string,
) {
  const claim = await prisma.warrantyClaim.findFirst({
    where: { id: warrantyClaimId, warranty: { tenantId } },
  })
  if (!claim) throw new AppError('Warranty claim not found', 404)
  return prisma.warrantyClaim.update({
    where: { id: warrantyClaimId },
    data: { repairTicketId, status: 'IN_REPAIR' },
  })
}
