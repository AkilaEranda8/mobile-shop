import { AppError } from '../../middleware/error.middleware'
import { isTenantFeatureEnabled } from '../../utils/tenant-feature.util'
import { isPricingEngineEnabled } from './pricing-engine.feature'
import {
  resolveEffectivePriceMode,
  resolveProductCatalogUnitPrice,
} from './pricing-engine.resolve'
import type {
  PriceMode,
  PricingProductSnapshot,
  ResolvedSaleLinePrice,
  ResolveSaleLinePriceInput,
} from './pricing-engine.types'

export function resolveSaleLineUnitPrice(input: ResolveSaleLinePriceInput): ResolvedSaleLinePrice {
  const catalogPrice = resolveProductCatalogUnitPrice(input.product, {
    sku: input.sku,
    variationLabel: input.variationLabel,
    mode: input.mode,
  })
  const client = input.clientUnitPrice != null ? Number(input.clientUnitPrice) : NaN
  if (input.allowManualOverride && Number.isFinite(client) && client >= 0) {
    const overridden = Math.abs(client - catalogPrice) > 0.009
    return {
      unitPrice: client,
      catalogPrice,
      mode: input.mode,
      overridden,
      source: overridden ? 'client_override' : 'catalog',
    }
  }
  return {
    unitPrice: catalogPrice,
    catalogPrice,
    mode: input.mode,
    overridden: false,
    source: 'catalog',
  }
}

export type ApplySalePricingInput = {
  tenantId: string
  priceMode?: PriceMode | string | null
  items: Array<{
    productId?: string | null
    productName?: string
    sku?: string | null
    variationLabel?: string | null
    unitPrice?: number
    quantity?: number
    total?: number
    [key: string]: unknown
  }>
  productsById: Map<string, PricingProductSnapshot>
}

/**
 * When PRICING_ENGINE is ON: normalize product line unit prices from catalog
 * (or allow POS_PRICE_EDIT overrides). Recalculates line totals.
 * Returns null when flag OFF (caller keeps client prices).
 */
export async function applySalePricingIfEnabled(
  input: ApplySalePricingInput,
): Promise<{ items: ApplySalePricingInput['items']; mode: PriceMode } | null> {
  if (!(await isPricingEngineEnabled(input.tenantId))) return null

  const [wholesale, credit, posPriceEdit] = await Promise.all([
    isTenantFeatureEnabled(input.tenantId, 'WHOLESALE_PRICING'),
    isTenantFeatureEnabled(input.tenantId, 'CREDIT_PRICING'),
    isTenantFeatureEnabled(input.tenantId, 'POS_PRICE_EDIT'),
  ])

  const mode = resolveEffectivePriceMode(input.priceMode, { wholesale, credit })

  const items = input.items.map((item) => {
    if (!item.productId) return item
    const product = input.productsById.get(item.productId)
    if (!product) return item

    const resolved = resolveSaleLineUnitPrice({
      product,
      sku: item.sku,
      variationLabel: item.variationLabel,
      mode,
      clientUnitPrice: item.unitPrice,
      allowManualOverride: posPriceEdit,
    })

    const qty = Number(item.quantity) || 0
    const unitPrice = resolved.unitPrice
    return {
      ...item,
      unitPrice,
      total: Math.round(unitPrice * qty * 100) / 100,
    }
  })

  return { items, mode }
}

/** Optional hard validation helper for future strict mode. */
export function assertCatalogPriceMatch(
  productName: string,
  clientUnitPrice: number,
  catalogPrice: number,
  tolerance = 0.5,
): void {
  if (Math.abs(clientUnitPrice - catalogPrice) > tolerance) {
    throw new AppError(
      `Price mismatch for "${productName}". Expected ${catalogPrice}, got ${clientUnitPrice}`,
      400,
    )
  }
}
