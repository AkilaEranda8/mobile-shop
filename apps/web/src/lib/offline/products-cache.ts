import { getMeta, setMeta } from './db'

const PRODUCTS_KEY_PREFIX = 'products:'
const CATEGORIES_KEY = 'categories'

function productsKey(branchId: string) {
  return `${PRODUCTS_KEY_PREFIX}${branchId}`
}

export async function cacheProductsForOffline(branchId: string, products: unknown[]): Promise<void> {
  if (!branchId || !products.length) return
  await setMeta(productsKey(branchId), products)
}

export async function getCachedProducts(branchId?: string): Promise<unknown[]> {
  if (!branchId) return []
  const data = await getMeta<unknown[]>(productsKey(branchId))
  return Array.isArray(data) ? data : []
}

export async function cacheCategoriesForOffline(categories: unknown[]): Promise<void> {
  if (!categories.length) return
  await setMeta(CATEGORIES_KEY, categories)
}

export async function getCachedCategories(): Promise<{ id: string; name: string }[]> {
  const data = await getMeta<{ id: string; name: string }[]>(CATEGORIES_KEY)
  return Array.isArray(data) ? data : []
}
