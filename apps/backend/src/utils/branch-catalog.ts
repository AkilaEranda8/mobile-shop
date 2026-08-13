import { ProductCondition, Prisma } from '@prisma/client'
import { AppError } from '../middleware/error.middleware'
import { variantKey, type VariantRow } from './product-variants'

export type BranchCatalogSource = {
  name: string
  sku: string
  barcode: string | null
  categoryId: string
  brandId: string
  description: string | null
  buyingPrice: number
  sellingPrice: number
  wholesalePrice?: number
  creditPrice?: number
  mrp: number
  trackImei: boolean
  warrantyMonths: number
  warrantyNote: string | null
  imageUrl: string | null
  minStock: number
  storageVariations: unknown
  colorVariations: unknown
  subCategory: string | null
  deviceModel: string | null
  condition: string
}

/** Branch-scoped SKU suffix when the same catalog exists at multiple branches. */
export const BRANCH_CATALOG_SKU_SUFFIX_RE = /(?:-BR[A-Z0-9]{6})+$/i

export function destBranchSku(baseSku: string, toBranchId: string) {
  const suffix = `-BR${toBranchId.slice(-6).toUpperCase()}`
  const max = 100 - suffix.length
  return `${catalogBaseSku(baseSku).slice(0, max)}${suffix}`
}

/** Strip one or more `-BRxxxxxx` suffixes so all branch clones share one catalog key. */
export function catalogBaseSku(sku: string) {
  return sku.replace(BRANCH_CATALOG_SKU_SUFFIX_RE, '')
}

export function isBranchCatalogCloneSku(sku: string) {
  return BRANCH_CATALOG_SKU_SUFFIX_RE.test(sku)
}

export function zeroVariantStock(variations: unknown) {
  if (!Array.isArray(variations)) return variations
  return variations.map((v) => ({ ...(v as Record<string, unknown>), stock: 0 }))
}

/**
 * When refreshing catalog details on an existing branch row, keep that branch's
 * on-hand quantities (parent stock is left untouched by the caller).
 */
export function preserveDestVariantStocks(existing: unknown, incoming: unknown): unknown {
  if (!Array.isArray(incoming)) return incoming ?? existing
  if (!Array.isArray(existing) || existing.length === 0) return incoming

  const stockMap = new Map<string, number>()
  for (const row of existing as VariantRow[]) {
    const qty = Number(row.stock) || 0
    stockMap.set(variantKey(row), qty)
    stockMap.set(`${row.storage}::${row.colorName}`, qty)
  }

  return (incoming as VariantRow[]).map((row) => {
    const preserved =
      stockMap.get(variantKey(row)) ??
      stockMap.get(`${row.storage}::${row.colorName}`) ??
      0
    return { ...row, stock: preserved }
  })
}

/** Catalog-only fields copied to another branch (no stock / IMEI). */
export function buildBranchCatalogData(
  source: BranchCatalogSource,
  overrides: Record<string, unknown>,
  toBranchId: string,
) {
  const baseSku = (overrides.sku as string | undefined) ?? source.sku
  const storage =
    overrides.storageVariations !== undefined
      ? zeroVariantStock(overrides.storageVariations)
      : zeroVariantStock(source.storageVariations)

  return {
    branchId: toBranchId,
    name: (overrides.name as string | undefined) ?? source.name,
    sku: destBranchSku(baseSku, toBranchId),
    barcode: (overrides.barcode as string | null | undefined) ?? source.barcode,
    categoryId: (overrides.categoryId as string | undefined) ?? source.categoryId,
    brandId: (overrides.brandId as string | undefined) ?? source.brandId,
    description: (overrides.description as string | null | undefined) ?? source.description,
    buyingPrice: overrides.buyingPrice !== undefined ? Number(overrides.buyingPrice) : source.buyingPrice,
    sellingPrice: overrides.sellingPrice !== undefined ? Number(overrides.sellingPrice) : source.sellingPrice,
    wholesalePrice: overrides.wholesalePrice !== undefined
      ? Math.max(0, Number(overrides.wholesalePrice) || 0)
      : Math.max(0, Number(source.wholesalePrice) || 0),
    creditPrice: overrides.creditPrice !== undefined
      ? Math.max(0, Number(overrides.creditPrice) || 0)
      : Math.max(0, Number(source.creditPrice) || 0),
    mrp: overrides.mrp !== undefined ? Number(overrides.mrp) : source.mrp,
    trackImei: overrides.trackImei !== undefined ? Boolean(overrides.trackImei) : source.trackImei,
    warrantyMonths:
      overrides.warrantyMonths !== undefined ? Number(overrides.warrantyMonths) : source.warrantyMonths,
    warrantyNote:
      overrides.warrantyNote !== undefined
        ? (overrides.warrantyNote as string | null)?.trim() || null
        : source.warrantyNote,
    imageUrl: (overrides.imageUrl as string | null | undefined) ?? source.imageUrl,
    minStock: overrides.minStock !== undefined ? Number(overrides.minStock) : source.minStock,
    storageVariations: (storage ?? undefined) as Prisma.InputJsonValue | undefined,
    colorVariations: ((overrides.colorVariations as unknown | undefined) ??
      source.colorVariations ??
      undefined) as Prisma.InputJsonValue | undefined,
    subCategory: (overrides.subCategory as string | null | undefined) ?? source.subCategory,
    deviceModel: (overrides.deviceModel as string | null | undefined) ?? source.deviceModel,
    condition: ((overrides.condition as string | undefined) ?? source.condition) as ProductCondition,
  }
}

export async function findBranchCatalogProduct(
  db: Prisma.TransactionClient | typeof import('../config/database').prisma,
  tenantId: string,
  baseSku: string,
  toBranchId: string,
) {
  const sku = catalogBaseSku(baseSku)

  // The clean/base SKU normally belongs to the original (usually HQ) branch.
  // Always prefer it when transferring a branch clone back to that branch.
  const baseCatalog = await db.product.findFirst({
    where: { tenantId, branchId: toBranchId, sku, isActive: true },
  })
  if (baseCatalog) return baseCatalog

  return db.product.findFirst({
    where: {
      tenantId,
      branchId: toBranchId,
      sku: destBranchSku(sku, toBranchId),
      isActive: true,
    },
  })
}

/** Ensure a zero-stock catalog row exists at the destination branch. */
export async function ensureBranchCatalogProduct(
  tx: Prisma.TransactionClient,
  tenantId: string,
  source: BranchCatalogSource,
  toBranchId: string,
) {
  const existing = await findBranchCatalogProduct(tx, tenantId, source.sku, toBranchId)
  if (existing) {
    if (existing.branchId !== toBranchId) {
      throw new AppError('Destination SKU exists at another branch', 409)
    }
    return existing
  }
  const catalog = buildBranchCatalogData(source, {}, toBranchId)
  return tx.product.create({ data: { tenantId, ...catalog, stock: 0 } })
}
