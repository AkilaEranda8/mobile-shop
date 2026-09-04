import type { WholesaleSellUnit } from '@prisma/client'
import { prisma } from '../../../config/database'
import { AppError } from '../../../middleware/error.middleware'
import type {
  CreateDealerOverrideInput,
  CreatePriceListInput,
  CreatePriceListItemInput,
  CreateQtyBreakInput,
  CreateTierInput,
  UpdateDealerOverrideInput,
  UpdatePriceListInput,
  UpdatePriceListItemInput,
  UpdateQtyBreakInput,
  UpdateTierInput,
} from './pricing.schema'

function inEffectiveWindow(
  from: Date | null | undefined,
  to: Date | null | undefined,
  at: Date,
): boolean {
  if (from && from > at) return false
  if (to && to < at) return false
  return true
}

function parseOptionalDate(value?: string | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) throw new AppError('Invalid date', 400)
  return d
}

export type ResolveWholesaleUnitPriceInput = {
  tenantId: string
  dealerId: string
  productId: string
  quantity: number
  sellUnit?: WholesaleSellUnit | string
}

export type ResolveWholesaleUnitPriceResult = {
  unitPrice: number
  source: 'DEALER_OVERRIDE' | 'TIER_QTY_BREAK' | 'TIER_LIST' | 'PRODUCT_WHOLESALE'
  floorPrice: number | null
  moq: number | null
  priceListItemId: string | null
  sellUnit: WholesaleSellUnit
}

/**
 * Hierarchy: dealer override → tier list + qty break → product.wholesalePrice.
 * Never falls back to retail sellingPrice — throws if no wholesale price.
 */
export async function resolveWholesaleUnitPrice(
  input: ResolveWholesaleUnitPriceInput,
): Promise<ResolveWholesaleUnitPriceResult> {
  const sellUnit = (input.sellUnit ?? 'PIECE') as WholesaleSellUnit
  const qty = Number(input.quantity)
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new AppError('Quantity must be a positive number', 400)
  }

  const now = new Date()
  const dealer = await prisma.dealer.findFirst({
    where: { id: input.dealerId, tenantId: input.tenantId },
    select: { id: true, tierId: true },
  })
  if (!dealer) throw new AppError('Dealer not found', 404)

  const product = await prisma.product.findFirst({
    where: { id: input.productId, tenantId: input.tenantId },
    select: { id: true, wholesalePrice: true, name: true },
  })
  if (!product) throw new AppError('Product not found', 404)

  // 1) Dealer-specific override
  const overrides = await prisma.wholesaleDealerPriceOverride.findMany({
    where: {
      dealerId: dealer.id,
      productId: product.id,
      OR: [{ sellUnit }, { sellUnit: null }],
    },
    orderBy: { updatedAt: 'desc' },
  })
  const override =
    overrides.find((o) => o.sellUnit === sellUnit && inEffectiveWindow(o.effectiveFrom, o.effectiveTo, now)) ||
    overrides.find((o) => o.sellUnit == null && inEffectiveWindow(o.effectiveFrom, o.effectiveTo, now))
  if (override) {
    return {
      unitPrice: override.unitPrice,
      source: 'DEALER_OVERRIDE',
      floorPrice: null,
      moq: null,
      priceListItemId: null,
      sellUnit,
    }
  }

  // 2) Tier / default price list + qty break
  let priceList = dealer.tierId
    ? await prisma.wholesalePriceList.findFirst({
        where: { tenantId: input.tenantId, tierId: dealer.tierId, isActive: true },
        orderBy: { updatedAt: 'desc' },
      })
    : null
  if (!priceList) {
    priceList = await prisma.wholesalePriceList.findFirst({
      where: { tenantId: input.tenantId, isDefault: true, isActive: true },
    })
  }

  if (priceList) {
    const item = await prisma.wholesalePriceListItem.findFirst({
      where: { priceListId: priceList.id, productId: product.id, sellUnit },
      include: { qtyBreaks: { orderBy: { qtyFrom: 'desc' } } },
    })
    if (item && inEffectiveWindow(item.effectiveFrom, item.effectiveTo, now)) {
      const breakMatch = item.qtyBreaks.find((b) => {
        if (qty < b.qtyFrom) return false
        if (b.qtyTo != null && qty > b.qtyTo) return false
        return true
      })
      if (breakMatch) {
        return {
          unitPrice: breakMatch.unitPrice,
          source: 'TIER_QTY_BREAK',
          floorPrice: item.floorPrice,
          moq: item.moq,
          priceListItemId: item.id,
          sellUnit,
        }
      }
      return {
        unitPrice: item.unitPrice,
        source: 'TIER_LIST',
        floorPrice: item.floorPrice,
        moq: item.moq,
        priceListItemId: item.id,
        sellUnit,
      }
    }
  }

  // 3) Catalog wholesalePrice — never retail sellingPrice
  const catalog = Number(product.wholesalePrice ?? 0)
  if (catalog > 0) {
    return {
      unitPrice: catalog,
      source: 'PRODUCT_WHOLESALE',
      floorPrice: null,
      moq: null,
      priceListItemId: null,
      sellUnit,
    }
  }

  throw new AppError(
    `No wholesale price for "${product.name}". Set a dealer override, tier list price, or product.wholesalePrice.`,
    400,
  )
}

// ─── Tiers ───────────────────────────────────────────────────────────────────

export async function listTiers(tenantId: string) {
  return prisma.dealerTier.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { dealers: true, priceLists: true } } },
  })
}

export async function createTier(tenantId: string, input: CreateTierInput) {
  return prisma.dealerTier.create({
    data: {
      tenantId,
      name: input.name.trim(),
      code: input.code?.trim() || null,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    },
  })
}

export async function updateTier(tenantId: string, id: string, input: UpdateTierInput) {
  const tier = await prisma.dealerTier.findFirst({ where: { id, tenantId } })
  if (!tier) throw new AppError('Dealer tier not found', 404)
  return prisma.dealerTier.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.code !== undefined ? { code: input.code?.trim() || null } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  })
}

export async function deleteTier(tenantId: string, id: string) {
  const tier = await prisma.dealerTier.findFirst({ where: { id, tenantId } })
  if (!tier) throw new AppError('Dealer tier not found', 404)
  await prisma.dealerTier.delete({ where: { id } })
  return { id }
}

// ─── Price lists ─────────────────────────────────────────────────────────────

export async function listPriceLists(tenantId: string) {
  return prisma.wholesalePriceList.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
    include: {
      tier: { select: { id: true, name: true } },
      _count: { select: { items: true } },
    },
  })
}

export async function getPriceList(tenantId: string, id: string) {
  const list = await prisma.wholesalePriceList.findFirst({
    where: { id, tenantId },
    include: {
      tier: { select: { id: true, name: true } },
      items: {
        include: { product: { select: { id: true, name: true, sku: true } }, qtyBreaks: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!list) throw new AppError('Price list not found', 404)
  return list
}

export async function createPriceList(tenantId: string, input: CreatePriceListInput) {
  if (input.isDefault) {
    await prisma.wholesalePriceList.updateMany({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    })
  }
  return prisma.wholesalePriceList.create({
    data: {
      tenantId,
      name: input.name.trim(),
      code: input.code?.trim() || null,
      tierId: input.tierId || null,
      currency: input.currency || 'LKR',
      isDefault: input.isDefault ?? false,
      isActive: input.isActive ?? true,
    },
  })
}

export async function updatePriceList(tenantId: string, id: string, input: UpdatePriceListInput) {
  await getPriceList(tenantId, id)
  if (input.isDefault) {
    await prisma.wholesalePriceList.updateMany({
      where: { tenantId, isDefault: true, NOT: { id } },
      data: { isDefault: false },
    })
  }
  return prisma.wholesalePriceList.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.code !== undefined ? { code: input.code?.trim() || null } : {}),
      ...(input.tierId !== undefined ? { tierId: input.tierId || null } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  })
}

export async function deletePriceList(tenantId: string, id: string) {
  await getPriceList(tenantId, id)
  await prisma.wholesalePriceList.delete({ where: { id } })
  return { id }
}

// ─── Price list items ────────────────────────────────────────────────────────

async function assertPriceList(tenantId: string, priceListId: string) {
  const list = await prisma.wholesalePriceList.findFirst({ where: { id: priceListId, tenantId } })
  if (!list) throw new AppError('Price list not found', 404)
  return list
}

export async function createPriceListItem(
  tenantId: string,
  priceListId: string,
  input: CreatePriceListItemInput,
) {
  await assertPriceList(tenantId, priceListId)
  const product = await prisma.product.findFirst({
    where: { id: input.productId, tenantId },
    select: { id: true },
  })
  if (!product) throw new AppError('Product not found', 404)

  return prisma.wholesalePriceListItem.create({
    data: {
      priceListId,
      productId: input.productId,
      unitPrice: input.unitPrice,
      floorPrice: input.floorPrice ?? null,
      moq: input.moq ?? null,
      effectiveFrom: parseOptionalDate(input.effectiveFrom),
      effectiveTo: parseOptionalDate(input.effectiveTo),
      sellUnit: input.sellUnit ?? 'PIECE',
    },
    include: { qtyBreaks: true, product: { select: { id: true, name: true, sku: true } } },
  })
}

export async function updatePriceListItem(
  tenantId: string,
  itemId: string,
  input: UpdatePriceListItemInput,
) {
  const item = await prisma.wholesalePriceListItem.findFirst({
    where: { id: itemId, priceList: { tenantId } },
  })
  if (!item) throw new AppError('Price list item not found', 404)

  return prisma.wholesalePriceListItem.update({
    where: { id: itemId },
    data: {
      ...(input.productId !== undefined ? { productId: input.productId } : {}),
      ...(input.unitPrice !== undefined ? { unitPrice: input.unitPrice } : {}),
      ...(input.floorPrice !== undefined ? { floorPrice: input.floorPrice } : {}),
      ...(input.moq !== undefined ? { moq: input.moq } : {}),
      ...(input.effectiveFrom !== undefined
        ? { effectiveFrom: parseOptionalDate(input.effectiveFrom) }
        : {}),
      ...(input.effectiveTo !== undefined
        ? { effectiveTo: parseOptionalDate(input.effectiveTo) }
        : {}),
      ...(input.sellUnit !== undefined ? { sellUnit: input.sellUnit } : {}),
    },
    include: { qtyBreaks: true },
  })
}

export async function deletePriceListItem(tenantId: string, itemId: string) {
  const item = await prisma.wholesalePriceListItem.findFirst({
    where: { id: itemId, priceList: { tenantId } },
  })
  if (!item) throw new AppError('Price list item not found', 404)
  await prisma.wholesalePriceListItem.delete({ where: { id: itemId } })
  return { id: itemId }
}

// ─── Qty breaks ──────────────────────────────────────────────────────────────

export async function createQtyBreak(
  tenantId: string,
  priceListItemId: string,
  input: CreateQtyBreakInput,
) {
  const item = await prisma.wholesalePriceListItem.findFirst({
    where: { id: priceListItemId, priceList: { tenantId } },
  })
  if (!item) throw new AppError('Price list item not found', 404)
  if (input.qtyTo != null && input.qtyTo < input.qtyFrom) {
    throw new AppError('qtyTo must be >= qtyFrom', 400)
  }
  return prisma.wholesaleQtyBreak.create({
    data: {
      priceListItemId,
      qtyFrom: input.qtyFrom,
      qtyTo: input.qtyTo ?? null,
      unitPrice: input.unitPrice,
    },
  })
}

export async function updateQtyBreak(
  tenantId: string,
  breakId: string,
  input: UpdateQtyBreakInput,
) {
  const row = await prisma.wholesaleQtyBreak.findFirst({
    where: { id: breakId, priceListItem: { priceList: { tenantId } } },
  })
  if (!row) throw new AppError('Qty break not found', 404)
  return prisma.wholesaleQtyBreak.update({
    where: { id: breakId },
    data: {
      ...(input.qtyFrom !== undefined ? { qtyFrom: input.qtyFrom } : {}),
      ...(input.qtyTo !== undefined ? { qtyTo: input.qtyTo } : {}),
      ...(input.unitPrice !== undefined ? { unitPrice: input.unitPrice } : {}),
    },
  })
}

export async function deleteQtyBreak(tenantId: string, breakId: string) {
  const row = await prisma.wholesaleQtyBreak.findFirst({
    where: { id: breakId, priceListItem: { priceList: { tenantId } } },
  })
  if (!row) throw new AppError('Qty break not found', 404)
  await prisma.wholesaleQtyBreak.delete({ where: { id: breakId } })
  return { id: breakId }
}

// ─── Dealer overrides ────────────────────────────────────────────────────────

export async function listDealerOverrides(tenantId: string, dealerId: string) {
  const dealer = await prisma.dealer.findFirst({ where: { id: dealerId, tenantId } })
  if (!dealer) throw new AppError('Dealer not found', 404)
  return prisma.wholesaleDealerPriceOverride.findMany({
    where: { dealerId },
    include: { product: { select: { id: true, name: true, sku: true } } },
    orderBy: { updatedAt: 'desc' },
  })
}

export async function createDealerOverride(tenantId: string, input: CreateDealerOverrideInput) {
  const dealer = await prisma.dealer.findFirst({ where: { id: input.dealerId, tenantId } })
  if (!dealer) throw new AppError('Dealer not found', 404)
  const product = await prisma.product.findFirst({
    where: { id: input.productId, tenantId },
    select: { id: true },
  })
  if (!product) throw new AppError('Product not found', 404)

  return prisma.wholesaleDealerPriceOverride.create({
    data: {
      dealerId: input.dealerId,
      productId: input.productId,
      unitPrice: input.unitPrice,
      effectiveFrom: parseOptionalDate(input.effectiveFrom),
      effectiveTo: parseOptionalDate(input.effectiveTo),
      sellUnit: input.sellUnit ?? null,
    },
    include: { product: { select: { id: true, name: true, sku: true } } },
  })
}

export async function updateDealerOverride(
  tenantId: string,
  id: string,
  input: UpdateDealerOverrideInput,
) {
  const row = await prisma.wholesaleDealerPriceOverride.findFirst({
    where: { id, dealer: { tenantId } },
  })
  if (!row) throw new AppError('Dealer price override not found', 404)
  return prisma.wholesaleDealerPriceOverride.update({
    where: { id },
    data: {
      ...(input.unitPrice !== undefined ? { unitPrice: input.unitPrice } : {}),
      ...(input.effectiveFrom !== undefined
        ? { effectiveFrom: parseOptionalDate(input.effectiveFrom) }
        : {}),
      ...(input.effectiveTo !== undefined
        ? { effectiveTo: parseOptionalDate(input.effectiveTo) }
        : {}),
      ...(input.sellUnit !== undefined ? { sellUnit: input.sellUnit } : {}),
    },
    include: { product: { select: { id: true, name: true, sku: true } } },
  })
}

export async function deleteDealerOverride(tenantId: string, id: string) {
  const row = await prisma.wholesaleDealerPriceOverride.findFirst({
    where: { id, dealer: { tenantId } },
  })
  if (!row) throw new AppError('Dealer price override not found', 404)
  await prisma.wholesaleDealerPriceOverride.delete({ where: { id } })
  return { id }
}
