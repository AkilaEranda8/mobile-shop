/**
 * Pure-logic tests for inventory-engine consume / ATP helpers.
 * Run: npx tsx src/modules/inventory-engine/inventory-engine.consume.test.ts
 */
import {
  computeAtp,
  isImeiSoftReserveSchemaReady,
  isStockReservationModelReady,
  resolveConsumeMovementType,
} from './inventory-engine.stock'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

// ── ATP math (Gap 2) ──────────────────────────────────────────────────────────
assert(computeAtp(10, 0) === 10, 'atp = onHand when nothing reserved')
assert(computeAtp(10, 3) === 7, 'atp = onHand - reserved')
assert(computeAtp(5, 5) === 0, 'atp zero when fully reserved')
assert(computeAtp(2, 5) === -3, 'atp may go negative (caller clamps for UI if needed)')
assert(computeAtp(0, 0) === 0, 'empty stock atp')

// ── Movement type resolution (WHOLESALE_DISPATCH enum may be absent) ──────────
assert(resolveConsumeMovementType('SALE') === 'SALE', 'SALE stays SALE')
assert(resolveConsumeMovementType(undefined) === 'SALE', 'default SALE')
assert(resolveConsumeMovementType(null) === 'SALE', 'null → SALE')
// Until enum migration, WHOLESALE_DISPATCH falls back to SALE
const wholesaleResolved = resolveConsumeMovementType('WHOLESALE_DISPATCH')
assert(
  wholesaleResolved === 'WHOLESALE_DISPATCH' || wholesaleResolved === 'SALE',
  'WHOLESALE_DISPATCH resolves to enum value or SALE fallback',
)

// ── Schema readiness probes (current schema: soft-reserve + StockReservation absent) ─
assert(
  typeof isImeiSoftReserveSchemaReady() === 'boolean',
  'soft-reserve schema probe returns boolean',
)
assert(
  typeof isStockReservationModelReady() === 'boolean',
  'StockReservation schema probe returns boolean',
)
// Schema readiness after wholesale migration (soft-reserve cols + StockReservation present)
assert(isImeiSoftReserveSchemaReady() === true, 'soft-reserve fields present after wholesale schema')
assert(isStockReservationModelReady() === true, 'StockReservation model present after wholesale schema')

console.log('inventory-engine.consume.test.ts: all checks passed')
