import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { getPagination } from '../../utils/pagination'
import { Request } from 'express'

export const productsService = {
  async list(tenantId: string, req: Request) {
    const { skip, limit, page, search } = getPagination(req)
    const branchId = req.query.branchId as string | undefined
    const categoryId = req.query.categoryId as string | undefined
    const where: any = { tenantId, isActive: true, ...(branchId && { branchId }), ...(categoryId && { categoryId }), ...(search && { OR: [{ name: { contains: search, mode: 'insensitive' } }, { sku: { contains: search, mode: 'insensitive' } }, { barcode: { contains: search, mode: 'insensitive' } }] }) }
    const include = { category: { select: { name: true } }, brand: { select: { name: true } } }
    const [raw, total] = await Promise.all([prisma.product.findMany({ where, skip, take: limit, orderBy: { name: 'asc' }, include }), prisma.product.count({ where })])
    const data = raw.map((p: any) => ({ ...p, categoryName: p.category?.name, brandName: p.brand?.name }))
    return { data, total, page, limit }
  },

  async getById(tenantId: string, id: string) {
    const raw = await prisma.product.findFirst({ where: { id, tenantId }, include: { category: { select: { name: true } }, brand: { select: { name: true } } } }) as any
    if (!raw) throw new AppError('Product not found', 404)
    return { ...raw, categoryName: raw.category?.name, brandName: raw.brand?.name }
  },

  async create(tenantId: string, body: any) {
    const existing = await prisma.product.findFirst({ where: { tenantId, sku: body.sku } })
    if (existing) throw new AppError('SKU already in use', 409)

    if (body.mrp === undefined || body.mrp === null) body.mrp = body.sellingPrice

    if (!body.branchId) {
      const branch = await prisma.branch.findFirst({ where: { tenantId } })
      if (!branch) throw new AppError('No branch found for tenant', 400)
      body.branchId = branch.id
    }

    if (!body.categoryId && body.categoryName) {
      let cat = await prisma.category.findFirst({ where: { tenantId, name: body.categoryName } })
      if (!cat) cat = await prisma.category.create({ data: { tenantId, name: body.categoryName, slug: body.categoryName.toLowerCase().replace(/\s+/g, '-') } })
      body.categoryId = cat.id
    }
    if (!body.categoryId) throw new AppError('Category is required', 400)

    if (!body.brandId && body.brandName) {
      let brand = await prisma.brand.findFirst({ where: { tenantId, name: body.brandName } })
      if (!brand) brand = await prisma.brand.create({ data: { tenantId, name: body.brandName } })
      body.brandId = brand.id
    }
    if (!body.brandId) throw new AppError('Brand is required', 400)

    const { categoryName, brandName, ...productData } = body
    const raw: any = await prisma.product.create({ data: { ...productData, tenantId }, include: { category: { select: { name: true } }, brand: { select: { name: true } } } })
    return { ...raw, categoryName: raw.category?.name, brandName: raw.brand?.name }
  },

  async update(tenantId: string, id: string, body: any) {
    const p = await prisma.product.findFirst({ where: { id, tenantId } })
    if (!p) throw new AppError('Product not found', 404)
    const { name, description, sku, barcode, categoryId, brandId,
            buyingPrice, sellingPrice, mrp, trackImei, warrantyMonths,
            imageUrl, stock, minStock, isActive } = body
    const data: any = {}
    if (name           !== undefined) data.name           = name
    if (description    !== undefined) data.description    = description
    if (sku            !== undefined) data.sku            = sku
    if (barcode        !== undefined) data.barcode        = barcode
    if (categoryId     !== undefined) data.categoryId     = categoryId
    if (brandId        !== undefined) data.brandId        = brandId
    if (buyingPrice    !== undefined) data.buyingPrice    = Number(buyingPrice)
    if (sellingPrice   !== undefined) data.sellingPrice   = Number(sellingPrice)
    if (mrp            !== undefined) data.mrp            = Number(mrp)
    if (trackImei      !== undefined) data.trackImei      = Boolean(trackImei)
    if (warrantyMonths !== undefined) data.warrantyMonths = Number(warrantyMonths)
    if (imageUrl       !== undefined) data.imageUrl       = imageUrl
    if (stock          !== undefined) data.stock          = Number(stock)
    if (minStock       !== undefined) data.minStock       = Number(minStock)
    if (isActive       !== undefined) data.isActive       = Boolean(isActive)
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
    return prisma.category.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
  },

  async createCategory(tenantId: string, body: { name: string; icon?: string }) {
    const slug = body.name.toLowerCase().replace(/\s+/g, '-')
    return prisma.category.create({ data: { tenantId, name: body.name, slug, icon: body.icon } })
  },

  async getBrands(tenantId: string) {
    return prisma.brand.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
  },

  async createBrand(tenantId: string, body: { name: string; logoUrl?: string }) {
    return prisma.brand.create({ data: { tenantId, ...body } })
  },
}
