/**
 * Thin ATP façade for wholesale / POS availability checks.
 * Engine ATP = onHand − reserved (no MOQ / credit — apply those in wholesale services).
 */
import type { InventoryDb, StockLocationKey } from './inventory-engine.stock'
import { computeAtp, getAtp, getOnHand, getReservedQty } from './inventory-engine.stock'

export { computeAtp, getAtp, getOnHand, getReservedQty }
export type { InventoryDb, StockLocationKey }

export async function getAtpSnapshot(db: InventoryDb, key: StockLocationKey) {
  const [onHand, reserved] = await Promise.all([getOnHand(db, key), getReservedQty(db, key)])
  return {
    onHand,
    reserved,
    atp: computeAtp(onHand, reserved),
  }
}
