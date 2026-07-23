/**
 * Demo seed TEMPLATES — live outside the tenant DB.
 * Copied into the tenant on register; IDs stored in Tenant.demoDataManifest for clean removal.
 */

export const DEMO_TEMPLATE_VERSION = 2

export const DEMO_CATEGORIES = [
  { key: 'mobiles', name: 'Mobiles (Demo)', slug: 'demo-mobiles', icon: '📱' },
  { key: 'accessories', name: 'Accessories (Demo)', slug: 'demo-accessories', icon: '🎧' },
] as const

export const DEMO_BRANDS = [
  { key: 'apple', name: 'Apple (Demo)' },
  { key: 'samsung', name: 'Samsung (Demo)' },
] as const

export const DEMO_PRODUCTS = [
  {
    key: 'iphone',
    sku: 'DEMO-IP15PM-256-BLK',
    name: 'iPhone 15 Pro Max 256GB (Demo)',
    categoryKey: 'mobiles',
    brandKey: 'apple',
    buyingPrice: 120000,
    sellingPrice: 145000,
    mrp: 150000,
    trackImei: true,
    warrantyMonths: 12,
    stock: 5,
    minStock: 2,
  },
  {
    key: 'samsung',
    sku: 'DEMO-S24U-256-BLK',
    name: 'Samsung Galaxy S24 Ultra (Demo)',
    categoryKey: 'mobiles',
    brandKey: 'samsung',
    buyingPrice: 95000,
    sellingPrice: 115000,
    mrp: 120000,
    trackImei: true,
    warrantyMonths: 12,
    stock: 8,
    minStock: 2,
  },
  {
    key: 'airpods',
    sku: 'DEMO-AIRPODS-PRO2',
    name: 'AirPods Pro 2 (Demo)',
    categoryKey: 'accessories',
    brandKey: 'apple',
    buyingPrice: 35000,
    sellingPrice: 52000,
    mrp: 55000,
    trackImei: false,
    warrantyMonths: 6,
    stock: 20,
    minStock: 5,
  },
] as const

export const DEMO_CUSTOMERS = [
  {
    key: 'kasun',
    name: 'Kasun Perera (Demo)',
    phone: '0770000001',
    email: 'demo.kasun@example.com',
    city: 'Colombo',
  },
  {
    key: 'nimali',
    name: 'Nimali Fernando (Demo)',
    phone: '0770000002',
    email: 'demo.nimali@example.com',
    city: 'Kandy',
  },
] as const

export const DEMO_SERVICES = [
  {
    key: 'screen',
    name: 'Screen Replacement (Demo)',
    description: 'Sample service — remove with demo data',
    cost: 2000,
    price: 8500,
    category: 'Repair',
  },
  {
    key: 'software',
    name: 'Software Flash (Demo)',
    description: 'Sample service — remove with demo data',
    cost: 500,
    price: 2500,
    category: 'Software',
  },
] as const

export const DEMO_SUPPLIER = {
  key: 'supplier',
  name: 'Demo Supplier Co.',
  contactName: 'Demo Contact',
  phone: '0110000000',
  email: 'demo.supplier@example.com',
  city: 'Colombo',
} as const

export const DEMO_STAFF = [
  {
    key: 'cashier',
    name: 'Demo Cashier',
    role: 'CASHIER' as const,
    emailPrefix: 'demo.cashier',
  },
  {
    key: 'tech',
    name: 'Demo Technician',
    role: 'TECHNICIAN' as const,
    emailPrefix: 'demo.tech',
  },
] as const

/** Password for all demo staff accounts */
export const DEMO_STAFF_PASSWORD = 'Demo@1234'

export type DemoDataManifest = {
  version: number
  installedAt: string
  categoryIds: string[]
  brandIds: string[]
  productIds: string[]
  customerIds: string[]
  serviceIds: string[]
  supplierIds: string[]
  userIds: string[]
  imeiIds: string[]
  saleIds: string[]
  repairIds: string[]
  warrantyIds: string[]
  purchaseOrderIds: string[]
  transactionIds: string[]
  courierIds: string[]
  deliveryOrderIds: string[]
  exchangeIds: string[]
  dailyReloadIds: string[]
  profitFundIds: string[]
}

export function emptyDemoManifest(installedAt = new Date().toISOString()): DemoDataManifest {
  return {
    version: DEMO_TEMPLATE_VERSION,
    installedAt,
    categoryIds: [],
    brandIds: [],
    productIds: [],
    customerIds: [],
    serviceIds: [],
    supplierIds: [],
    userIds: [],
    imeiIds: [],
    saleIds: [],
    repairIds: [],
    warrantyIds: [],
    purchaseOrderIds: [],
    transactionIds: [],
    courierIds: [],
    deliveryOrderIds: [],
    exchangeIds: [],
    dailyReloadIds: [],
    profitFundIds: [],
  }
}

/** Normalize older manifests (v1) so clear/install status never crashes. */
export function normalizeDemoManifest(raw: unknown): DemoDataManifest {
  const base = emptyDemoManifest()
  if (!raw || typeof raw !== 'object') return base
  const m = raw as Partial<DemoDataManifest>
  return {
    ...base,
    ...m,
    version: typeof m.version === 'number' ? m.version : 1,
    installedAt: m.installedAt || base.installedAt,
    categoryIds: m.categoryIds ?? [],
    brandIds: m.brandIds ?? [],
    productIds: m.productIds ?? [],
    customerIds: m.customerIds ?? [],
    serviceIds: m.serviceIds ?? [],
    supplierIds: m.supplierIds ?? [],
    userIds: m.userIds ?? [],
    imeiIds: m.imeiIds ?? [],
    saleIds: m.saleIds ?? [],
    repairIds: m.repairIds ?? [],
    warrantyIds: m.warrantyIds ?? [],
    purchaseOrderIds: m.purchaseOrderIds ?? [],
    transactionIds: m.transactionIds ?? [],
    courierIds: m.courierIds ?? [],
    deliveryOrderIds: m.deliveryOrderIds ?? [],
    exchangeIds: m.exchangeIds ?? [],
    dailyReloadIds: m.dailyReloadIds ?? [],
    profitFundIds: m.profitFundIds ?? [],
  }
}
