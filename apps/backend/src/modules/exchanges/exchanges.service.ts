import { prisma } from '../../config/database'
import { Prisma } from '@prisma/client'
import { AppError } from '../../middleware/error.middleware'
import { getPagination } from '../../utils/pagination'
import { generateInvoiceNumber } from '../../utils/counters'
import { Request } from 'express'
import { createWarrantiesFromSaleItems } from '../warranty/warranty.service'
import { assertBusinessDayOpenIfEnabled } from '../daily-closing/day-lock.util'
import type { CompleteExchangeInput } from './exchanges.schema'

function resolveItemSku(
  product: { sku: string; storageVariations?: unknown },
  variation?: string | null,
): string {
  if (!variation || !product.storageVariations) return product.sku
  const vars = product.storageVariations as any[]
  if (!Array.isArray(vars)) return product.sku
  const match = vars.find(v => v.sku === variation || `${v.storage}::${v.colorName}` === variation)
  return match?.sku ?? product.sku
}

async function syncImeiTrackedStock(
  tx: Prisma.TransactionClient,
  productId: string,
): Promise<void> {
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: { trackImei: true },
  })
  if (!product?.trackImei) return
  const imeiCount = await tx.imeiRecord.count({
    where: { productId, status: 'IN_STOCK' },
  })
  await tx.product.update({
    where: { id: productId },
    data:  { stock: imeiCount },
  })
}

async function validateTradeInImei(
  tenantId: string,
  imei: string,
): Promise<{ existing: Awaited<ReturnType<typeof prisma.imeiRecord.findUnique>> }> {
  const existing = await prisma.imeiRecord.findUnique({ where: { imei } })
  if (!existing) return { existing: null }

  const owner = await prisma.product.findUnique({
    where: { id: existing.productId },
    select: { tenantId: true },
  })
  if (owner?.tenantId !== tenantId) {
    throw new AppError('This IMEI is registered under a different shop', 400)
  }
  if (existing.status === 'IN_STOCK') {
    throw new AppError(`Trade-in IMEI ${imei} is already in your stock`, 400)
  }
  if (['IN_REPAIR', 'UNDER_WARRANTY_CLAIM', 'SCRAPPED'].includes(existing.status)) {
    throw new AppError(`Trade-in IMEI cannot be accepted (status: ${existing.status})`, 400)
  }
  return { existing }
}

async function generateExchangeNumber(tenantId: string): Promise<string> {
  const count = await prisma.deviceExchange.count({ where: { tenantId } })
  return `EX-${String(count + 1).padStart(5, '0')}`
}

function variationLabel(storage?: string | null, color?: string | null): string | undefined {
  if (storage && color) return `${storage}::${color}`
  return undefined
}

function parseVariation(variation?: string | null): { storage?: string; color?: string } {
  if (!variation?.includes('::')) return {}
  const [storage, color] = variation.split('::').map(s => s.trim())
  return {
    storage: storage || undefined,
    color: color || undefined,
  }
}

function resolveVariantDetails(
  product: { storageVariations?: unknown },
  variation?: string | null,
): { storage?: string; color?: string } {
  const v = variation?.trim()
  if (!v) return {}

  const explicit = parseVariation(v)
  if (explicit.storage && explicit.color) return explicit

  const vars = product.storageVariations as any[]
  if (!Array.isArray(vars)) return {}

  const match = vars.find(row => row.sku === v || `${row.storage}::${row.colorName}` === v)
  if (!match) return {}

  return {
    storage: match.storage,
    color: match.colorName,
  }
}

function resolveSellPrice(product: { sellingPrice: number; storageVariations?: unknown }, variation?: string | null): number {
  if (!variation || !product.storageVariations) return product.sellingPrice
  const vars = product.storageVariations as any[]
  if (!Array.isArray(vars)) return product.sellingPrice
  const match = vars.find(v => v.sku === variation || `${v.storage}::${v.colorName}` === variation)
  return match?.sellingPrice ?? product.sellingPrice
}

async function resolveBranchId(tenantId: string, branchId?: string, userId?: string): Promise<string> {
  if (branchId) return branchId
  if (userId) {
    const ub = await prisma.userBranch.findFirst({ where: { userId }, select: { branchId: true } })
    if (ub?.branchId) return ub.branchId
  }
  const branch = await prisma.branch.findFirst({
    where: { tenantId },
    orderBy: [{ isHeadquarters: 'desc' }, { createdAt: 'asc' }],
    select: { id: true },
  })
  if (!branch) throw new AppError('No branch configured for this shop', 400)
  return branch.id
}

async function resolveCustomer(
  tx: Prisma.TransactionClient,
  tenantId: string,
  input: CompleteExchangeInput,
): Promise<string | undefined> {
  if (input.customerId) {
    await tx.customer.update({
      where: { id: input.customerId },
      data: {
        name:    input.customerName,
        phone:   input.customerPhone,
        address: input.customerAddress ?? undefined,
      },
    }).catch(() => {})
    return input.customerId
  }
  let customer = await tx.customer.findFirst({ where: { tenantId, phone: input.customerPhone } })
  if (!customer) {
    customer = await tx.customer.create({
      data: {
        tenantId,
        name:    input.customerName,
        phone:   input.customerPhone,
        address: input.customerAddress,
      },
    })
  } else if (input.customerAddress) {
    customer = await tx.customer.update({
      where: { id: customer.id },
      data:  { name: input.customerName, address: input.customerAddress },
    })
  }
  return customer.id
}

async function ensureTradeInProduct(
  tx: Prisma.TransactionClient,
  tenantId: string,
  branchId: string,
  input: CompleteExchangeInput,
) {
  if (input.oldProductId) {
    const existing = await tx.product.findFirst({ where: { id: input.oldProductId, tenantId } })
    if (!existing) throw new AppError('Trade-in product not found', 404)
    return existing
  }

  const name = input.oldProductName?.trim() || `${input.oldBrand} ${input.oldModel}`.trim()
  const sku  = `EXCH-${input.oldImei.slice(-8)}`

  const dupSku = await tx.product.findFirst({ where: { tenantId, sku } })
  if (dupSku) {
    return tx.product.update({
      where: { id: dupSku.id },
      data:  {
        trackImei:   true,
        condition:   'USED',
        buyingPrice: input.buyPrice,
      },
    })
  }

  let category = await tx.category.findFirst({
    where: { tenantId, name: { in: ['Mobile Phones', 'Used Phones', 'Phones'] } },
    orderBy: { createdAt: 'asc' },
  })
  if (!category) {
    category = await tx.category.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' } })
  }
  if (!category) {
    category = await tx.category.create({
      data: { tenantId, name: 'Used Phones', slug: 'used-phones' },
    })
  }

  let brand = await tx.brand.findFirst({ where: { tenantId, name: input.oldBrand } })
  if (!brand) {
    brand = await tx.brand.create({ data: { tenantId, name: input.oldBrand } })
  }

  const storageVariations = input.oldStorage && input.oldColor
    ? [{
        storage:       input.oldStorage,
        colorName:     input.oldColor,
        colorHex:      '#6b7280',
        sellingPrice:  input.buyPrice * 1.15,
        costPrice:     input.buyPrice,
        stock:         0,
        sku:           `${sku}-${input.oldStorage}-${input.oldColor}`.replace(/\s+/g, '-').slice(0, 40),
      }]
    : undefined

  return tx.product.create({
    data: {
      tenantId,
      branchId,
      name,
      sku,
      categoryId:        category.id,
      brandId:           brand.id,
      deviceModel:       input.oldModel,
      buyingPrice:       input.buyPrice,
      sellingPrice:      input.buyPrice * 1.15,
      mrp:               input.buyPrice * 1.2,
      trackImei:         true,
      condition:         'USED',
      stock:             0,
      minStock:          0,
      storageVariations: storageVariations as any,
    },
  })
}

function bumpVariantStock(
  variations: any[] | null | undefined,
  storage?: string | null,
  color?: string | null,
  buyPrice?: number,
): { variations: any[]; changed: boolean } {
  if (!storage || !color) return { variations: variations ?? [], changed: false }
  const list = Array.isArray(variations) ? [...variations] : []
  const idx  = list.findIndex(v => v.storage === storage && v.colorName === color)
  if (idx >= 0) {
    list[idx] = { ...list[idx], stock: (list[idx].stock || 0) + 1 }
    return { variations: list, changed: true }
  }
  list.push({
    storage,
    colorName:    color,
    colorHex:     '#6b7280',
    sellingPrice: (buyPrice ?? 0) * 1.15,
    costPrice:    buyPrice ?? 0,
    stock:        1,
    sku:          `VAR-${Date.now().toString(36)}`,
  })
  return { variations: list, changed: true }
}

export const exchangesService = {
  async list(tenantId: string, req: Request) {
    const { skip, limit, page, search } = getPagination(req)
    const customerId = req.query.customerId as string | undefined
    const where: any = {
      tenantId,
      ...(customerId && { customerId }),
      ...(search && {
        OR: [
          { exchangeNumber: { contains: search, mode: 'insensitive' } },
          { customerName:   { contains: search, mode: 'insensitive' } },
          { customerPhone:  { contains: search } },
          { oldBrand:       { contains: search, mode: 'insensitive' } },
          { oldModel:       { contains: search, mode: 'insensitive' } },
          { invoiceNumber:  { contains: search, mode: 'insensitive' } },
        ],
      }),
    }
    const [data, total] = await Promise.all([
      prisma.deviceExchange.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.deviceExchange.count({ where }),
    ])
    return { data, total, page, limit }
  },

  async getById(tenantId: string, id: string) {
    const e = await prisma.deviceExchange.findFirst({ where: { id, tenantId } })
    if (!e) throw new AppError('Exchange record not found', 404)
    let sale = null
    if (e.saleId) {
      sale = await prisma.sale.findFirst({
        where: { id: e.saleId, tenantId },
        include: { items: true, payments: true },
      })
    }
    return { ...e, sale }
  },

  async listAvailableStock(tenantId: string, opts?: { search?: string; excludeImei?: string; branchId?: string }) {
    const { search, excludeImei, branchId } = opts ?? {}
    const records = await prisma.imeiRecord.findMany({
      where: {
        status: 'IN_STOCK',
        ...(branchId && { branchId }),
        ...(excludeImei && { imei: { not: excludeImei } }),
        product: { tenantId, isActive: true, trackImei: true },
        ...(search ? {
          OR: [
            { imei: { contains: search } },
            { product: { is: { name: { contains: search, mode: 'insensitive' } } } },
            { product: { is: { deviceModel: { contains: search, mode: 'insensitive' } } } },
          ],
        } : {}),
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            sellingPrice: true,
            buyingPrice: true,
            storageVariations: true,
            deviceModel: true,
            warrantyMonths: true,
            brand: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 150,
    })

    return records.map(r => {
      const parsed = resolveVariantDetails(r.product, r.variation)
      return {
        imeiRecordId: r.id,
        imei:         r.imei,
        productId:    r.productId,
        productName:  r.product.name,
        brand:        r.product.brand?.name ?? '',
        model:        r.product.deviceModel ?? '',
        variation:    r.variation,
        storage:      parsed.storage,
        color:        parsed.color,
        sellPrice:    resolveSellPrice(r.product, r.variation),
        warrantyMonths: r.product.warrantyMonths,
      }
    })
  },

  async completeExchange(
    tenantId: string,
    userId: string,
    cashierName: string,
    input: CompleteExchangeInput,
  ) {
    const branchId = await resolveBranchId(tenantId, input.branchId, userId)
    await assertBusinessDayOpenIfEnabled(tenantId, branchId)
    const buyPrice  = input.buyPrice
    const exchangeNumber = await generateExchangeNumber(tenantId)
    const invoiceNumber  = await generateInvoiceNumber(tenantId)

    if (input.oldImei === input.soldImei) {
      throw new AppError('Trade-in IMEI and sold phone IMEI cannot be the same', 400)
    }

    const { existing: existingImei } = await validateTradeInImei(tenantId, input.oldImei)

    const soldImeiRecord = await prisma.imeiRecord.findUnique({
      where: { imei: input.soldImei },
      include: { product: { select: { id: true, tenantId: true, name: true, sku: true, sellingPrice: true, storageVariations: true, warrantyMonths: true, trackImei: true, brand: { select: { name: true } }, deviceModel: true } } },
    })
    if (!soldImeiRecord || soldImeiRecord.product.tenantId !== tenantId) {
      throw new AppError('Selected phone IMEI not found in your inventory', 404)
    }
    if (!soldImeiRecord.product.trackImei) {
      throw new AppError('Selected product is not IMEI-tracked — exchange requires a phone with IMEI', 400)
    }
    if (soldImeiRecord.productId !== input.soldProductId) {
      throw new AppError('IMEI does not belong to the selected product', 400)
    }
    if (soldImeiRecord.status !== 'IN_STOCK') {
      throw new AppError(`Selected phone is not available (status: ${soldImeiRecord.status})`, 400)
    }

    if (soldImeiRecord.branchId !== branchId) {
      throw new AppError('Selected phone is registered at a different branch', 400)
    }

    const sellPrice = input.soldSellPrice ?? resolveSellPrice(soldImeiRecord.product, soldImeiRecord.variation ?? input.soldVariation)
    const soldItemSku = resolveItemSku(soldImeiRecord.product, soldImeiRecord.variation ?? input.soldVariation)
    const balance   = sellPrice - buyPrice
    const balanceDirection = balance >= 0 ? 'CUSTOMER_PAYS' : 'SHOP_REFUNDS'
    const paidAmount = input.paidAmount ?? balance

    const soldParsed = resolveVariantDetails(
      soldImeiRecord.product,
      soldImeiRecord.variation ?? input.soldVariation,
    )
    const tradeInVariation = variationLabel(input.oldStorage, input.oldColor)

    const result = await prisma.$transaction(async (tx) => {
      const customerId = await resolveCustomer(tx, tenantId, input)

      const tradeInProduct = await ensureTradeInProduct(tx, tenantId, branchId, input)

      const { variations, changed } = bumpVariantStock(
        tradeInProduct.storageVariations as any[],
        input.oldStorage,
        input.oldColor,
        buyPrice,
      )

      await tx.product.update({
        where: { id: tradeInProduct.id },
        data: {
          stock: { increment: 1 },
          buyingPrice: buyPrice,
          ...(changed ? { storageVariations: variations } : {}),
        },
      })

      const tradeInImei = existingImei
        ? await tx.imeiRecord.update({
            where: { imei: input.oldImei },
            data: {
              productId: tradeInProduct.id,
              branchId,
              status:    'IN_STOCK',
              variation: tradeInVariation,
              customerId: null,
              saleId:     null,
            },
          })
        : await tx.imeiRecord.create({
            data: {
              imei:      input.oldImei,
              productId: tradeInProduct.id,
              branchId,
              status:    'IN_STOCK',
              variation: tradeInVariation,
            },
          })

      await syncImeiTrackedStock(tx, tradeInProduct.id)

      await tx.stockMovement.create({
        data: {
          productId:   tradeInProduct.id,
          branchId,
          type:        'EXCHANGE_IN',
          quantity:    1,
          reference:   exchangeNumber,
          note:        `Exchange trade-in purchase — ${input.oldBrand} ${input.oldModel}`,
          performedBy: cashierName,
        },
      })

      const sale = await tx.sale.create({
        data: {
          tenantId,
          branchId,
          invoiceNumber,
          customerId,
          customerName:  input.customerName,
          customerPhone: input.customerPhone,
          subtotal:      sellPrice,
          discount:      buyPrice,
          tax:           0,
          total:         balance,
          paidAmount,
          dueAmount:     0,
          status:        'PAID',
          cashierId:     userId,
          cashierName,
          source:        'EXCHANGE',
          notes:         [
            `Exchange ${exchangeNumber}`,
            `Trade-in: ${input.oldBrand} ${input.oldModel} (IMEI ${input.oldImei}) — LKR ${buyPrice.toLocaleString()}`,
            (soldParsed.storage || soldParsed.color)
              ? `Sold variant: ${soldParsed.storage ?? ''} / ${soldParsed.color ?? ''}`
              : null,
            input.notes,
          ].filter(Boolean).join('\n'),
          items: {
            create: [{
              productId:      soldImeiRecord.productId,
              productName:    soldImeiRecord.product.name,
              sku:            soldItemSku,
              imei:           input.soldImei,
              quantity:       1,
              unitPrice:      sellPrice,
              discount:       buyPrice,
              total:          balance,
              warrantyMonths: soldImeiRecord.product.warrantyMonths,
            }],
          },
          payments: {
            create: [{
              method: input.paymentMethod ?? 'CASH',
              amount: paidAmount,
            }],
          },
        },
        include: { items: true, payments: true },
      })

      await tx.imeiRecord.update({
        where: { imei: input.soldImei },
        data:  { status: 'SOLD', customerId, saleId: sale.id },
      })

      const soldProduct = await tx.product.findUnique({
        where: { id: soldImeiRecord.productId },
        select: { storageVariations: true },
      })
      if (soldProduct?.storageVariations) {
        let updatedVariations = soldProduct.storageVariations as any[]
        if (Array.isArray(updatedVariations)) {
          let changedSold = false
          updatedVariations = updatedVariations.map((v: any) => {
            const matchSku = soldImeiRecord.variation && v.sku === soldImeiRecord.variation
            const matchProps = soldImeiRecord.variation &&
              `${v.storage}::${v.colorName}` === soldImeiRecord.variation
            if (matchSku || matchProps) {
              changedSold = true
              return { ...v, stock: Math.max(0, (v.stock || 0) - 1) }
            }
            return v
          })
          if (changedSold) {
            await tx.product.update({
              where: { id: soldImeiRecord.productId },
              data: { storageVariations: updatedVariations },
            })
          }
        }
      }

      await syncImeiTrackedStock(tx, soldImeiRecord.productId)

      await tx.stockMovement.create({
        data: {
          productId:   soldImeiRecord.productId,
          branchId,
          type:        'SALE',
          quantity:    -1,
          reference:   invoiceNumber,
          note:        `Exchange sale — ${exchangeNumber}`,
          performedBy: cashierName,
        },
      })

      if (customerId) {
        await tx.customer.update({
          where: { id: customerId },
          data:  { totalPurchases: { increment: 1 } },
        })
      }

      const exchange = await tx.deviceExchange.create({
        data: {
          tenantId,
          branchId,
          exchangeNumber,
          customerId,
          customerName:          input.customerName,
          customerPhone:         input.customerPhone,
          customerAddress:       input.customerAddress,
          oldProductName:        input.oldProductName ?? tradeInProduct.name,
          oldBrand:              input.oldBrand,
          oldModel:              input.oldModel,
          oldImei:               input.oldImei,
          oldColor:              input.oldColor,
          oldStorage:            input.oldStorage,
          oldCondition:          input.oldCondition ?? 'GOOD',
          exchangeValue:         buyPrice,
          oldProductId:          tradeInProduct.id,
          tradeInImeiRecordId:   tradeInImei.id,
          newBrand:              soldImeiRecord.product.brand?.name,
          newModel:              soldImeiRecord.product.deviceModel ?? soldImeiRecord.product.name,
          newImei:               input.soldImei,
          newColor:              soldParsed.color,
          newStorage:            soldParsed.storage,
          newDevicePrice:        sellPrice,
          soldProductId:         soldImeiRecord.productId,
          soldVariation:         soldImeiRecord.variation ?? input.soldVariation,
          balanceAmount:         Math.abs(balance),
          balanceDirection,
          invoiceNumber,
          saleId:                sale.id,
          notes:                 input.notes,
          status:                'COMPLETED',
          createdBy:             userId,
        },
      })

      const warranties = await createWarrantiesFromSaleItems(tx, {
        tenantId,
        saleId: sale.id,
        invoiceNumber,
        customerId,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        items: [{
          productId:      soldImeiRecord.productId,
          productName:    soldImeiRecord.product.name,
          sku:            soldItemSku,
          imei:           input.soldImei,
          quantity:       1,
          warrantyMonths: soldImeiRecord.product.warrantyMonths,
        }],
      })

      return { exchange, sale, warranties, balance, balanceDirection }
    })

    try {
      if (paidAmount !== 0) {
        await prisma.transaction.create({
          data: {
            tenantId,
            branchId,
            type:        paidAmount >= 0 ? 'INCOME' : 'EXPENSE',
            category:    paidAmount >= 0 ? 'Sales' : 'Exchange Refund',
            amount:      Math.abs(paidAmount),
            description: paidAmount >= 0
              ? `Exchange sale - ${invoiceNumber} (${exchangeNumber})`
              : `Exchange refund - ${invoiceNumber} (${exchangeNumber})`,
            paymentMethod: input.paymentMethod ?? 'CASH',
            reference:     invoiceNumber,
            performedBy:   cashierName,
          },
        })
      }
    } catch { /* non-blocking */ }

    return result
  },

  async create(tenantId: string, body: any, userId: string) {
    if (!body.branchId) {
      const branch = await prisma.branch.findFirst({ where: { tenantId } })
      if (!branch) throw new AppError('No branch found', 400)
      body.branchId = branch.id
    }

    if (!body.customerId && body.customerPhone) {
      let customer = await prisma.customer.findFirst({ where: { tenantId, phone: body.customerPhone } })
      if (!customer) {
        customer = await prisma.customer.create({
          data: { tenantId, name: body.customerName || 'Unknown', phone: body.customerPhone },
        })
      }
      body.customerId = customer.id
    }

    const exchangeNumber = await generateExchangeNumber(tenantId)
    const exchange = await prisma.deviceExchange.create({
      data: {
        tenantId,
        branchId:      body.branchId,
        exchangeNumber,
        customerId:    body.customerId ?? undefined,
        customerName:  body.customerName,
        customerPhone: body.customerPhone,
        oldBrand:      body.oldBrand,
        oldModel:      body.oldModel,
        oldImei:       body.oldImei ?? undefined,
        oldCondition:  body.oldCondition ?? 'GOOD',
        exchangeValue: Number(body.exchangeValue ?? 0),
        newBrand:      body.newBrand ?? undefined,
        newModel:      body.newModel ?? undefined,
        newImei:       body.newImei ?? undefined,
        newDevicePrice: body.newDevicePrice ? Number(body.newDevicePrice) : undefined,
        saleId:        body.saleId ?? undefined,
        notes:         body.notes ?? undefined,
        status:        body.status ?? 'COMPLETED',
        createdBy:     userId,
      },
    })
    return exchange
  },

  async update(tenantId: string, id: string, body: any) {
    const e = await prisma.deviceExchange.findFirst({ where: { id, tenantId } })
    if (!e) throw new AppError('Exchange record not found', 404)
    return prisma.deviceExchange.update({ where: { id }, data: body })
  },

  async remove(tenantId: string, id: string) {
    const e = await prisma.deviceExchange.findFirst({ where: { id, tenantId } })
    if (!e) throw new AppError('Exchange record not found', 404)
    if (e.saleId || e.tradeInImeiRecordId) {
      throw new AppError('Completed exchanges cannot be deleted — use sales return or stock adjustment instead', 400)
    }
    await prisma.deviceExchange.delete({ where: { id } })
    return { success: true }
  },
}
