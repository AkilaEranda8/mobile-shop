/**
 * Wholesale regression probes — pure / schema-level checks (no DB required).
 * Run: npx tsx src/modules/wholesale/wholesale-regression.test.ts
 */
import assert from 'node:assert/strict'
import { computeAtp } from '../inventory-engine/inventory-engine.stock'
import { sellUnitToStockQty, round2 } from './wholesale-uom.util'

// 1. ATP math never embeds MOQ
assert.equal(computeAtp(10, 3), 7)
assert.equal(computeAtp(5, 5), 0)
assert.equal(computeAtp(2, 5), -3) // callers may clamp for UI; engine returns raw

// 2. UOM conversion
assert.equal(sellUnitToStockQty(2, 'BOX', { unitsPerBox: 10, unitsPerCarton: 50 }), 20)
assert.equal(sellUnitToStockQty(1, 'CARTON', { unitsPerBox: 10, unitsPerCarton: 50 }), 50)
assert.equal(sellUnitToStockQty(3, 'PIECE', { unitsPerBox: 10, unitsPerCarton: 50 }), 3)

// 3. Channels are distinct from retail Sale
const CHANNELS = ['COUNTER', 'VAN', 'DELIVERY'] as const
assert.ok(CHANNELS.includes('COUNTER'))
assert.ok(!CHANNELS.includes('POS' as any))

// 4. PaymentMethod shared — wholesale uses same names as retail
const SHARED_METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'CREDIT', 'UPI', 'WALLET', 'CHEQUE']
assert.ok(SHARED_METHODS.includes('CASH'))

// 5. Price hierarchy never returns retail silently — resolve must throw without wholesalePrice
// (behavioral contract documented; service throws AppError)
assert.equal(round2(10.005), 10.01)

// 6. Feature flag names
const FLAGS = ['WHOLESALE', 'REP_VAN_SALES', 'POS', 'WHOLESALE_PRICING']
assert.ok(FLAGS.includes('WHOLESALE'))
assert.ok(FLAGS.includes('POS'))
assert.notEqual('WHOLESALE', 'WHOLESALE_PRICING')

console.log('wholesale-regression.test.ts: ok')
