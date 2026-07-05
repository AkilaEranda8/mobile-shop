import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { slugify } from './master-catalog.util'

const categoryInclude = { _count: { select: { phoneModels: true, accessories: true } } }
const brandInclude = { _count: { select: { phoneModels: true, accessories: true } } }

export const masterCatalogService = {
  /* ── Categories ── */
  listCategories(activeOnly = false) {
    return prisma.masterCatalogCategory.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: categoryInclude,
    })
  },

  async createCategory(body: { name: string; displayOrder?: number; isActive?: boolean }) {
    const name = body.name.trim()
    if (!name) throw new AppError('Category name is required', 400)
    const slug = slugify(name)
    const existing = await prisma.masterCatalogCategory.findFirst({
      where: { OR: [{ name }, { slug }] },
    })
    if (existing) throw new AppError('Category already exists', 409)
    return prisma.masterCatalogCategory.create({
      data: {
        name,
        slug,
        displayOrder: body.displayOrder ?? 0,
        isActive: body.isActive ?? true,
      },
      include: categoryInclude,
    })
  },

  async updateCategory(id: string, body: Partial<{ name: string; displayOrder: number; isActive: boolean }>) {
    const row = await prisma.masterCatalogCategory.findUnique({ where: { id } })
    if (!row) throw new AppError('Category not found', 404)
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) {
      const name = body.name.trim()
      if (!name) throw new AppError('Category name is required', 400)
      data.name = name
      data.slug = slugify(name)
    }
    if (body.displayOrder !== undefined) data.displayOrder = body.displayOrder
    if (body.isActive !== undefined) data.isActive = body.isActive
    return prisma.masterCatalogCategory.update({ where: { id }, data, include: categoryInclude })
  },

  async deleteCategory(id: string) {
    const row = await prisma.masterCatalogCategory.findUnique({ where: { id } })
    if (!row) throw new AppError('Category not found', 404)
    const used = await prisma.masterCatalogPhoneModel.count({ where: { categoryId: id } })
      + await prisma.masterCatalogAccessory.count({ where: { categoryId: id } })
    if (used > 0) throw new AppError('Category is in use by catalog items', 400)
    await prisma.masterCatalogCategory.delete({ where: { id } })
    return { id }
  },

  /* ── Brands ── */
  listBrands(opts?: {
    activeOnly?: boolean
    type?: 'PHONE' | 'ACCESSORY' | 'BOTH'
    withPhoneModels?: boolean
    withAccessories?: boolean
  }) {
    const where: Record<string, unknown> = {}
    if (opts?.activeOnly) where.isActive = true
    if (opts?.type === 'PHONE') {
      where.type = { in: ['PHONE', 'BOTH'] }
    } else if (opts?.type === 'ACCESSORY') {
      where.type = { in: ['ACCESSORY', 'BOTH'] }
    }
    if (opts?.withPhoneModels) {
      where.phoneModels = { some: { isActive: opts.activeOnly ? true : undefined } }
    }
    if (opts?.withAccessories) {
      where.accessories = { some: { isActive: opts.activeOnly ? true : undefined } }
    }
    return prisma.masterCatalogBrand.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: brandInclude,
    })
  },

  async createBrand(body: { name: string; type?: 'PHONE' | 'ACCESSORY' | 'BOTH'; displayOrder?: number; isActive?: boolean }) {
    const name = body.name.trim()
    if (!name) throw new AppError('Brand name is required', 400)
    const existing = await prisma.masterCatalogBrand.findUnique({ where: { name } })
    if (existing) throw new AppError('Brand already exists', 409)
    return prisma.masterCatalogBrand.create({
      data: {
        name,
        type: body.type ?? 'BOTH',
        displayOrder: body.displayOrder ?? 0,
        isActive: body.isActive ?? true,
      },
      include: brandInclude,
    })
  },

  async updateBrand(id: string, body: Partial<{ name: string; type: 'PHONE' | 'ACCESSORY' | 'BOTH'; displayOrder: number; isActive: boolean }>) {
    const row = await prisma.masterCatalogBrand.findUnique({ where: { id } })
    if (!row) throw new AppError('Brand not found', 404)
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) {
      const name = body.name.trim()
      if (!name) throw new AppError('Brand name is required', 400)
      data.name = name
    }
    if (body.type !== undefined) data.type = body.type
    if (body.displayOrder !== undefined) data.displayOrder = body.displayOrder
    if (body.isActive !== undefined) data.isActive = body.isActive
    return prisma.masterCatalogBrand.update({ where: { id }, data, include: brandInclude })
  },

  async deleteBrand(id: string) {
    const row = await prisma.masterCatalogBrand.findUnique({ where: { id } })
    if (!row) throw new AppError('Brand not found', 404)
    await prisma.masterCatalogBrand.delete({ where: { id } })
    return { id }
  },

  /* ── Phone models ── */
  listPhoneModels(opts?: {
    activeOnly?: boolean
    brandId?: string
    brandIds?: string[]
    categoryId?: string
    search?: string
  }) {
    const where: Record<string, unknown> = {}
    if (opts?.activeOnly) where.isActive = true
    if (opts?.brandIds?.length) {
      where.brandId = { in: opts.brandIds }
    } else if (opts?.brandId) {
      where.brandId = opts.brandId
    }
    if (opts?.categoryId) where.categoryId = opts.categoryId
    if (opts?.search?.trim()) {
      where.name = { contains: opts.search.trim(), mode: 'insensitive' }
    }
    return prisma.masterCatalogPhoneModel.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: {
        brand: { select: { id: true, name: true } },
        category: { select: { id: true, name: true, slug: true } },
        variants: { where: opts?.activeOnly ? { isActive: true } : undefined, orderBy: [{ displayOrder: 'asc' }, { storage: 'asc' }] },
      },
    })
  },

  async getPhoneModel(id: string, activeOnly = false) {
    const row = await prisma.masterCatalogPhoneModel.findUnique({
      where: { id },
      include: {
        brand: { select: { id: true, name: true } },
        category: { select: { id: true, name: true, slug: true } },
        variants: {
          where: activeOnly ? { isActive: true } : undefined,
          orderBy: [{ displayOrder: 'asc' }, { storage: 'asc' }],
        },
      },
    })
    if (!row) throw new AppError('Phone model not found', 404)
    return row
  },

  async createPhoneModel(body: {
    brandId: string
    categoryId: string
    name: string
    releaseYear?: number | null
    displayOrder?: number
    isActive?: boolean
    trackImei?: boolean
    defaultWarrantyMonths?: number
  }) {
    const name = body.name.trim()
    if (!name) throw new AppError('Model name is required', 400)
    const brand = await prisma.masterCatalogBrand.findUnique({ where: { id: body.brandId } })
    if (!brand) throw new AppError('Brand not found', 404)
    const category = await prisma.masterCatalogCategory.findUnique({ where: { id: body.categoryId } })
    if (!category) throw new AppError('Category not found', 404)
    const dup = await prisma.masterCatalogPhoneModel.findUnique({
      where: { brandId_name: { brandId: body.brandId, name } },
    })
    if (dup) throw new AppError('Model already exists for this brand', 409)
    return prisma.masterCatalogPhoneModel.create({
      data: {
        brandId: body.brandId,
        categoryId: body.categoryId,
        name,
        releaseYear: body.releaseYear ?? null,
        displayOrder: body.displayOrder ?? 0,
        isActive: body.isActive ?? true,
        trackImei: body.trackImei ?? true,
        defaultWarrantyMonths: body.defaultWarrantyMonths ?? 12,
      },
      include: {
        brand: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        variants: true,
      },
    })
  },

  async updatePhoneModel(id: string, body: Partial<{
    brandId: string
    categoryId: string
    name: string
    releaseYear: number | null
    displayOrder: number
    isActive: boolean
    trackImei: boolean
    defaultWarrantyMonths: number
  }>) {
    const row = await prisma.masterCatalogPhoneModel.findUnique({ where: { id } })
    if (!row) throw new AppError('Phone model not found', 404)
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name.trim()
    if (body.brandId !== undefined) data.brandId = body.brandId
    if (body.categoryId !== undefined) data.categoryId = body.categoryId
    if (body.releaseYear !== undefined) data.releaseYear = body.releaseYear
    if (body.displayOrder !== undefined) data.displayOrder = body.displayOrder
    if (body.isActive !== undefined) data.isActive = body.isActive
    if (body.trackImei !== undefined) data.trackImei = body.trackImei
    if (body.defaultWarrantyMonths !== undefined) data.defaultWarrantyMonths = body.defaultWarrantyMonths
    return prisma.masterCatalogPhoneModel.update({
      where: { id },
      data,
      include: {
        brand: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        variants: { orderBy: [{ displayOrder: 'asc' }] },
      },
    })
  },

  async deletePhoneModel(id: string) {
    const row = await prisma.masterCatalogPhoneModel.findUnique({ where: { id } })
    if (!row) throw new AppError('Phone model not found', 404)
    await prisma.masterCatalogPhoneModel.delete({ where: { id } })
    return { id }
  },

  /* ── Variants ── */
  async createVariant(modelId: string, body: {
    storage: string
    colorName: string
    colorHex?: string | null
    skuSuffix?: string | null
    displayOrder?: number
    isActive?: boolean
  }) {
    const model = await prisma.masterCatalogPhoneModel.findUnique({ where: { id: modelId } })
    if (!model) throw new AppError('Phone model not found', 404)
    const storage = body.storage.trim()
    const colorName = body.colorName.trim()
    if (!storage || !colorName) throw new AppError('Storage and color are required', 400)
    const dup = await prisma.masterCatalogPhoneVariant.findUnique({
      where: { modelId_storage_colorName: { modelId, storage, colorName } },
    })
    if (dup) throw new AppError('Variant already exists', 409)
    return prisma.masterCatalogPhoneVariant.create({
      data: {
        modelId,
        storage,
        colorName,
        colorHex: body.colorHex ?? null,
        skuSuffix: body.skuSuffix ?? null,
        displayOrder: body.displayOrder ?? 0,
        isActive: body.isActive ?? true,
      },
    })
  },

  async updateVariant(id: string, body: Partial<{
    storage: string
    colorName: string
    colorHex: string | null
    skuSuffix: string | null
    displayOrder: number
    isActive: boolean
  }>) {
    const row = await prisma.masterCatalogPhoneVariant.findUnique({ where: { id } })
    if (!row) throw new AppError('Variant not found', 404)
    const data: Record<string, unknown> = {}
    if (body.storage !== undefined) data.storage = body.storage.trim()
    if (body.colorName !== undefined) data.colorName = body.colorName.trim()
    if (body.colorHex !== undefined) data.colorHex = body.colorHex
    if (body.skuSuffix !== undefined) data.skuSuffix = body.skuSuffix
    if (body.displayOrder !== undefined) data.displayOrder = body.displayOrder
    if (body.isActive !== undefined) data.isActive = body.isActive
    return prisma.masterCatalogPhoneVariant.update({ where: { id }, data })
  },

  async deleteVariant(id: string) {
    const row = await prisma.masterCatalogPhoneVariant.findUnique({ where: { id } })
    if (!row) throw new AppError('Variant not found', 404)
    await prisma.masterCatalogPhoneVariant.delete({ where: { id } })
    return { id }
  },

  /* ── Accessories ── */
  listAccessories(opts?: {
    activeOnly?: boolean
    categoryId?: string
    brandId?: string
    search?: string
  }) {
    const where: Record<string, unknown> = {}
    if (opts?.activeOnly) where.isActive = true
    if (opts?.categoryId) where.categoryId = opts.categoryId
    if (opts?.brandId) where.brandId = opts.brandId
    if (opts?.search?.trim()) {
      where.OR = [
        { name: { contains: opts.search.trim(), mode: 'insensitive' } },
        { modelOptional: { contains: opts.search.trim(), mode: 'insensitive' } },
      ]
    }
    return prisma.masterCatalogAccessory.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
    })
  },

  async createAccessory(body: {
    categoryId: string
    brandId?: string | null
    name: string
    modelOptional?: string | null
    displayOrder?: number
    isActive?: boolean
  }) {
    const name = body.name.trim()
    if (!name) throw new AppError('Accessory name is required', 400)
    const category = await prisma.masterCatalogCategory.findUnique({ where: { id: body.categoryId } })
    if (!category) throw new AppError('Category not found', 404)
    if (body.brandId) {
      const brand = await prisma.masterCatalogBrand.findUnique({ where: { id: body.brandId } })
      if (!brand) throw new AppError('Brand not found', 404)
    }
    const brandId = body.brandId ?? null
    const dup = await prisma.masterCatalogAccessory.findFirst({
      where: { categoryId: body.categoryId, name, brandId },
    })
    if (dup) throw new AppError('Accessory already exists', 409)
    return prisma.masterCatalogAccessory.create({
      data: {
        categoryId: body.categoryId,
        brandId,
        name,
        modelOptional: body.modelOptional?.trim() || null,
        displayOrder: body.displayOrder ?? 0,
        isActive: body.isActive ?? true,
      },
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
    })
  },

  async updateAccessory(id: string, body: Partial<{
    categoryId: string
    brandId: string | null
    name: string
    modelOptional: string | null
    displayOrder: number
    isActive: boolean
  }>) {
    const row = await prisma.masterCatalogAccessory.findUnique({ where: { id } })
    if (!row) throw new AppError('Accessory not found', 404)
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name.trim()
    if (body.categoryId !== undefined) data.categoryId = body.categoryId
    if (body.brandId !== undefined) data.brandId = body.brandId
    if (body.modelOptional !== undefined) data.modelOptional = body.modelOptional
    if (body.displayOrder !== undefined) data.displayOrder = body.displayOrder
    if (body.isActive !== undefined) data.isActive = body.isActive
    return prisma.masterCatalogAccessory.update({
      where: { id },
      data,
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
    })
  },

  async deleteAccessory(id: string) {
    const row = await prisma.masterCatalogAccessory.findUnique({ where: { id } })
    if (!row) throw new AppError('Accessory not found', 404)
    await prisma.masterCatalogAccessory.delete({ where: { id } })
    return { id }
  },
}
