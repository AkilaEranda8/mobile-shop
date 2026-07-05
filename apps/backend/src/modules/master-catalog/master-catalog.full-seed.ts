import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { slugify } from './master-catalog.util'

type StorageTier = 'budget' | 'mid' | 'flagship'

const PHONE_BRANDS = [
  'Apple', 'Samsung', 'Xiaomi', 'Redmi', 'POCO', 'Realme', 'Vivo', 'Oppo',
  'Honor', 'Google Pixel', 'Motorola', 'Nothing', 'OnePlus', 'Nokia', 'Huawei',
]

const EXTRA_BRANDS = ['Sony', 'JBL', 'Anker', 'SanDisk']

const ACCESSORY_CATEGORIES = [
  'Chargers', 'Cables', 'Power Banks', 'Earbuds', 'Headphones', 'Bluetooth Speakers',
  'Cases', 'Tempered Glass', 'Camera Lens Protectors', 'Car Chargers', 'Adapters',
  'Memory Cards', 'Flash Drives', 'Phone Holders', 'Ring Holders', 'Smart Watches', 'Smart Bands',
]

const STORAGE_BY_TIER: Record<StorageTier, string[]> = {
  budget: ['64GB', '128GB'],
  mid: ['128GB', '256GB'],
  flagship: ['256GB', '512GB', '1TB'],
}

const COLORS = [
  { name: 'Black', hex: '#1a1a1a' },
  { name: 'White', hex: '#f5f5f5' },
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Silver', hex: '#c0c0c0' },
  { name: 'Green', hex: '#16a34a' },
  { name: 'Purple', hex: '#7c3aed' },
  { name: 'Gray', hex: '#6b7280' },
  { name: 'Gold', hex: '#ca8a04' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Natural Titanium', hex: '#a8a29e' },
]

const PHONE_MODELS: Record<string, Array<{ name: string; tier: StorageTier; year: number }>> = {
  Samsung: [
    { name: 'Galaxy A16', tier: 'budget', year: 2025 },
    { name: 'Galaxy A26', tier: 'budget', year: 2025 },
    { name: 'Galaxy A36', tier: 'mid', year: 2025 },
    { name: 'Galaxy A56', tier: 'mid', year: 2025 },
    { name: 'Galaxy S25', tier: 'flagship', year: 2025 },
    { name: 'Galaxy S25+', tier: 'flagship', year: 2025 },
    { name: 'Galaxy S25 Ultra', tier: 'flagship', year: 2025 },
    { name: 'Galaxy Z Flip6', tier: 'flagship', year: 2024 },
    { name: 'Galaxy Z Fold6', tier: 'flagship', year: 2024 },
  ],
  Apple: [
    { name: 'iPhone 15', tier: 'mid', year: 2023 },
    { name: 'iPhone 15 Plus', tier: 'mid', year: 2023 },
    { name: 'iPhone 15 Pro', tier: 'flagship', year: 2023 },
    { name: 'iPhone 15 Pro Max', tier: 'flagship', year: 2023 },
    { name: 'iPhone 16', tier: 'mid', year: 2024 },
    { name: 'iPhone 16 Plus', tier: 'mid', year: 2024 },
    { name: 'iPhone 16 Pro', tier: 'flagship', year: 2024 },
    { name: 'iPhone 16 Pro Max', tier: 'flagship', year: 2024 },
  ],
  Xiaomi: [
    { name: 'Xiaomi 14', tier: 'flagship', year: 2024 },
    { name: 'Xiaomi 14T', tier: 'mid', year: 2024 },
    { name: 'Redmi Note 14 Pro', tier: 'mid', year: 2025 },
  ],
  Redmi: [
    { name: 'Redmi 14C', tier: 'budget', year: 2024 },
    { name: 'Redmi Note 13', tier: 'mid', year: 2024 },
    { name: 'Redmi Note 14', tier: 'mid', year: 2025 },
  ],
  POCO: [
    { name: 'POCO X6 Pro', tier: 'mid', year: 2024 },
    { name: 'POCO F6', tier: 'mid', year: 2024 },
    { name: 'POCO M6', tier: 'budget', year: 2024 },
  ],
  Realme: [
    { name: 'Realme 12 Pro', tier: 'mid', year: 2024 },
    { name: 'Realme C67', tier: 'budget', year: 2024 },
    { name: 'Realme GT 6', tier: 'flagship', year: 2024 },
  ],
  Vivo: [
    { name: 'Vivo V30', tier: 'mid', year: 2024 },
    { name: 'Vivo Y28', tier: 'budget', year: 2024 },
    { name: 'Vivo X100 Pro', tier: 'flagship', year: 2024 },
  ],
  Oppo: [
    { name: 'Oppo Reno 12', tier: 'mid', year: 2024 },
    { name: 'Oppo A60', tier: 'budget', year: 2024 },
    { name: 'Oppo Find X7', tier: 'flagship', year: 2024 },
  ],
  Honor: [
    { name: 'Honor 200', tier: 'mid', year: 2024 },
    { name: 'Honor X9b', tier: 'budget', year: 2024 },
    { name: 'Honor Magic 6 Pro', tier: 'flagship', year: 2024 },
  ],
  'Google Pixel': [
    { name: 'Pixel 8a', tier: 'mid', year: 2024 },
    { name: 'Pixel 9', tier: 'mid', year: 2024 },
    { name: 'Pixel 9 Pro', tier: 'flagship', year: 2024 },
    { name: 'Pixel 9 Pro XL', tier: 'flagship', year: 2024 },
  ],
  Motorola: [
    { name: 'Moto G54', tier: 'budget', year: 2023 },
    { name: 'Moto G84', tier: 'mid', year: 2023 },
    { name: 'Edge 50 Pro', tier: 'mid', year: 2024 },
  ],
  Nothing: [
    { name: 'Phone (2a)', tier: 'mid', year: 2024 },
    { name: 'Phone (2)', tier: 'mid', year: 2023 },
    { name: 'Phone (3)', tier: 'flagship', year: 2025 },
  ],
  OnePlus: [
    { name: 'OnePlus Nord CE 4', tier: 'mid', year: 2024 },
    { name: 'OnePlus 12', tier: 'flagship', year: 2024 },
    { name: 'OnePlus 12R', tier: 'mid', year: 2024 },
  ],
  Nokia: [
    { name: 'Nokia G42', tier: 'budget', year: 2023 },
    { name: 'Nokia X30', tier: 'mid', year: 2023 },
  ],
  Huawei: [
    { name: 'Huawei Nova 12', tier: 'mid', year: 2024 },
    { name: 'Huawei Pura 70', tier: 'flagship', year: 2024 },
  ],
}

const ACCESSORIES: Array<{ cat: string; brand: string | null; name: string; model?: string | null }> = [
  { cat: 'Chargers', brand: 'Apple', name: '20W USB-C Power Adapter' },
  { cat: 'Chargers', brand: 'Apple', name: 'MagSafe Charger' },
  { cat: 'Chargers', brand: 'Samsung', name: '25W Super Fast Charger' },
  { cat: 'Chargers', brand: 'Samsung', name: '45W Super Fast Charger 2.0' },
  { cat: 'Chargers', brand: 'Xiaomi', name: '33W Fast Charger' },
  { cat: 'Chargers', brand: 'OnePlus', name: '80W SUPERVOOC Charger' },
  { cat: 'Chargers', brand: null, name: 'Universal 18W USB-A Charger' },
  { cat: 'Cables', brand: 'Apple', name: 'USB-C to Lightning Cable (1m)' },
  { cat: 'Cables', brand: 'Apple', name: 'USB-C to USB-C Cable (2m)' },
  { cat: 'Cables', brand: 'Samsung', name: 'USB-C to USB-C Cable (1m)' },
  { cat: 'Cables', brand: null, name: 'Micro USB Cable (1m)' },
  { cat: 'Cables', brand: null, name: 'USB-C to USB-C Cable (1m)' },
  { cat: 'Power Banks', brand: 'Samsung', name: '10000mAh Power Bank' },
  { cat: 'Power Banks', brand: 'Xiaomi', name: '20000mAh Power Bank' },
  { cat: 'Power Banks', brand: null, name: '10000mAh Slim Power Bank' },
  { cat: 'Earbuds', brand: 'Apple', name: 'AirPods (3rd generation)' },
  { cat: 'Earbuds', brand: 'Apple', name: 'AirPods Pro (2nd generation)' },
  { cat: 'Earbuds', brand: 'Samsung', name: 'Galaxy Buds3 Pro' },
  { cat: 'Earbuds', brand: 'Samsung', name: 'Galaxy Buds FE' },
  { cat: 'Earbuds', brand: 'Xiaomi', name: 'Redmi Buds 5 Pro' },
  { cat: 'Earbuds', brand: 'Nothing', name: 'Ear (a)' },
  { cat: 'Headphones', brand: 'Apple', name: 'AirPods Max' },
  { cat: 'Headphones', brand: 'Sony', name: 'WH-1000XM5' },
  { cat: 'Bluetooth Speakers', brand: 'JBL', name: 'Flip 6' },
  { cat: 'Bluetooth Speakers', brand: 'Sony', name: 'SRS-XB13' },
  { cat: 'Cases', brand: 'Apple', name: 'Silicone Case', model: 'iPhone 16' },
  { cat: 'Cases', brand: 'Apple', name: 'Clear Case', model: 'iPhone 16 Pro' },
  { cat: 'Cases', brand: 'Samsung', name: 'Silicone Case', model: 'Galaxy S25' },
  { cat: 'Cases', brand: 'Samsung', name: 'Clear Standing Cover', model: 'Galaxy S25 Ultra' },
  { cat: 'Cases', brand: null, name: 'Generic TPU Case' },
  { cat: 'Tempered Glass', brand: 'Apple', name: 'Tempered Glass', model: 'iPhone 16' },
  { cat: 'Tempered Glass', brand: 'Samsung', name: 'Tempered Glass', model: 'Galaxy S25' },
  { cat: 'Tempered Glass', brand: null, name: 'Universal Tempered Glass' },
  { cat: 'Camera Lens Protectors', brand: 'Samsung', name: 'Lens Protector', model: 'Galaxy S25 Ultra' },
  { cat: 'Camera Lens Protectors', brand: null, name: 'Camera Lens Protector Set' },
  { cat: 'Car Chargers', brand: null, name: 'Dual USB Car Charger' },
  { cat: 'Car Chargers', brand: 'Anker', name: '36W Dual Port Car Charger' },
  { cat: 'Adapters', brand: 'Apple', name: 'Lightning to 3.5mm Adapter' },
  { cat: 'Adapters', brand: null, name: 'USB-C to 3.5mm Adapter' },
  { cat: 'Adapters', brand: null, name: 'USB-C to HDMI Adapter' },
  { cat: 'Memory Cards', brand: 'SanDisk', name: '128GB microSDXC' },
  { cat: 'Memory Cards', brand: 'Samsung', name: '256GB microSDXC EVO Plus' },
  { cat: 'Flash Drives', brand: 'SanDisk', name: '64GB USB 3.0 Flash Drive' },
  { cat: 'Phone Holders', brand: null, name: 'Dashboard Phone Holder' },
  { cat: 'Phone Holders', brand: null, name: 'Magnetic Car Mount' },
  { cat: 'Ring Holders', brand: null, name: 'Metal Ring Holder' },
  { cat: 'Ring Holders', brand: null, name: 'MagSafe Ring Stand' },
  { cat: 'Smart Watches', brand: 'Apple', name: 'Apple Watch Series 10' },
  { cat: 'Smart Watches', brand: 'Samsung', name: 'Galaxy Watch 7' },
  { cat: 'Smart Watches', brand: 'Xiaomi', name: 'Redmi Watch 4' },
  { cat: 'Smart Bands', brand: 'Xiaomi', name: 'Mi Band 8' },
  { cat: 'Smart Bands', brand: 'Samsung', name: 'Galaxy Fit 3' },
  { cat: 'Smart Bands', brand: 'Huawei', name: 'Band 9' },
]

export interface FullSeedSummary {
  message: string
  categoriesAdded: number
  brandsAdded: number
  modelsAdded: number
  variantsAdded: number
  accessoriesAdded: number
  totals: { categories: number; brands: number; models: number; accessories: number }
}

export async function seedFullMasterCatalog(): Promise<FullSeedSummary> {
  const summary = {
    categoriesAdded: 0,
    brandsAdded: 0,
    modelsAdded: 0,
    variantsAdded: 0,
    accessoriesAdded: 0,
  }

  const categoryMap = new Map<string, string>()
  const existingCats = await prisma.masterCatalogCategory.findMany()
  for (const c of existingCats) categoryMap.set(c.name, c.id)

  async function ensureCategory(name: string, displayOrder: number): Promise<string> {
    const hit = categoryMap.get(name)
    if (hit) return hit
    const row = await prisma.masterCatalogCategory.create({
      data: { name, slug: slugify(name), displayOrder },
    })
    categoryMap.set(name, row.id)
    summary.categoriesAdded++
    return row.id
  }

  const mobileId = await ensureCategory('Mobile Phones', 1)
  for (let i = 0; i < ACCESSORY_CATEGORIES.length; i++) {
    await ensureCategory(ACCESSORY_CATEGORIES[i], i + 2)
  }

  const brandMap = new Map<string, string>()
  const existingBrands = await prisma.masterCatalogBrand.findMany()
  for (const b of existingBrands) brandMap.set(b.name, b.id)

  const allBrandNames = [...PHONE_BRANDS, ...EXTRA_BRANDS.filter(b => !PHONE_BRANDS.includes(b))]
  for (let i = 0; i < allBrandNames.length; i++) {
    const name = allBrandNames[i]
    if (brandMap.has(name)) continue
    const row = await prisma.masterCatalogBrand.create({
      data: { name, type: 'BOTH', displayOrder: i + 1 },
    })
    brandMap.set(name, row.id)
    summary.brandsAdded++
  }

  for (const [brandName, models] of Object.entries(PHONE_MODELS)) {
    const brandId = brandMap.get(brandName)
    if (!brandId) continue
    const r = await seedModelsForBrandId(brandId, brandName, models, mobileId)
    summary.modelsAdded += r.modelsAdded
    summary.variantsAdded += r.variantsAdded
  }

  const existingAcc = await prisma.masterCatalogAccessory.findMany()
  const accKey = (categoryId: string, brandId: string | null, name: string, model?: string | null) =>
    `${categoryId}|${brandId ?? ''}|${name}|${model ?? ''}`
  const accSet = new Set(
    existingAcc.map(a => accKey(a.categoryId, a.brandId, a.name, a.modelOptional)),
  )
  const accOrder: Record<string, number> = {}

  for (const item of ACCESSORIES) {
    const categoryId = categoryMap.get(item.cat)
    if (!categoryId) continue
    const brandId = item.brand ? brandMap.get(item.brand) ?? null : null
    const key = accKey(categoryId, brandId, item.name, item.model)
    if (accSet.has(key)) continue
    accOrder[item.cat] = (accOrder[item.cat] ?? 0) + 1
    await prisma.masterCatalogAccessory.create({
      data: {
        categoryId,
        brandId,
        name: item.name,
        modelOptional: item.model ?? null,
        displayOrder: accOrder[item.cat],
      },
    })
    accSet.add(key)
    summary.accessoriesAdded++
  }

  const [catCount, brandCount, modelCount, accCount] = await Promise.all([
    prisma.masterCatalogCategory.count(),
    prisma.masterCatalogBrand.count(),
    prisma.masterCatalogPhoneModel.count(),
    prisma.masterCatalogAccessory.count(),
  ])

  return {
    message: 'Full catalog loaded successfully',
    ...summary,
    totals: {
      categories: catCount,
      brands: brandCount,
      models: modelCount,
      accessories: accCount,
    },
  }
}

export function listDefaultPhoneBrandNames(): string[] {
  return Object.keys(PHONE_MODELS)
}

function resolveDefaultBrandModels(brandName: string) {
  const key = Object.keys(PHONE_MODELS).find(k => k.toLowerCase() === brandName.trim().toLowerCase())
  return key ? { key, models: PHONE_MODELS[key] } : null
}

export interface BrandModelsSeedSummary {
  message: string
  brandName: string
  modelsAdded: number
  variantsAdded: number
  totalModelsForBrand: number
}

async function seedModelsForBrandId(
  brandId: string,
  brandName: string,
  models: Array<{ name: string; tier: StorageTier; year: number }>,
  mobileCategoryId: string,
): Promise<{ modelsAdded: number; variantsAdded: number }> {
  const result = { modelsAdded: 0, variantsAdded: 0 }
  const existingModels = await prisma.masterCatalogPhoneModel.findMany({
    where: { brandId },
    include: { variants: true },
  })
  const modelKey = (name: string) => `${brandId}|${name}`
  const modelMap = new Map<string, { id: string; variants: Set<string> }>()
  for (const m of existingModels) {
    modelMap.set(modelKey(m.name), {
      id: m.id,
      variants: new Set(m.variants.map(v => `${v.storage}|${v.colorName}`)),
    })
  }

  for (let order = 0; order < models.length; order++) {
    const { name, tier, year } = models[order]
    const key = modelKey(name)
    let entry = modelMap.get(key)
    if (!entry) {
      const row = await prisma.masterCatalogPhoneModel.create({
        data: {
          brandId,
          categoryId: mobileCategoryId,
          name,
          releaseYear: year,
          displayOrder: order + 1,
          trackImei: true,
          defaultWarrantyMonths: 12,
        },
      })
      entry = { id: row.id, variants: new Set() }
      modelMap.set(key, entry)
      result.modelsAdded++
    }

    const storages = STORAGE_BY_TIER[tier] ?? STORAGE_BY_TIER.mid
    const colors = tier === 'budget' ? COLORS.slice(0, 6) : COLORS.slice(0, 8)
    let varOrder = entry.variants.size + 1
    for (const storage of storages) {
      for (const color of colors) {
        const vk = `${storage}|${color.name}`
        if (entry.variants.has(vk)) continue
        await prisma.masterCatalogPhoneVariant.create({
          data: {
            modelId: entry.id,
            storage,
            colorName: color.name,
            colorHex: color.hex,
            displayOrder: varOrder++,
          },
        })
        entry.variants.add(vk)
        result.variantsAdded++
      }
    }
  }

  return result
}

export async function seedBrandPhoneModels(brandId: string): Promise<BrandModelsSeedSummary> {
  const brand = await prisma.masterCatalogBrand.findUnique({ where: { id: brandId } })
  if (!brand) throw new AppError('Brand not found', 404)

  const resolved = resolveDefaultBrandModels(brand.name)
  if (!resolved) {
    throw new AppError(
      `No default models for "${brand.name}". Use exact names like: ${listDefaultPhoneBrandNames().join(', ')}`,
      400,
    )
  }

  let mobileCat = await prisma.masterCatalogCategory.findFirst({ where: { name: 'Mobile Phones' } })
  if (!mobileCat) {
    mobileCat = await prisma.masterCatalogCategory.create({
      data: { name: 'Mobile Phones', slug: slugify('Mobile Phones'), displayOrder: 1 },
    })
  }

  const { modelsAdded, variantsAdded } = await seedModelsForBrandId(
    brandId,
    brand.name,
    resolved.models,
    mobileCat.id,
  )

  const totalModelsForBrand = await prisma.masterCatalogPhoneModel.count({ where: { brandId } })

  return {
    message: modelsAdded || variantsAdded
      ? `Loaded models for ${brand.name}`
      : `All default models for ${brand.name} already exist`,
    brandName: brand.name,
    modelsAdded,
    variantsAdded,
    totalModelsForBrand,
  }
}
