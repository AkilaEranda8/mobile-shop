import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { productsService } from '../products/products.service'
import { skuPart } from './master-catalog.util'
import type { z } from 'zod'
import type { importFromMasterSchema } from './master-catalog.schema'

type ImportBody = z.infer<typeof importFromMasterSchema>

export interface ImportSummary {
  categoriesCreated: number
  brandsCreated: number
  productsCreated: number
  duplicatesSkipped: number
  errors: Array<{ itemId: string; reason: string }>
}

async function ensureTenantCategory(
  tenantId: string,
  name: string,
  cache: Map<string, { id: string; created: boolean }>,
): Promise<{ id: string; created: boolean }> {
  const key = name.toLowerCase()
  const hit = cache.get(key)
  if (hit) return hit
  let row = await prisma.category.findFirst({ where: { tenantId, name } })
  let created = false
  if (!row) {
    row = await prisma.category.create({
      data: { tenantId, name, slug: name.toLowerCase().replace(/\s+/g, '-') },
    })
    created = true
  }
  const result = { id: row.id, created }
  cache.set(key, result)
  return result
}

async function ensureTenantBrand(
  tenantId: string,
  name: string,
  cache: Map<string, { id: string; created: boolean }>,
): Promise<{ id: string; created: boolean }> {
  const key = name.toLowerCase()
  const hit = cache.get(key)
  if (hit) return hit
  let row = await prisma.brand.findFirst({ where: { tenantId, name } })
  let created = false
  if (!row) {
    row = await prisma.brand.create({ data: { tenantId, name } })
    created = true
  }
  const result = { id: row.id, created }
  cache.set(key, result)
  return result
}

function buildPhoneSku(brandName: string, modelName: string): string {
  return `MC-${skuPart(brandName)}-${skuPart(modelName)}`.slice(0, 80)
}

function buildAccessorySku(categoryName: string, name: string, brandName?: string | null): string {
  const parts = ['MC', skuPart(categoryName), brandName ? skuPart(brandName) : 'GEN', skuPart(name)]
  return parts.filter(Boolean).join('-').slice(0, 80)
}

export const masterCatalogImportService = {
  async importToTenant(tenantId: string, body: ImportBody): Promise<ImportSummary> {
    const defaults = {
      buyingPrice: body.defaults?.buyingPrice ?? 0,
      sellingPrice: body.defaults?.sellingPrice ?? 0,
      stock: body.defaults?.stock ?? 0,
    }

    let branchId = body.branchId
    if (!branchId) {
      const branch = await prisma.branch.findFirst({
        where: { tenantId, isActive: true },
        orderBy: [{ isDefault: 'desc' }, { isHeadquarters: 'desc' }, { createdAt: 'asc' }],
      })
      if (!branch) throw new AppError('No branch found for tenant', 400)
      branchId = branch.id
    }

    const categoryCache = new Map<string, { id: string; created: boolean }>()
    const brandCache = new Map<string, { id: string; created: boolean }>()

    const existing = await prisma.product.findMany({
      where: { tenantId, isActive: true },
      select: { sku: true, name: true, brandId: true, categoryId: true },
    })
    const skuSet = new Set(existing.map(p => p.sku))
    const productKeySet = new Set(existing.map(p => `${p.name.toLowerCase()}|${p.brandId}|${p.categoryId}`))

    const summary: ImportSummary = {
      categoriesCreated: 0,
      brandsCreated: 0,
      productsCreated: 0,
      duplicatesSkipped: 0,
      errors: [],
    }

    const countCategory = (c: { created: boolean }) => { if (c.created) summary.categoriesCreated++ }
    const countBrand = (b: { created: boolean }) => { if (b.created) summary.brandsCreated++ }

    for (const item of body.items) {
      try {
        if (item.type === 'PHONE') {
          const model = await prisma.masterCatalogPhoneModel.findFirst({
            where: { id: item.modelId, isActive: true },
            include: {
              brand: true,
              category: true,
              variants: {
                where: { isActive: true },
                orderBy: [{ displayOrder: 'asc' }],
              },
            },
          })
          if (!model) {
            summary.errors.push({ itemId: item.modelId, reason: 'Phone model not found or inactive' })
            continue
          }

          const selectedVariants = item.variantIds?.length
            ? model.variants.filter(v => item.variantIds!.includes(v.id))
            : model.variants

          const cat = await ensureTenantCategory(tenantId, model.category.name, categoryCache)
          countCategory(cat)
          const br = await ensureTenantBrand(tenantId, model.brand.name, brandCache)
          countBrand(br)

          const productName = `${model.brand.name} ${model.name}`.trim()
          const dupKey = `${productName.toLowerCase()}|${br.id}|${cat.id}`
          const sku = buildPhoneSku(model.brand.name, model.name)

          if (skuSet.has(sku) || productKeySet.has(dupKey)) {
            summary.duplicatesSkipped++
            continue
          }

          const storageVariations = selectedVariants.map(v => ({
            storage: v.storage,
            colorName: v.colorName,
            colorHex: v.colorHex ?? undefined,
            sku: v.skuSuffix ? `${sku}-${skuPart(v.skuSuffix)}` : undefined,
            stock: 0,
            sellingPrice: defaults.sellingPrice,
            costPrice: defaults.buyingPrice,
          }))

          const colorVariations = selectedVariants.map(v => ({
            name: v.colorName,
            hex: v.colorHex ?? '#1a1a1a',
          }))

          await productsService.create(tenantId, {
            name: productName,
            sku,
            brandName: model.brand.name,
            categoryName: model.category.name,
            deviceModel: model.name,
            buyingPrice: defaults.buyingPrice,
            sellingPrice: defaults.sellingPrice,
            mrp: defaults.sellingPrice,
            stock: defaults.stock,
            minStock: 5,
            trackImei: model.trackImei,
            warrantyMonths: model.defaultWarrantyMonths,
            branchId,
            isActive: true,
            condition: 'BRAND_NEW',
            storageVariations: storageVariations.length ? storageVariations : undefined,
            colorVariations: colorVariations.length ? colorVariations : undefined,
          })

          skuSet.add(sku)
          productKeySet.add(dupKey)
          summary.productsCreated++
        } else {
          const acc = await prisma.masterCatalogAccessory.findFirst({
            where: { id: item.accessoryId, isActive: true },
            include: { category: true, brand: true },
          })
          if (!acc) {
            summary.errors.push({ itemId: item.accessoryId, reason: 'Accessory not found or inactive' })
            continue
          }

          const cat = await ensureTenantCategory(tenantId, acc.category.name, categoryCache)
          countCategory(cat)
          const brandName = acc.brand?.name ?? 'General'
          const br = await ensureTenantBrand(tenantId, brandName, brandCache)
          countBrand(br)

          const productName = acc.modelOptional
            ? `${acc.name} (${acc.modelOptional})`
            : acc.name
          const dupKey = `${productName.toLowerCase()}|${br.id}|${cat.id}`
          const sku = buildAccessorySku(acc.category.name, acc.name, acc.brand?.name)

          if (skuSet.has(sku) || productKeySet.has(dupKey)) {
            summary.duplicatesSkipped++
            continue
          }

          await productsService.create(tenantId, {
            name: productName,
            sku,
            brandName,
            categoryName: acc.category.name,
            deviceModel: acc.modelOptional ?? undefined,
            buyingPrice: defaults.buyingPrice,
            sellingPrice: defaults.sellingPrice,
            mrp: defaults.sellingPrice,
            stock: defaults.stock,
            minStock: 5,
            trackImei: false,
            warrantyMonths: 0,
            branchId,
            isActive: true,
            condition: 'BRAND_NEW',
          })

          skuSet.add(sku)
          productKeySet.add(dupKey)
          summary.productsCreated++
        }
      } catch (e: unknown) {
        const itemId = item.type === 'PHONE' ? item.modelId : item.accessoryId
        summary.errors.push({
          itemId,
          reason: e instanceof AppError ? e.message : (e as Error)?.message ?? 'Import failed',
        })
      }
    }

    return summary
  },
}
