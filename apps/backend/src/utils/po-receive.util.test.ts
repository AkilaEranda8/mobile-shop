/**
 * Run: npx tsx src/utils/po-receive.util.test.ts
 */
import { weightedBuyingPrice } from './po-receive.util'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

assert(weightedBuyingPrice(0, 2500, 3, 6000) === 2000, 'PO unit cost when stock was zero')
assert(weightedBuyingPrice(1, 2500, 3, 8700) === 2800, 'blend costs across multiple receives')
assert(weightedBuyingPrice(4, 2500, 4, 10000) === 2500, 'same-cost stock keeps average')

console.log('po-receive.util.test.ts: all checks passed')
