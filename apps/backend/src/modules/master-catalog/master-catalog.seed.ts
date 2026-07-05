import { prisma } from '../../config/database'
import { slugify } from './master-catalog.util'

const PHONE_BRANDS = [
  'Apple', 'Samsung', 'Xiaomi', 'Redmi', 'POCO', 'Realme', 'Vivo', 'Oppo',
  'Honor', 'Google Pixel', 'Motorola', 'Nothing', 'OnePlus', 'Nokia', 'Huawei',
]

const ACCESSORY_CATEGORIES = [
  'Chargers', 'Cables', 'Power Banks', 'Earbuds', 'Headphones', 'Bluetooth Speakers',
  'Cases', 'Tempered Glass', 'Camera Lens Protectors', 'Car Chargers', 'Adapters',
  'Memory Cards', 'Flash Drives', 'Phone Holders', 'Ring Holders', 'Smart Watches', 'Smart Bands',
]

const STORAGE_OPTS = ['64GB', '128GB', '256GB', '512GB', '1TB']
const COLOR_OPTS = [
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

const SAMSUNG_MODELS = [
  'Galaxy A16', 'Galaxy A26', 'Galaxy A36', 'Galaxy A56',
  'Galaxy S25', 'Galaxy S25+', 'Galaxy S25 Ultra',
]

export async function seedMasterCatalog(): Promise<{ message: string }> {
  const existing = await prisma.masterCatalogCategory.count()
  if (existing > 0) {
    return { message: 'Master catalog already seeded' }
  }

  const mobilePhones = await prisma.masterCatalogCategory.create({
    data: { name: 'Mobile Phones', slug: slugify('Mobile Phones'), displayOrder: 1 },
  })

  let order = 2
  const accessoryCategoryMap = new Map<string, string>()
  for (const name of ACCESSORY_CATEGORIES) {
    const row = await prisma.masterCatalogCategory.create({
      data: { name, slug: slugify(name), displayOrder: order++ },
    })
    accessoryCategoryMap.set(name, row.id)
  }

  let brandOrder = 1
  const brandMap = new Map<string, string>()
  for (const name of PHONE_BRANDS) {
    const row = await prisma.masterCatalogBrand.create({
      data: { name, type: 'BOTH', displayOrder: brandOrder++ },
    })
    brandMap.set(name, row.id)
  }

  const samsungId = brandMap.get('Samsung')!
  let modelOrder = 1
  for (const name of SAMSUNG_MODELS) {
    const model = await prisma.masterCatalogPhoneModel.create({
      data: {
        brandId: samsungId,
        categoryId: mobilePhones.id,
        name,
        releaseYear: 2025,
        displayOrder: modelOrder++,
        trackImei: true,
        defaultWarrantyMonths: 12,
      },
    })
    let varOrder = 1
    for (const storage of STORAGE_OPTS.slice(1, 4)) {
      for (const color of COLOR_OPTS.slice(0, 4)) {
        await prisma.masterCatalogPhoneVariant.create({
          data: {
            modelId: model.id,
            storage,
            colorName: color.name,
            colorHex: color.hex,
            displayOrder: varOrder++,
          },
        })
      }
    }
  }

  const appleId = brandMap.get('Apple')!
  await prisma.masterCatalogAccessory.createMany({
    data: [
      { categoryId: accessoryCategoryMap.get('Chargers')!, brandId: appleId, name: '20W USB-C Power Adapter', displayOrder: 1 },
      { categoryId: accessoryCategoryMap.get('Earbuds')!, brandId: appleId, name: 'AirPods Pro', displayOrder: 1 },
      { categoryId: accessoryCategoryMap.get('Cases')!, brandId: appleId, name: 'Silicone Case', modelOptional: 'iPhone 15', displayOrder: 1 },
      { categoryId: accessoryCategoryMap.get('Tempered Glass')!, brandId: samsungId, name: 'Tempered Glass', modelOptional: 'Galaxy S25', displayOrder: 1 },
    ],
  })

  return { message: 'Master catalog seeded successfully' }
}
