/**
 * Run: npx tsx src/modules/pricing-engine/pricing-engine.resolve.test.ts
 */
import {
  resolveCatalogPrice,
  resolveEffectivePriceMode,
  resolveProductCatalogUnitPrice,
} from './pricing-engine.resolve'
import { resolveSaleLineUnitPrice } from './pricing-engine.service'
import { PRICING_ENGINE_FEATURE } from './pricing-engine.feature'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

assert(PRICING_ENGINE_FEATURE === 'PRICING_ENGINE', 'feature key stable')

assert(resolveCatalogPrice({ sellingPrice: 100 }, 'retail') === 100, 'retail base')
assert(resolveCatalogPrice({ sellingPrice: 100, wholesalePrice: 80 }, 'wholesale') === 80, 'wholesale set')
assert(resolveCatalogPrice({ sellingPrice: 100, wholesalePrice: 0 }, 'wholesale') === 100, 'wholesale falls back')
assert(resolveCatalogPrice({ sellingPrice: 100, creditPrice: 110 }, 'credit') === 110, 'credit set')
assert(resolveCatalogPrice({ sellingPrice: 100, creditPrice: 0 }, 'credit') === 100, 'credit falls back')

assert(resolveEffectivePriceMode('wholesale', { wholesale: false, credit: true }) === 'retail', 'clamp wholesale')
assert(resolveEffectivePriceMode('credit', { wholesale: true, credit: false }) === 'retail', 'clamp credit')
assert(resolveEffectivePriceMode('wholesale', { wholesale: true, credit: false }) === 'wholesale', 'allow wholesale')

const product = {
  sellingPrice: 200,
  wholesalePrice: 150,
  creditPrice: 220,
  storageVariations: [
    { storage: '128GB', colorName: 'Black', sku: 'P-128-B', sellingPrice: 250, wholesalePrice: 200, creditPrice: 0 },
  ],
}
assert(
  resolveProductCatalogUnitPrice(product, { sku: 'P-128-B', mode: 'retail' }) === 250,
  'variant retail',
)
assert(
  resolveProductCatalogUnitPrice(product, { sku: 'P-128-B', mode: 'wholesale' }) === 200,
  'variant wholesale',
)
assert(
  resolveProductCatalogUnitPrice(product, { sku: 'P-128-B', mode: 'credit' }) === 250,
  'variant credit falls back to variant retail',
)

const catalogForced = resolveSaleLineUnitPrice({
  product,
  sku: 'P-128-B',
  mode: 'wholesale',
  clientUnitPrice: 999,
  allowManualOverride: false,
})
assert(catalogForced.unitPrice === 200, 'no override uses catalog')
assert(catalogForced.source === 'catalog', 'catalog source')

const overridden = resolveSaleLineUnitPrice({
  product,
  sku: 'P-128-B',
  mode: 'wholesale',
  clientUnitPrice: 175,
  allowManualOverride: true,
})
assert(overridden.unitPrice === 175, 'override allowed')
assert(overridden.overridden === true, 'marked overridden')

console.log('pricing-engine.resolve.test.ts: all checks passed')
