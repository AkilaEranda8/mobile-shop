/**
 * Run: npx tsx src/utils/sale-item-cost.util.test.ts
 */
import { resolveSaleItemUnitCost } from './sale-item-cost.util'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

assert(
  resolveSaleItemUnitCost({ buyingPrice: 5000 }, {}) === 5000,
  'plain product uses buyingPrice',
)

assert(
  resolveSaleItemUnitCost(
    {
      buyingPrice: 5000,
      storageVariations: [
        { storage: '64GB', colorName: 'Black', sku: 'SKU-A', costPrice: 4200, stock: 3 },
      ],
    },
    { sku: 'SKU-A' },
  ) === 4200,
  'variant SKU uses PO-updated costPrice instead of product buyingPrice',
)

assert(
  resolveSaleItemUnitCost(
    {
      buyingPrice: 5000,
      storageVariations: [
        { storage: '64GB', colorName: 'Black', sku: 'SKU-A', costPrice: 4200, stock: 3 },
      ],
    },
    { variationLabel: '64GB::Black' },
  ) === 4200,
  'variant label resolves costPrice',
)

assert(
  resolveSaleItemUnitCost(
    {
      buyingPrice: 4500,
      storageVariations: [
        { storage: '64GB', colorName: 'Black', sku: 'SKU-A', stock: 3 },
      ],
    },
    { sku: 'SKU-A' },
  ) === 4500,
  'missing variant cost falls back to product buyingPrice after PO receive',
)

console.log('sale-item-cost.util.test.ts: all checks passed')
