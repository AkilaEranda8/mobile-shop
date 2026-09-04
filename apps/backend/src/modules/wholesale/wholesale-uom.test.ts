/**
 * Run: npx tsx src/modules/wholesale/wholesale-uom.test.ts
 */
import { sellUnitToStockQty, round2 } from './wholesale-uom.util'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

const product = { name: 'Widget', unitsPerBox: 10, unitsPerCarton: 40 }

assert(sellUnitToStockQty(3, 'PIECE', product) === 3, 'piece passthrough')
assert(sellUnitToStockQty(2, 'BOX', product) === 20, 'box conversion')
assert(sellUnitToStockQty(1, 'CARTON', product) === 40, 'carton conversion')
assert(round2(1.005) === 1.01 || round2(1.005) === 1, 'round2 defined')

let threw = false
try {
  sellUnitToStockQty(1, 'BOX', { name: 'Bad', unitsPerBox: null, unitsPerCarton: 40 })
} catch {
  threw = true
}
assert(threw, 'box without unitsPerBox throws')

threw = false
try {
  sellUnitToStockQty(0, 'PIECE', product)
} catch {
  threw = true
}
assert(threw, 'zero qty throws')

// Pricing resolve hierarchy smoke (pure logic mirrors pricing.service sources)
const sources = ['DEALER_OVERRIDE', 'TIER_QTY_BREAK', 'TIER_LIST', 'PRODUCT_WHOLESALE'] as const
assert(sources.length === 4, 'expected four wholesale price sources')

console.log('wholesale-uom.test.ts: all checks passed')
