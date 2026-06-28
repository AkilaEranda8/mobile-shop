import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { getPagination } from '../../utils/pagination'
import { Request } from 'express'
import { inferTrackImeiFromMeta } from '../../utils/productImei'

export const productsService = {
  async list(tenantId: string, req: Request) {
    const { skip, limit, page, search } = getPagination(req)
    const branchId = req.query.branchId as string | undefined
    const categoryId = req.query.categoryId as string | undefined
    const where: any = { tenantId, isActive: true, ...(branchId && { branchId }), ...(categoryId && { categoryId }), ...(search && { OR: [{ name: { contains: search, mode: 'insensitive' } }, { sku: { contains: search, mode: 'insensitive' } }, { barcode: { contains: search, mode: 'insensitive' } }] }) }
    const include = { category: { select: { name: true } }, brand: { select: { name: true } } }
    const [raw, total] = await Promise.all([prisma.product.findMany({ where, skip, take: limit, orderBy: { name: 'asc' }, include }), prisma.product.count({ where })])
    const trackIds = raw.filter((p: any) => p.trackImei).map((p: any) => p.id)
    const imeiCounts = trackIds.length
      ? await prisma.imeiRecord.groupBy({
          by: ['productId'],
          where: { productId: { in: trackIds }, status: 'IN_STOCK' },
          _count: { _all: true },
        })
      : []
    const imeiMap = new Map(imeiCounts.map(c => [c.productId, c._count._all]))
    const data = raw.map((p: any) => {
      const base = { ...p, categoryName: p.category?.name, brandName: p.brand?.name }
      if (!p.trackImei) return base
      const imeiInStock = imeiMap.get(p.id) ?? 0
      return { ...base, imeiInStock, imeiGap: Math.max(0, p.stock - imeiInStock) }
    })
    return { data, total, page, limit }
  },

  async getById(tenantId: string, id: string) {
    const raw = await prisma.product.findFirst({ where: { id, tenantId }, include: { category: { select: { name: true } }, brand: { select: { name: true } } } }) as any
    if (!raw) throw new AppError('Product not found', 404)
    const base = { ...raw, categoryName: raw.category?.name, brandName: raw.brand?.name }
    if (!raw.trackImei) return base
    const imeiInStock = await prisma.imeiRecord.count({ where: { productId: id, status: 'IN_STOCK' } })
    return { ...base, imeiInStock, imeiGap: Math.max(0, raw.stock - imeiInStock) }
  },

  async create(tenantId: string, body: any) {
    if (!body.sku?.trim()) {
      body.sku = `SKU-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`
    } else {
      body.sku = body.sku.trim()
      const existing = await prisma.product.findFirst({ where: { tenantId, sku: body.sku, isActive: true } })
      if (existing) throw new AppError('SKU already in use', 409)
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
      const hasVariants = Array.isArray(body.storageVariations) && body.storageVariations.length > 0
      const inferred = inferTrackImeiFromMeta({
        categoryName: body.categoryName,
        productName: body.name,
        hasVariants,
      })
      if (inferred !== null) body.trackImei = inferred
    }

    const { categoryName, brandName, ...productData } = body
    // strip fields not in schema that Prisma won't accept
    delete productData.subCategoryName
    const raw: any = await prisma.product.create({ data: { ...productData, tenantId }, include: { category: { select: { name: true } }, brand: { select: { name: true } } } })
    return { ...raw, categoryName: raw.category?.name, brandName: raw.brand?.name }
  },

  async update(tenantId: string, id: string, body: any) {
    const p = await prisma.product.findFirst({ where: { id, tenantId } })
    if (!p) throw new AppError('Product not found', 404)
    const { name, description, sku, barcode, categoryId, brandId,
            buyingPrice, sellingPrice, mrp, trackImei, warrantyMonths, warrantyNote,
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
    if (minStock          !== undefined) {
      const n = Number(minStock)
      if (Number.isNaN(n) || n < 0) throw new AppError('Minimum stock cannot be negative', 400)
      data.minStock = n
    }
    if (isActive          !== undefined) data.isActive          = Boolean(isActive)
    return prisma.product.update({ where: { id }, data })
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
    return prisma.brand.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
  },

  async createBrand(tenantId: string, body: { name: string; logoUrl?: string }) {
    return prisma.brand.create({ data: { tenantId, ...body } })
  },

  async getImeiHealth(tenantId: string) {
    const [trackProducts, poOrders, poImeiCounts] = await Promise.all([
      prisma.product.findMany({
        where: { tenantId, isActive: true, trackImei: true, stock: { gt: 0 } },
        include: { category: { select: { name: true } } },
        orderBy: { name: 'asc' },
      }),
      prisma.purchaseOrder.findMany({
        where: { tenantId, status: { in: ['RECEIVED', 'CLOSED'] } },
        include: { items: true },
        orderBy: { receivedAt: 'desc' },
        take: 100,
      }),
      prisma.imeiRecord.groupBy({
        by: ['purchaseOrderId'],
        where: { purchaseOrderId: { not: null }, product: { tenantId } },
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
