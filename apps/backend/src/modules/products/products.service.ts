import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { getPagination } from '../../utils/pagination'
import { Request } from 'express'
import { inferTrackImeiFromMeta } from '../../utils/productImei'
import { effectiveBranchId, assertBranchRecordAccess, getUserBranchIds } from '../../utils/active-branch'
import { buildBranchCatalogData, catalogBaseSku, findBranchCatalogProduct, isBranchCatalogCloneSku } from '../../utils/branch-catalog'
import { generateProductBarcode, generateProductSku, peekProductCodes } from '../../utils/counters'
import { hasVariants, sumVariantStock } from '../../utils/product-variants'
import { Prisma } from '@prisma/client'
import { isInventoryEngineEnabled } from '../inventory-engine/inventory-engine.feature'
import { applyStockAdjustmentEffects } from '../inventory-engine/inventory-engine.service'

function withEffectiveStock<T extends { stock: number; storageVariations?: unknown }>(p: T): T {
  if (!hasVariants(p.storageVariations)) return p
  return { ...p, stock: sumVariantStock(p.storageVariations) }
}

async function loadTenantSlug(tenantId: string): Promise<string> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } })
  return t?.slug ?? 'tenant'
}

async function upsertCatalogAtBranch(
  tx: Prisma.TransactionClient,
  tenantId: string,
  source: { sku: string } & Record<string, unknown>,
  data: Record<string, unknown>,
  targetBranchId: string,
) {
  const catalog = buildBranchCatalogData(source as any, data, targetBranchId)
  let dest = await findBranchCatalogProduct(tx, tenantId, source.sku, targetBranchId)
  if (!dest) {
    dest = await tx.product.create({
      data: { tenantId, ...catalog, stock: 0 },
    })
  } else {
    if (dest.branchId !== targetBranchId) throw new AppError('Destination SKU exists at another branch', 409)
    await tx.product.update({ where: { id: dest.id }, data: catalog })
  }
  return dest
}

export const productsService = {
  async list(tenantId: string, req: Request) {
    const { skip, limit, page, search } = getPagination(req)
    const branchId = effectiveBranchId(req)
    const categoryId = req.query.categoryId as string | undefined
    const where: any = {
      tenantId,
      isActive: true,
      ...(branchId && { branchId }),
      ...(categoryId && { categoryId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } },
        ],
      }),
    }
    const include = { category: { select: { name: true } }, brand: { select: { name: true } }, branch: { select: { id: true, name: true, isDefault: true, isHeadquarters: true } } }

    // Single-branch view: return that branch's rows as-is (including catalog clones).
    if (branchId) {
      const [raw, total] = await Promise.all([
        prisma.product.findMany({ where, skip, take: limit, orderBy: { name: 'asc' }, include }),
        prisma.product.count({ where }),
      ])
      const trackIds = raw.filter((p: any) => p.trackImei).map((p: any) => p.id)
      const imeiCounts = trackIds.length
        ? await prisma.imeiRecord.groupBy({
            by: ['productId'],
            where: { productId: { in: trackIds }, status: 'IN_STOCK', branchId },
            _count: { _all: true },
          })
        : []
      const imeiMap = new Map(imeiCounts.map(c => [c.productId, c._count._all]))
      const data = raw.map((p: any) => {
        const base = withEffectiveStock({ ...p, categoryName: p.category?.name, brandName: p.brand?.name })
        if (!p.trackImei) return base
        const imeiInStock = imeiMap.get(p.id) ?? 0
        return { ...base, imeiInStock, imeiGap: Math.max(0, base.stock - imeiInStock) }
      })
      return { data, total, page, limit }
    }

    // All Branches: collapse HQ + `-BRxxxxxx` catalog clones into one row per base SKU.
    const allRaw = await prisma.product.findMany({
      where,
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
      include,
    })

    type Row = (typeof allRaw)[number]
    const groups = new Map<string, Row[]>()
    for (const p of allRaw) {
      const key = catalogBaseSku(p.sku)
      const list = groups.get(key)
      if (list) list.push(p)
      else groups.set(key, [p])
    }

    const collapsed = Array.from(groups.values()).map(rows => {
      const primary =
        rows.find(r => !isBranchCatalogCloneSku(r.sku)) ||
        rows.find(r => r.branch?.isDefault) ||
        rows.find(r => r.branch?.isHeadquarters) ||
        rows[0]

      let stockSum = 0
      for (const r of rows) {
        stockSum += withEffectiveStock(r).stock
      }

      // Prefer showing the clean base SKU (without branch suffix) in All Branches.
      const displaySku = catalogBaseSku(primary.sku)
      return {
        ...primary,
        sku: displaySku,
        stock: stockSum,
        categoryName: primary.category?.name,
        brandName: primary.brand?.name,
        branchIds: rows.map(r => r.branchId),
        branchCount: rows.length,
        _groupProductIds: rows.map(r => r.id),
      }
    })

    // Stable name sort after collapse
    collapsed.sort((a, b) => a.name.localeCompare(b.name) || a.sku.localeCompare(b.sku))

    const total = collapsed.length
    const pageRows = collapsed.slice(skip, skip + limit)

    const trackGroupIds = pageRows.filter(p => p.trackImei).flatMap(p => p._groupProductIds as string[])
    const imeiCounts = trackGroupIds.length
      ? await prisma.imeiRecord.groupBy({
          by: ['productId'],
          where: { productId: { in: trackGroupIds }, status: 'IN_STOCK' },
          _count: { _all: true },
        })
      : []
    const imeiByProduct = new Map(imeiCounts.map(c => [c.productId, c._count._all]))

    const data = pageRows.map(p => {
      const { _groupProductIds, ...rest } = p as any
      const base = withEffectiveStock(rest)
      // stock already aggregated above; don't re-sum variants from primary only
      base.stock = p.stock
      if (!p.trackImei) return base
      const imeiInStock = (_groupProductIds as string[]).reduce((s, id) => s + (imeiByProduct.get(id) ?? 0), 0)
      return { ...base, imeiInStock, imeiGap: Math.max(0, base.stock - imeiInStock) }
    })

    return { data, total, page, limit }
  },

  async getById(tenantId: string, id: string) {
    const raw = await prisma.product.findFirst({ where: { id, tenantId }, include: { category: { select: { name: true } }, brand: { select: { name: true } } } }) as any
    if (!raw) throw new AppError('Product not found', 404)
    const base = withEffectiveStock({ ...raw, categoryName: raw.category?.name, brandName: raw.brand?.name })
    if (!raw.trackImei) return base
    const imeiInStock = await prisma.imeiRecord.count({
      where: { productId: id, status: 'IN_STOCK', branchId: raw.branchId },
    })
    return { ...base, imeiInStock, imeiGap: Math.max(0, raw.stock - imeiInStock) }
  },

  async nextCodes(tenantId: string) {
    const slug = await loadTenantSlug(tenantId)
    return peekProductCodes(tenantId, slug)
  },

  async lookupByCode(tenantId: string, code: string, branchId?: string) {
    const trimmed = code.trim()
    if (!trimmed) throw new AppError('Code required', 400)

    const productInclude = {
      category: { select: { name: true } },
      brand: { select: { name: true } },
    }

    const formatProduct = (raw: any, variation?: { storage: string; colorName: string; sku?: string; sellingPrice?: number }) => {
      const base = {
        ...raw,
        categoryName: raw.category?.name,
        brandName: raw.brand?.name,
      }
      if (variation) {
        return {
          ...base,
          matchedVariation: variation,
          displayName: `${raw.name} · ${variation.storage} / ${variation.colorName}`,
          matchedSku: variation.sku ?? raw.sku,
        }
      }
      return base
    }

    if (/^\d{15}$/.test(trimmed)) {
      const record = await prisma.imeiRecord.findFirst({
        where: {
          imei: trimmed,
          product: { tenantId, isActive: true, ...(branchId && { branchId }) },
        },
        include: {
          product: { include: productInclude },
        },
      })
      if (record?.product) {
        return {
          matchType: 'imei' as const,
          imei: trimmed,
          product: formatProduct(record.product),
          record: {
            id: record.id,
            imei: record.imei,
            status: record.status,
            productId: record.productId,
            branchId: record.branchId,
          },
        }
      }
    }

    const exactWhere: any = {
      tenantId,
      isActive: true,
      ...(branchId && { branchId }),
      OR: [
        { barcode: { equals: trimmed, mode: 'insensitive' } },
        { sku: { equals: trimmed, mode: 'insensitive' } },
      ],
    }
    const exact = await prisma.product.findFirst({ where: exactWhere, include: productInclude })
    if (exact) {
      return { matchType: 'barcode' as const, product: formatProduct(exact) }
    }

    const variantCandidates = await prisma.product.findMany({
      where: { tenantId, isActive: true, ...(branchId && { branchId }) },
      include: productInclude,
      take: 500,
      orderBy: { updatedAt: 'desc' },
    })
    for (const p of variantCandidates) {
      const vars = (p.storageVariations as Array<{ storage?: string; colorName?: string; sku?: string; sellingPrice?: number }> | null) ?? []
      const hit = vars.find(v => v.sku && v.sku.toLowerCase() === trimmed.toLowerCase())
      if (hit && hit.storage && hit.colorName) {
        return {
          matchType: 'variant_sku' as const,
          product: formatProduct(p, hit as { storage: string; colorName: string; sku?: string; sellingPrice?: number }),
        }
      }
    }

    throw new AppError('No product found for this barcode or SKU', 404)
  },

  async create(tenantId: string, body: any, req?: Request) {
    const slug = await loadTenantSlug(tenantId)
    if (!body.sku?.trim()) {
      body.sku = await generateProductSku(tenantId, slug)
    } else {
      body.sku = body.sku.trim()
      const existing = await prisma.product.findFirst({ where: { tenantId, sku: body.sku, isActive: true } })
      if (existing) throw new AppError('SKU already in use', 409)
    }

    if (!body.barcode?.trim()) {
      body.barcode = await generateProductBarcode(tenantId, slug)
    } else {
      body.barcode = body.barcode.trim()
    }

    if (body.mrp === undefined || body.mrp === null) body.mrp = body.sellingPrice

    if (body.condition !== undefined && body.condition !== 'BRAND_NEW' && body.condition !== 'USED') {
      throw new AppError('Invalid product condition', 400)
    }
    if (!body.condition) body.condition = 'BRAND_NEW'

    if (!body.branchId) {
      const branch = await prisma.branch.findFirst({
        where: { tenantId, isActive: true },
        orderBy: [{ isDefault: 'desc' }, { isHeadquarters: 'desc' }, { createdAt: 'asc' }],
      })
      if (!branch) throw new AppError('No branch found for tenant', 400)
      body.branchId = branch.id
    }

    if (!body.categoryId && body.categoryName) {
      let cat = await prisma.category.findFirst({ where: { tenantId, name: body.categoryName } })
      if (!cat) cat = await prisma.category.create({ data: { tenantId, name: body.categoryName, slug: body.categoryName.toLowerCase().replace(/\s+/g, '-') } })
      body.categoryId = cat.id
    }
    if (!body.categoryId) throw new AppError('Category is required', 400)

    if (!body.brandId) {
      const brandName = body.brandName?.trim() || 'General'
      let brand = await prisma.brand.findFirst({ where: { tenantId, name: brandName } })
      if (!brand) brand = await prisma.brand.create({ data: { tenantId, name: brandName } })
      body.brandId = brand.id
    }

    if (body.trackImei === undefined) {
      const bodyHasVariants = Array.isArray(body.storageVariations) && body.storageVariations.length > 0
      const inferred = inferTrackImeiFromMeta({
        categoryName: body.categoryName,
        productName: body.name,
        hasVariants: bodyHasVariants,
      })
      if (inferred !== null) body.trackImei = inferred
    }

    const {
      name, description, sku, barcode, categoryId, brandId, branchId,
      buyingPrice, sellingPrice, wholesalePrice, creditPrice, mrp, trackImei, warrantyMonths, warrantyNote,
      imageUrl, stock, minStock, isActive, storageVariations, colorVariations,
      subCategory, deviceModel, condition,
    } = body

    const wholesale = Math.max(0, Number(wholesalePrice) || 0)
    const credit = Math.max(0, Number(creditPrice) || 0)
    const variations = Array.isArray(storageVariations) ? storageVariations : undefined
    const initialStock = hasVariants(variations)
      ? sumVariantStock(variations)
      : Math.max(0, Number(stock) || 0)
    const engineOn = await isInventoryEngineEnabled(tenantId)
    const performedBy = req?.user?.email ?? 'system'

    const createData = {
      tenantId,
      branchId,
      name: String(name).trim(),
      sku: String(sku).trim(),
      barcode: barcode?.trim() || null,
      categoryId,
      brandId,
      description: description?.trim() || null,
      buyingPrice: Number(buyingPrice),
      sellingPrice: Number(sellingPrice),
      wholesalePrice: wholesale,
      creditPrice: credit,
      mrp: Number(mrp ?? sellingPrice),
      trackImei: Boolean(trackImei),
      warrantyMonths: Number(warrantyMonths) || 0,
      warrantyNote: warrantyNote?.trim() || null,
      imageUrl: imageUrl || null,
      stock: initialStock,
      minStock: Math.max(0, Number(minStock) || 0),
      isActive: isActive !== false,
      storageVariations: variations,
      colorVariations: Array.isArray(colorVariations) ? colorVariations : undefined,
      subCategory: subCategory?.trim() || null,
      deviceModel: deviceModel?.trim() || null,
      condition: (condition === 'USED' ? 'USED' : 'BRAND_NEW') as 'USED' | 'BRAND_NEW',
    }

    const raw: any = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: createData as Prisma.ProductUncheckedCreateInput,
        include: { category: { select: { name: true } }, brand: { select: { name: true } } },
      })

      if (engineOn && initialStock !== 0) {
        await applyStockAdjustmentEffects({
          tx,
          tenantId,
          productId: created.id,
          branchId: created.branchId,
          performedBy,
          reference: `PRODUCT_CREATE:${created.id}`,
          note: 'Initial catalog stock',
          targetStock: initialStock,
          targetStorageVariations: variations,
          previousEffectiveStock: 0,
          movementOnly: true,
        })
      }

      return created
    })
    return { ...raw, categoryName: raw.category?.name, brandName: raw.brand?.name }
  },

  async update(tenantId: string, id: string, body: any, req?: Request) {
    const p = await prisma.product.findFirst({ where: { id, tenantId } })
    if (!p) throw new AppError('Product not found', 404)

    let catalogTargets: string[] = []
    if (req) {
      const activeBranches = await prisma.branch.findMany({
        where: { tenantId, isActive: true },
        select: { id: true },
      })
      if (activeBranches.length > 1) {
        const user = req.user!
        const allowed = await getUserBranchIds(user.userId, tenantId, user.role)
        const activeIds = new Set(activeBranches.map(b => b.id))
        const requested: string[] = Array.isArray(body.catalogBranchIds)
          ? body.catalogBranchIds
          : body.branchId !== undefined
            ? [body.branchId]
            : []

        for (const rawId of requested) {
          const branchId = String(rawId)
          if (branchId === p.branchId) continue
          if (!allowed.includes(branchId)) throw new AppError('Branch access denied', 403)
          if (!activeIds.has(branchId)) throw new AppError('Invalid branch', 400)
        }

        catalogTargets = [...new Set(
          requested.map(String).filter(id => id && id !== p.branchId),
        )]
      }
    }

    if (!body.categoryId && body.categoryName) {
      let cat = await prisma.category.findFirst({ where: { tenantId, name: body.categoryName } })
      if (!cat) {
        cat = await prisma.category.create({
          data: { tenantId, name: body.categoryName, slug: body.categoryName.toLowerCase().replace(/\s+/g, '-') },
        })
      }
      body.categoryId = cat.id
    }

    if (!body.brandId && body.brandName) {
      const brandName = body.brandName.trim() || 'General'
      let brand = await prisma.brand.findFirst({ where: { tenantId, name: brandName } })
      if (!brand) brand = await prisma.brand.create({ data: { tenantId, name: brandName } })
      body.brandId = brand.id
    }

    const { name, description, sku, barcode, categoryId, brandId,
            buyingPrice, sellingPrice, wholesalePrice, creditPrice, mrp, trackImei, warrantyMonths, warrantyNote,
            imageUrl, stock, minStock, isActive,
            storageVariations, colorVariations } = body
    const data: any = {}
    if (name              !== undefined) data.name              = name
    if (description       !== undefined) data.description       = description
    if (sku               !== undefined) data.sku               = sku
    if (barcode           !== undefined) data.barcode           = barcode
    if (categoryId        !== undefined) data.categoryId        = categoryId
    if (brandId           !== undefined) data.brandId           = brandId
    if (buyingPrice       !== undefined) data.buyingPrice       = Number(buyingPrice)
    if (sellingPrice      !== undefined) data.sellingPrice      = Number(sellingPrice)
    if (wholesalePrice    !== undefined) data.wholesalePrice    = Math.max(0, Number(wholesalePrice) || 0)
    if (creditPrice       !== undefined) data.creditPrice       = Math.max(0, Number(creditPrice) || 0)
    if (mrp               !== undefined) data.mrp               = Number(mrp)
    if (trackImei         !== undefined) data.trackImei         = Boolean(trackImei)
    if (warrantyMonths    !== undefined) data.warrantyMonths    = Number(warrantyMonths)
    if (warrantyNote      !== undefined) data.warrantyNote      = warrantyNote?.trim() || null
    if (imageUrl          !== undefined) data.imageUrl          = imageUrl
    if (storageVariations !== undefined) data.storageVariations = storageVariations
    if (colorVariations   !== undefined) data.colorVariations   = colorVariations
    if (body.subCategory  !== undefined) data.subCategory       = body.subCategory
    if (body.deviceModel  !== undefined) data.deviceModel       = body.deviceModel
    if (body.condition    !== undefined) {
      if (body.condition !== 'BRAND_NEW' && body.condition !== 'USED') {
        throw new AppError('Invalid product condition', 400)
      }
      data.condition = body.condition
    }
    if (stock             !== undefined) {
      const n = Number(stock)
      if (Number.isNaN(n) || n < 0) throw new AppError('Stock cannot be negative', 400)
      data.stock = n
    }
    // Variant quantities are the source of truth for parent stock
    if (storageVariations !== undefined && hasVariants(storageVariations)) {
      data.stock = sumVariantStock(storageVariations)
    }
    if (minStock          !== undefined) {
      const n = Number(minStock)
      if (Number.isNaN(n) || n < 0) throw new AppError('Minimum stock cannot be negative', 400)
      data.minStock = n
    }
    if (isActive          !== undefined) data.isActive          = Boolean(isActive)

    const inStockImei = await prisma.imeiRecord.count({
      where: { productId: id, status: 'IN_STOCK' },
    })
    const hasInventory = p.stock > 0 || inStockImei > 0

    let moveBranch = false
    if (catalogTargets.length === 1 && !hasInventory) {
      moveBranch = true
      data.branchId = catalogTargets[0]
    }

    const engineOn = await isInventoryEngineEnabled(tenantId)
    const stockTouch = stock !== undefined || storageVariations !== undefined
    let pendingAdjust: {
      targetStock: number
      targetStorageVariations?: unknown
    } | null = null

    if (engineOn && stockTouch) {
      const targetStorageVariations =
        storageVariations !== undefined ? storageVariations : undefined
      const targetStock =
        targetStorageVariations !== undefined && hasVariants(targetStorageVariations)
          ? sumVariantStock(targetStorageVariations)
          : stock !== undefined
            ? Number(stock)
            : hasVariants(p.storageVariations)
              ? sumVariantStock(p.storageVariations)
              : p.stock
      if (Number.isNaN(targetStock) || targetStock < 0) {
        throw new AppError('Stock cannot be negative', 400)
      }
      pendingAdjust = { targetStock, targetStorageVariations }
      delete data.stock
      delete data.storageVariations
    }

    const performedBy = req?.user?.email ?? 'system'

    return prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({ where: { id }, data })

      if (pendingAdjust) {
        await applyStockAdjustmentEffects({
          tx,
          tenantId,
          productId: id,
          branchId: updated.branchId,
          performedBy,
          reference: `PRODUCT_UPDATE:${id}`,
          note: 'Catalog stock adjustment',
          targetStock: pendingAdjust.targetStock,
          targetStorageVariations: pendingAdjust.targetStorageVariations,
        })
      }

      const catalogAssigned: { branchId: string; productId: string }[] = []
      const assignTargets = moveBranch ? [] : catalogTargets

      for (const targetBranchId of assignTargets) {
        const dest = await upsertCatalogAtBranch(tx, tenantId, p, data, targetBranchId)
        catalogAssigned.push({ branchId: targetBranchId, productId: dest.id })
      }

      const resultBase = pendingAdjust
        ? ((await tx.product.findUnique({ where: { id } })) ?? updated)
        : updated

      if (catalogAssigned.length > 0) {
        return { ...resultBase, catalogAssigned }
      }

      return resultBase
    })
  },

  async remove(tenantId: string, id: string) {
    const p = await prisma.product.findFirst({ where: { id, tenantId } })
    if (!p) throw new AppError('Product not found', 404)
    return prisma.product.update({ where: { id }, data: { isActive: false } })
  },

  async getLowStock(tenantId: string, branchId?: string) {
    return prisma.product.findMany({ where: { tenantId, isActive: true, ...(branchId && { branchId }), stock: { lte: prisma.product.fields.minStock } } })
  },

  async getCategories(tenantId: string) {
    const rows = await prisma.category.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    })
    return rows.map(({ _count, ...cat }) => ({ ...cat, productCount: _count.products }))
  },

  async createCategory(tenantId: string, body: { name: string; icon?: string }) {
    const slug = body.name.toLowerCase().replace(/\s+/g, '-')
    return prisma.category.create({ data: { tenantId, name: body.name, slug, icon: body.icon } })
  },

  async deleteCategory(tenantId: string, id: string, reassignToId?: string) {
    const cat = await prisma.category.findFirst({ where: { id, tenantId } })
    if (!cat) throw new AppError('Category not found', 404)
    const inUse = await prisma.product.count({ where: { tenantId, categoryId: id } })
    if (inUse > 0) {
      if (!reassignToId) {
        throw new AppError(
          `Cannot delete — ${inUse} product${inUse > 1 ? 's' : ''} still use this category. Choose another category to move them to.`,
          400,
        )
      }
      if (reassignToId === id) throw new AppError('Cannot move products to the same category', 400)
      const target = await prisma.category.findFirst({ where: { id: reassignToId, tenantId } })
      if (!target) throw new AppError('Target category not found', 404)
      await prisma.product.updateMany({ where: { tenantId, categoryId: id }, data: { categoryId: reassignToId } })
    }
    await prisma.category.delete({ where: { id } })
  },

  async getBrands(tenantId: string) {
    const rows = await prisma.brand.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    })
    return rows.map(({ _count, ...brand }) => ({ ...brand, productCount: _count.products }))
  },

  async createBrand(tenantId: string, body: { name: string; logoUrl?: string }) {
    return prisma.brand.create({ data: { tenantId, ...body } })
  },

  async deleteBrand(tenantId: string, id: string, reassignToId?: string) {
    const brand = await prisma.brand.findFirst({ where: { id, tenantId } })
    if (!brand) throw new AppError('Brand not found', 404)
    const inUse = await prisma.product.count({ where: { tenantId, brandId: id } })
    if (inUse > 0) {
      if (!reassignToId) {
        throw new AppError(
          `Cannot delete — ${inUse} product${inUse > 1 ? 's' : ''} still use this brand. Choose another brand to move them to.`,
          400,
        )
      }
      if (reassignToId === id) throw new AppError('Cannot move products to the same brand', 400)
      const target = await prisma.brand.findFirst({ where: { id: reassignToId, tenantId } })
      if (!target) throw new AppError('Target brand not found', 404)
      await prisma.product.updateMany({ where: { tenantId, brandId: id }, data: { brandId: reassignToId } })
    }
    await prisma.brand.delete({ where: { id } })
  },

  async getImeiHealth(tenantId: string, branchId?: string) {
    const [trackProducts, poOrders, poImeiCounts] = await Promise.all([
      prisma.product.findMany({
        where: {
          tenantId,
          isActive: true,
          trackImei: true,
          stock: { gt: 0 },
          ...(branchId ? { branchId } : {}),
        },
        include: { category: { select: { name: true } } },
        orderBy: { name: 'asc' },
      }),
      prisma.purchaseOrder.findMany({
        where: {
          tenantId,
          status: { in: ['RECEIVED', 'CLOSED'] },
          ...(branchId ? { branchId } : {}),
        },
        include: { items: true },
        orderBy: { receivedAt: 'desc' },
        take: 100,
      }),
      prisma.imeiRecord.groupBy({
        by: ['purchaseOrderId'],
        where: {
          purchaseOrderId: { not: null },
          product: { tenantId, ...(branchId ? { branchId } : {}) },
        },
        _count: { _all: true },
      }),
    ])

    const trackIds = trackProducts.map(p => p.id)
    const imeiCounts = trackIds.length
      ? await prisma.imeiRecord.groupBy({
          by: ['productId'],
          where: { productId: { in: trackIds }, status: 'IN_STOCK' },
          _count: { _all: true },
        })
      : []
    const imeiMap = new Map(imeiCounts.map(c => [c.productId, c._count._all]))

    const stockMismatches = trackProducts
      .map(p => {
        const imeiInStock = imeiMap.get(p.id) ?? 0
        const gap = Math.max(0, p.stock - imeiInStock)
        return { id: p.id, name: p.name, stock: p.stock, imeiInStock, gap }
      })
      .filter(p => p.gap > 0)

    const allProducts = await prisma.product.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, trackImei: true },
    })
    const productById = new Map(allProducts.map(p => [p.id, p]))
    const productByName = new Map(allProducts.map(p => [p.name.toLowerCase(), p]))
    const poCountMap = new Map(
      poImeiCounts.filter(c => c.purchaseOrderId).map(c => [c.purchaseOrderId!, c._count._all]),
    )

    const incompletePurchaseOrders: {
      id: string; poNumber: string; expected: number; registered: number
    }[] = []

    for (const po of poOrders) {
      let expected = 0
      for (const item of po.items) {
        const p = item.productId
          ? productById.get(item.productId)
          : productByName.get(item.productName.toLowerCase())
        if (p?.trackImei) expected += item.quantity
      }
      if (expected === 0) continue
      const registered = poCountMap.get(po.id) ?? 0
      if (registered < expected) {
        incompletePurchaseOrders.push({
          id: po.id,
          poNumber: po.poNumber,
          expected,
          registered,
        })
      }
    }

    return { stockMismatches, incompletePurchaseOrders }
  },

  async bulkInferTrackImei(tenantId: string) {
    const products = await prisma.product.findMany({
      where: { tenantId, isActive: true },
      include: { category: { select: { name: true } } },
    })
    let updated = 0
    for (const p of products) {
      const hasVariants = Array.isArray(p.storageVariations) && (p.storageVariations as unknown[]).length > 0
      const inferred = inferTrackImeiFromMeta({
        categoryName: p.category?.name,
        productName: p.name,
        hasVariants,
      })
      if (inferred !== null && inferred !== p.trackImei) {
        await prisma.product.update({ where: { id: p.id }, data: { trackImei: inferred } })
        updated++
      }
    }
    return { updated, total: products.length }
  },
}
