import { Request } from 'express'
import { canViewModule, canEditModule } from '../modules/tenants/role-permissions.util'

/** Strip buying/cost prices when the actor lacks PRODUCT_COST view. */
export function canSeeProductCost(req: Request): boolean {
  const role = req.user?.role
  if (!role || role === 'OWNER' || role === 'PLATFORM_ADMIN') return true
  const matrix = req.rolePermissionMatrix
  if (!matrix) return false
  return canViewModule(matrix, role, 'PRODUCT_COST')
}

export function canEditProductCost(req: Request): boolean {
  const role = req.user?.role
  if (!role || role === 'OWNER' || role === 'PLATFORM_ADMIN') return true
  const matrix = req.rolePermissionMatrix
  if (!matrix) return false
  return canEditModule(matrix, role, 'PRODUCT_COST')
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
  const { buyingPrice: _bp, costPrice: _cp, ...rest } = p
  return {
    ...rest,
    storageVariations: redactVariations(p.storageVariations),
  } as T
}

export function redactProductCostList<T>(req: Request, products: T[]): T[] {
  if (canSeeProductCost(req)) return products
  return products.map((p) => redactProductCost(req, p))
}

/** Repair spare-part inventory buy cost (unitBuyCost). unitCost is customer charge — keep. */
export function redactRepairCost<T>(req: Request, ticket: T): T {
  if (canSeeProductCost(req) || !ticket || typeof ticket !== 'object') return ticket
  const t = ticket as Record<string, unknown>
  if (!Array.isArray(t.spareParts)) return ticket
  return {
    ...t,
    spareParts: t.spareParts.map((part) => {
      if (!part || typeof part !== 'object') return part
      const { unitBuyCost: _u, ...rest } = part as Record<string, unknown>
      return rest
    }),
  } as T
}

export function redactRepairCostList<T>(req: Request, tickets: T[]): T[] {
  if (canSeeProductCost(req)) return tickets
  return tickets.map((t) => redactRepairCost(req, t))
}

/** Sale line COGS (unitCost). */
export function redactSaleCost<T>(req: Request, sale: T): T {
  if (canSeeProductCost(req) || !sale || typeof sale !== 'object') return sale
  const s = sale as Record<string, unknown>
  if (!Array.isArray(s.items)) return sale
  return {
    ...s,
    items: s.items.map((item) => {
      if (!item || typeof item !== 'object') return item
      const { unitCost: _c, ...rest } = item as Record<string, unknown>
      return rest
    }),
  } as T
}

export function redactSaleCostList<T>(req: Request, sales: T[]): T[] {
  if (canSeeProductCost(req)) return sales
  return sales.map((s) => redactSaleCost(req, s))
}

/** PO / invoice line unit costs. */
export function redactPurchaseOrderCost<T>(req: Request, po: T): T {
  if (canSeeProductCost(req) || !po || typeof po !== 'object') return po
  const p = po as Record<string, unknown>
  if (!Array.isArray(p.items)) return po
  return {
    ...p,
    items: p.items.map((item) => {
      if (!item || typeof item !== 'object') return item
      const { unitCost: _u, total: _t, ...rest } = item as Record<string, unknown>
      return rest
    }),
  } as T
}

export function redactPurchaseOrderCostList<T>(req: Request, pos: T[]): T[] {
  if (canSeeProductCost(req)) return pos
  return pos.map((p) => redactPurchaseOrderCost(req, p))
}

/**
 * Drop buying/cost fields from a product write body when the actor lacks PRODUCT_COST edit.
 * Returns a shallow copy — does not mutate the original.
 */
export function stripProductCostWriteFields(req: Request, body: Record<string, unknown>): Record<string, unknown> {
  if (canEditProductCost(req)) return body
  const next: Record<string, unknown> = { ...body }
  delete next.buyingPrice
  delete next.costPrice
  if (Array.isArray(next.storageVariations)) {
    next.storageVariations = next.storageVariations.map((v) => {
      if (!v || typeof v !== 'object') return v
      const { costPrice: _c, buyingPrice: _b, ...rest } = v as Record<string, unknown>
      return rest
    })
  }
  if (Array.isArray(next.variants)) {
    next.variants = next.variants.map((v) => {
      if (!v || typeof v !== 'object') return v
      const { costPrice: _c, buyingPrice: _b, ...rest } = v as Record<string, unknown>
      return rest
    })
  }
  return next
}
