import { findVariant, hasVariants, type VariantRow } from '../../utils/product-variants'
import type { PriceMode, PricingCatalogItem, PricingProductSnapshot } from './pricing-engine.types'

/**
 * Resolve retail / wholesale / credit catalog price.
 * Mirrors apps/web/src/lib/productPrice.ts (keep in sync).
 */
export function resolveCatalogPrice(
  item: PricingCatalogItem | null | undefined,
  mode: PriceMode = 'retail',
): number {
  if (!item) return 0
  const retail = Number(item.sellingPrice ?? item.price) || 0
  if (mode === 'wholesale') {
    const wholesale = Number(item.wholesalePrice) || 0
    return wholesale > 0 ? wholesale : retail
  }
  if (mode === 'credit') {
    const credit = Number(item.creditPrice) || 0
    return credit > 0 ? credit : retail
  }
  return retail
}

/** Clamp mode to retail when tenant feature flags disallow wholesale/credit. */
export function resolveEffectivePriceMode(
  mode: PriceMode | string | null | undefined,
  features: { wholesale?: boolean; credit?: boolean },
): PriceMode {
  const m = mode === 'wholesale' || mode === 'credit' ? mode : 'retail'
  if (m === 'wholesale' && !features.wholesale) return 'retail'
  if (m === 'credit' && !features.credit) return 'retail'
  return m
}

function resolveVariantRow(
  product: PricingProductSnapshot,
  sku?: string | null,
  variationLabel?: string | null,
): VariantRow | null {
  if (!hasVariants(product.storageVariations)) return null
  const variants = product.storageVariations as VariantRow[]
  const skuTrim = sku?.trim()
  if (skuTrim) {
    const bySku = variants.find(v => v.sku && v.sku === skuTrim)
    if (bySku) return bySku
  }
  const label = variationLabel?.trim()
  if (label) return findVariant(product.storageVariations, label)
  return null
}

/** Catalog unit price for a product line (variant prices when matched). */
export function resolveProductCatalogUnitPrice(
  product: PricingProductSnapshot,
  opts: { sku?: string | null; variationLabel?: string | null; mode: PriceMode },
): number {
  const variant = resolveVariantRow(product, opts.sku, opts.variationLabel)
  if (variant) {
    return resolveCatalogPrice(
      {
        sellingPrice: variant.sellingPrice,
        wholesalePrice: variant.wholesalePrice,
        creditPrice: variant.creditPrice,
      },
      opts.mode,
    )
  }
  return resolveCatalogPrice(product, opts.mode)
}
