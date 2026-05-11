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
    const [data, total] = await Promise.all([prisma.product.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }), prisma.product.count({ where })])
    return { data, total, page, limit }
  },

  async getById(tenantId: string, id: string) {
    const p = await prisma.product.findFirst({ where: { id, tenantId } })
    if (!p) throw new AppError('Product not found', 404)
    return p
  },

  async create(tenantId: string, body: any) {
    const existing = await prisma.product.findFirst({ where: { tenantId, sku: body.sku } })
    if (existing) throw new AppError('SKU already in use', 409)
    const product = await prisma.product.create({ data: { ...body, tenantId } })
    await prisma.category.update({ where: { id: body.categoryId }, data: { productCount: { increment: 1 } } }).catch(() => {})
    await prisma.brand.update({ where: { id: body.brandId }, data: { productCount: { increment: 1 } } }).catch(() => {})
    return product
  },

  async update(tenantId: string, id: string, body: any) {
    const p = await prisma.product.findFirst({ where: { id, tenantId } })
    if (!p) throw new AppError('Product not found', 404)
    return prisma.product.update({ where: { id }, data: body })
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
