/**
 * Run: npx tsx src/modules/inventory-engine/inventory-engine.service.test.ts
 */
import { notesContainOpeningBalance, OPENING_BALANCE_SUPPLIER_PO_NOTES } from '../../constants/business-rules.constants'
import { INVENTORY_ENGINE_FEATURE } from './inventory-engine.feature'
import {
  applyExchangeSoldStockEffectsIfEnabled,
  applyExchangeTradeInStockEffectsIfEnabled,
  applyPurchaseOrderReceiveEffectsIfEnabled,
  applyRepairSparePartsStockEffectsIfEnabled,
  applySaleReturnStockEffectsIfEnabled,
  applySaleStockEffectsIfEnabled,
  applyStockAdjustmentEffectsIfEnabled,
  applyStockTransferEffectsIfEnabled,
  resolveAdjustmentTargetStock,
} from './inventory-engine.service'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

assert(INVENTORY_ENGINE_FEATURE === 'INVENTORY_ENGINE', 'feature key stable')
assert(notesContainOpeningBalance(OPENING_BALANCE_SUPPLIER_PO_NOTES), 'supplier opening PO notes detected')
assert(!notesContainOpeningBalance('Regular purchase order'), 'regular PO not flagged as opening balance')
assert(notesContainOpeningBalance('Some note OPENING_BALANCE suffix'), 'marker substring match')

assert(resolveAdjustmentTargetStock({ targetStock: 5 }) === 5, 'plain target stock')
assert(
  resolveAdjustmentTargetStock({
    targetStock: 99,
    targetStorageVariations: [
      { storage: '128', colorName: 'Black', stock: 2 },
      { storage: '256', colorName: 'Blue', stock: 3 },
    ],
  }) === 5,
  'variants win over parent targetStock',
)
let neg = false
try {
  resolveAdjustmentTargetStock({ targetStock: -1 })
} catch {
  neg = true
}
assert(neg, 'negative target rejected')

void applyExchangeSoldStockEffectsIfEnabled
void applyExchangeTradeInStockEffectsIfEnabled
void applyPurchaseOrderReceiveEffectsIfEnabled
void applyRepairSparePartsStockEffectsIfEnabled
void applySaleReturnStockEffectsIfEnabled
void applySaleStockEffectsIfEnabled
void applyStockAdjustmentEffectsIfEnabled
void applyStockTransferEffectsIfEnabled

console.log('inventory-engine.service.test.ts: all checks passed')
