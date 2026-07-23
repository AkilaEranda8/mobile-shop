import { prisma } from '../../config/database'
import { Prisma } from '@prisma/client'
import { AppError } from '../../middleware/error.middleware'
import { generateInvoiceNumber } from '../../utils/counters'
import { Request } from 'express'
import { assertBusinessDayOpenIfEnabled } from '../daily-closing/day-lock.util'
import { assertBranchRecordAccess, resolveMutationBranchId } from '../../utils/active-branch'
import { createDailyReloadsFromSaleItems } from '../daily-reload/pos-reload.util'
import { createWarrantiesFromSaleItems } from '../warranty/warranty.service'
import { emitSaleAccounting } from '../accounting/integration/accounting-events.service'
import { hasVariants, sumVariantStock } from '../../utils/product-variants'
import { resolveSaleItemUnitCost } from '../../utils/sale-item-cost.util'
import { applySaleStockEffectsIfEnabled } from '../inventory-engine/inventory-engine.service'
import { applySalePricingIfEnabled } from '../pricing-engine/pricing-engine.service'
import { buildReportFilterContext } from '../report-engine/report-engine.service'
import { saleWhereExcludeNonRevenue } from '../../constants/business-rules.constants'
import { isTenantFeatureEnabled } from '../../utils/tenant-feature.util'
import {
  businessDateFromInstant,
  businessDayNoon,
  normalizeBusinessDate,
} from '../../utils/date-range'

/** Resolve sale timestamp: today keeps wall-clock; past days use Colombo noon. */
async function resolveSaleInstant(
  tenantId: string,
  rawBusinessDate: unknown,
): Promise<{ saleAt: Date; businessDate: string | null }> {
  const raw = typeof rawBusinessDate === 'string' ? rawBusinessDate.trim() : ''
  if (!raw) return { saleAt: new Date(), businessDate: null }

  if (!(await isTenantFeatureEnabled(tenantId, 'POS_BILL_DATE'))) {
    throw new AppError('POS bill date is not enabled for this shop', 403)
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new AppError('Invalid bill date', 400)
  }

  const businessDate = normalizeBusinessDate(raw)
  const today = businessDateFromInstant()
  if (businessDate > today) {
    throw new AppError('Bill date cannot be in the future', 400)
  }

  const saleAt = businessDate === today ? new Date() : businessDayNoon(businessDate)
  return { saleAt, businessDate }
}

export const salesService = {
  async list(tenantId: string, req: Request) {
    const { skip, limit, page, search, branchId } = buildReportFilterContext(req)
    const status = req.query.status as string | undefined
    const customerId = req.query.customerId as string | undefined
    const includeOpening = req.query.includeOpening === '1' || req.query.includeOpening === 'true'
    const where: any = {
      tenantId,
      ...(branchId && { branchId }),
      ...(status && { status }),
      ...(customerId && { customerId }),
      ...(search && { OR: [{ invoiceNumber: { contains: search, mode: 'insensitive' } }, { customerName: { contains: search, mode: 'insensitive' } }, { customerPhone: { contains: search } }] }),
      // Prior credit / opening AR invoices are not real shop sales
      ...(!includeOpening && !customerId ? saleWhereExcludeNonRevenue() : {}),
    }
    const [data, total] = await Promise.all([
      prisma.sale.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { items: true, payments: true, _count: { select: { returns: true } }, returns: { select: { refundAmount: true } } } }),
      prisma.sale.count({ where }),
    ])
    return { data, total, page, limit }
  },

  async getById(tenantId: string, id: string, req: Request) {
    const s = await prisma.sale.findFirst({ where: { id, tenantId }, include: { items: true, payments: true, returns: { include: { items: true } } } })
    if (!s) throw new AppError('Sale not found', 404)
    assertBranchRecordAccess(req, s.branchId)
    const warranties = await prisma.warranty.findMany({
      where: { tenantId, saleId: id },
      select: { warrantyCode: true, productName: true, imei: true, endDate: true, monthsDuration: true },
      orderBy: { createdAt: 'asc' },
    })
    return { ...s, warranties }
  },

  async create(tenantId: string, cashierId: string, cashierName: string, body: any, req: Request) {
    const dueAmount = Number(body.dueAmount ?? 0)
    if (dueAmount > 0 && !body.customerId) {
      throw new AppError('Customer is required when recording credit / partial payment', 400)
    }
    const branchId = await resolveMutationBranchId(req, { preferred: body.branchId })
    const { saleAt } = await resolveSaleInstant(tenantId, body.businessDate)
    await assertBusinessDayOpenIfEnabled(tenantId, branchId, saleAt)
    const invoiceNumber = await generateInvoiceNumber(tenantId)
    let items: any[] = Array.isArray(body.items) ? body.items : []

    const productIds = [...new Set(items.map((i) => i.productId).filter(Boolean))] as string[]
    const productCostMap = new Map<string, {
      buyingPrice: number
      storageVariations: unknown
      sellingPrice: number
      wholesalePrice: number
      creditPrice: number
    }>()
    if (productIds.length) {
      const products = await prisma.product.findMany({
        where: { tenantId, id: { in: productIds } },
        select: {
          id: true,
          buyingPrice: true,
          storageVariations: true,
          sellingPrice: true,
          wholesalePrice: true,
          creditPrice: true,
        },
      })
      for (const p of products) {
        productCostMap.set(p.id, {
          buyingPrice: p.buyingPrice,
          storageVariations: p.storageVariations,
          sellingPrice: p.sellingPrice,
          wholesalePrice: p.wholesalePrice,
          creditPrice: p.creditPrice,
        })
      }
    }

    const priced = await applySalePricingIfEnabled({
      tenantId,
      priceMode: body.priceMode,
      items,
      productsById: productCostMap,
    })
    if (priced) items = priced.items

    for (const item of items) {
      if (!item.productId) continue
      const product = await prisma.product.findFirst({
        where: { id: item.productId, tenantId },
        select: { trackImei: true, name: true },
      })
      if (!product?.trackImei) continue
      const imei = (item.imei ?? '').trim()
      if (!imei) throw new AppError(`IMEI required for "${product.name}"`, 400)
      if (Number(item.quantity) > 1) {
        throw new AppError(`IMEI products must be sold one unit per line: "${product.name}"`, 400)
      }
      const record = await prisma.imeiRecord.findUnique({ where: { imei } })
      if (!record) throw new AppError(`IMEI ${imei} is not registered in the system`, 400)
      if (record.productId !== item.productId) {
        throw new AppError(`IMEI ${imei} belongs to a different product`, 400)
      }
      if (record.status !== 'IN_STOCK') {
        throw new AppError(`IMEI ${imei} is not available for sale (status: ${record.status})`, 400)
      }
    }

    const itemCreates = items.map((item) => {
      const product = item.productId ? productCostMap.get(item.productId) : undefined
      const row: any = {
        productName: item.productName,
        sku:         item.sku ?? '',
        imei:        item.imei ?? undefined,
        quantity:    item.quantity,
        unitPrice:   item.unitPrice,
        unitCost:    item.productId
          ? resolveSaleItemUnitCost(product, { sku: item.sku, variationLabel: item.variationLabel })
          : 0,
        discount:    item.discount ?? 0,
        total:       item.total,
        warrantyMonths: item.warrantyMonths ?? 0,
      }
      if (item.productId) row.product = { connect: { id: item.productId } }
      return row
    })
    const txResult = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const s = await tx.sale.create({
        data: {
          tenantId,
          branchId,
          invoiceNumber,
          customerId: body.customerId,
          customerName: body.customerName,
          customerPhone: body.customerPhone,
          subtotal: body.subtotal,
          discount: body.discount ?? 0,
          tax: body.tax ?? 0,
          total: body.total,
          paidAmount: body.paidAmount,
          dueAmount: body.dueAmount ?? 0,
          status: body.status ?? 'PAID',
          cashierId,
          cashierName,
          notes: body.notes,
          createdAt: saleAt,
          items: { create: itemCreates },
          payments: { create: body.payments },
        },
        include: { items: true, payments: true },
      })
      const stockHandledByEngine = await applySaleStockEffectsIfEnabled({
        tx,
        tenantId,
        branchId,
        saleId: s.id,
        invoiceNumber,
        cashierName,
        customerId: body.customerId,
        items,
      })
      if (!stockHandledByEngine) {
        for (const item of items) {
          if (!item.productId) continue  // service items have no productId — skip stock ops
          const product = await tx.product.findUnique({ where: { id: item.productId }, select: { stock: true, name: true, storageVariations: true } })
          if (!product) continue         // productId present but not found — skip safely

          const variantMode = hasVariants(product.storageVariations)
          const available = variantMode ? sumVariantStock(product.storageVariations) : product.stock
          if (available < item.quantity) {
            throw new AppError(`Insufficient stock for "${product.name}". Available: ${available}, Requested: ${item.quantity}`, 400)
          }

          if (variantMode) {
            let updatedVariations = product.storageVariations as any[]
            let changed = false
            updatedVariations = updatedVariations.map((v: any) => {
              const matchSku = item.sku && v.sku === item.sku
              const matchProps = (item as any).variationLabel &&
                `${v.storage}::${v.colorName}` === (item as any).variationLabel
              if (matchSku || matchProps) {
                changed = true
                return { ...v, stock: Math.max(0, (v.stock || 0) - item.quantity) }
              }
              return v
            })
            if (!changed) {
              throw new AppError(`Insufficient stock for "${product.name}". Variant not found for this sale line`, 400)
            }
            await tx.product.update({
              where: { id: item.productId },
              data: {
                storageVariations: updatedVariations,
                stock: sumVariantStock(updatedVariations),
              },
            })
          } else {
            const dec = await tx.product.updateMany({
              where: { id: item.productId, stock: { gte: item.quantity } },
              data:  { stock: { decrement: item.quantity } },
            })
            if (dec.count === 0) {
              throw new AppError(`Insufficient stock for "${product.name}". Available: ${product.stock}, Requested: ${item.quantity}`, 400)
            }
          }
          await tx.stockMovement.create({ data: { productId: item.productId, branchId, type: 'SALE', quantity: -item.quantity, reference: invoiceNumber, performedBy: cashierName } })
          if (item.imei) {
            const existingImei = await tx.imeiRecord.findUnique({ where: { imei: item.imei } })
            if (existingImei) {
              await tx.imeiRecord.update({ where: { imei: item.imei }, data: { status: 'SOLD', customerId: body.customerId ?? existingImei.customerId, saleId: s.id } })
            } else if (item.productId) {
              await tx.imeiRecord.create({
                data: {
                  imei: item.imei,
                  productId: item.productId,
                  branchId,
                  status: 'SOLD',
                  variation: (item as any).variationLabel ?? undefined,
                  customerId: body.customerId,
                  saleId: s.id,
                },
              })
            }
          }
        }
      }
      if (body.customerId) {
        await tx.customer.update({ where: { id: body.customerId }, data: { totalPurchases: { increment: 1 }, totalDue: { increment: body.dueAmount ?? 0 } } })
      }
      await createDailyReloadsFromSaleItems(tx, {
        tenantId,
        branchId,
        items,
        invoiceNumber,
        cashierName,
      })
      const warranties = await createWarrantiesFromSaleItems(tx, {
        tenantId,
        saleId: s.id,
        invoiceNumber,
        customerId: body.customerId,
        customerName: body.customerName || 'Walk-in Customer',
        customerPhone: body.customerPhone,
        items,
      })
      return { sale: s, warranties }
    })
    const sale = txResult.sale
    const warranties = txResult.warranties
    // ── Auto-create income transaction in Finance (non-blocking) ──
    try {
      const paymentMethod = (body.payments?.[0]?.method ?? 'CASH') as any
      const chequeRefs = (body.payments ?? [])
        .map((p: { method?: string; reference?: string | null }) => String(p.reference ?? '').trim())
        .filter((r: string) => /cheque\s*#/i.test(r))
      const chequeRef = chequeRefs[0] || ''
      // Resolve branchId: use provided or fall back to tenant's first branch
      const incomeAmount = Number(body.paidAmount ?? body.total ?? 0)
      if (incomeAmount > 0) {
        await prisma.transaction.create({
          data: {
            tenantId,
            branchId,
            type:        'INCOME',
            category:    'Sales',
            amount:      incomeAmount,
            description: `Sale - ${invoiceNumber}${body.customerName && body.customerName !== 'Walk-in Customer' ? ` (${body.customerName})` : ''}${chequeRef ? ` — ${chequeRef}` : ''}`,
            paymentMethod,
            reference:   [invoiceNumber, chequeRef].filter(Boolean).join(' | '),
            performedBy: cashierName,
            occurredAt:  saleAt,
            createdAt:   saleAt,
          },
        })
      }
    } catch (e) { console.error('Finance transaction creation failed:', e) }
    void emitSaleAccounting(tenantId, sale.id, branchId)
    return { ...sale, warranties }
  },
}
