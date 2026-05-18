import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'

export const deviceCatalogService = {
  /* ── Brands ── */
  async listBrands(tenantId: string) {
    return prisma.deviceBrand.findMany({ where: { tenantId }, orderBy: { name: 'asc' }, include: { models: { orderBy: { name: 'asc' } } } })
  },

  async createBrand(tenantId: string, name: string) {
    const trimmed = name.trim()
    if (!trimmed) throw new AppError('Brand name is required', 400)
    const existing = await prisma.deviceBrand.findUnique({ where: { tenantId_name: { tenantId, name: trimmed } } })
    if (existing) throw new AppError('Brand already exists', 409)
    return prisma.deviceBrand.create({ data: { tenantId, name: trimmed }, include: { models: true } })
  },

  async deleteBrand(tenantId: string, id: string) {
    const b = await prisma.deviceBrand.findFirst({ where: { id, tenantId } })
    if (!b) throw new AppError('Brand not found', 404)
    await prisma.deviceBrand.delete({ where: { id } })
    return { id }
  },

  /* ── Models ── */
  async listModels(tenantId: string, brandId?: string) {
    return prisma.deviceModel.findMany({
      where: { tenantId, ...(brandId ? { brandId } : {}) },
      orderBy: { name: 'asc' },
    })
  },

  async createModel(tenantId: string, brandId: string, name: string) {
    const trimmed = name.trim()
    if (!trimmed) throw new AppError('Model name is required', 400)
    const brand = await prisma.deviceBrand.findFirst({ where: { id: brandId, tenantId } })
    if (!brand) throw new AppError('Brand not found', 404)
    const existing = await prisma.deviceModel.findUnique({ where: { tenantId_brandId_name: { tenantId, brandId, name: trimmed } } })
    if (existing) throw new AppError('Model already exists for this brand', 409)
    return prisma.deviceModel.create({ data: { tenantId, brandId, brandName: brand.name, name: trimmed } })
  },

  async deleteModel(tenantId: string, id: string) {
    const m = await prisma.deviceModel.findFirst({ where: { id, tenantId } })
    if (!m) throw new AppError('Model not found', 404)
    await prisma.deviceModel.delete({ where: { id } })
    return { id }
  },
}
