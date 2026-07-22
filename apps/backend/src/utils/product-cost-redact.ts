import { Request } from 'express'
import { canViewModule } from '../modules/tenants/role-permissions.util'

/** Strip buying/cost prices when the actor lacks PRODUCT_COST view. */
export function canSeeProductCost(req: Request): boolean {
  const role = req.user?.role
  if (!role || role === 'OWNER' || role === 'PLATFORM_ADMIN') return true
  const matrix = req.rolePermissionMatrix
  if (!matrix) return false
  return canViewModule(matrix, role, 'PRODUCT_COST')
}

function redactVariations(storageVariations: unknown): unknown {
  if (!Array.isArray(storageVariations)) return storageVariations
  return storageVariations.map((v) => {
    if (!v || typeof v !== 'object') return v
    const { costPrice: _c, buyingPrice: _b, ...rest } = v as Record<string, unknown>
    return rest
  })
}

export function redactProductCost<T>(req: Request, product: T): T {
  if (canSeeProductCost(req) || !product || typeof product !== 'object') return product
  const p = product as Record<string, unknown>
  const { buyingPrice: _bp, ...rest } = p
  return {
    ...rest,
    storageVariations: redactVariations(p.storageVariations),
  } as T
}

export function redactProductCostList<T>(req: Request, products: T[]): T[] {
  if (canSeeProductCost(req)) return products
  return products.map((p) => redactProductCost(req, p))
}
