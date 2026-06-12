import { getMeta, setMeta } from './db'

const PRODUCTS_KEY = 'products'
const CATEGORIES_KEY = 'categories'

export async function cacheProductsForOffline(products: unknown[]): Promise<void> {
  if (!products.length) return
  await setMeta(PRODUCTS_KEY, products)
}

export async function getCachedProducts(): Promise<unknown[]> {
  const data = await getMeta<unknown[]>(PRODUCTS_KEY)
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
