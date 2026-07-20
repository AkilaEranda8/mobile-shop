/**
 * Run: npx tsx src/modules/business-rules-engine/business-rules-engine.service.test.ts
 */
import { OPENING_BALANCE_SUPPLIER_PO_NOTES } from '../../constants/business-rules.constants'
import {
  evaluateNotesContainOpeningBalance,
  evaluatePoIsOpeningSupplierBalance,
  evaluateRule,
  evaluateSaleSourceSkipAutoJournal,
  listRegisteredRules,
  saleSourcesSkippedForAutoJournal,
  BUSINESS_RULE_CATALOG_KEYS,
} from './business-rules-engine.service'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

assert(listRegisteredRules().length >= 3, 'at least 3 registered rules')

assert(
  evaluateNotesContainOpeningBalance('t1', OPENING_BALANCE_SUPPLIER_PO_NOTES),
  'supplier opening PO notes detected',
)
assert(
  !evaluateNotesContainOpeningBalance('t1', 'Regular purchase order'),
  'regular PO not flagged',
)

assert(evaluateSaleSourceSkipAutoJournal('t1', 'REPAIR'), 'REPAIR skipped')
assert(evaluateSaleSourceSkipAutoJournal('t1', 'OPENING_BALANCE'), 'OPENING_BALANCE skipped')
assert(evaluateSaleSourceSkipAutoJournal('t1', 'CREDIT_COLLECTION'), 'CREDIT_COLLECTION skipped')
assert(!evaluateSaleSourceSkipAutoJournal('t1', 'POS'), 'POS not skipped')
assert(!evaluateSaleSourceSkipAutoJournal('t1', null), 'null source not skipped')

assert(
  evaluatePoIsOpeningSupplierBalance('t1', { notes: OPENING_BALANCE_SUPPLIER_PO_NOTES }),
  'opening PO without receive check',
)
assert(
  evaluatePoIsOpeningSupplierBalance('t1', {
    notes: OPENING_BALANCE_SUPPLIER_PO_NOTES,
    receivedAt: undefined,
  }),
  'receivedAt undefined still opening',
)
assert(
  !evaluatePoIsOpeningSupplierBalance('t1', {
    notes: OPENING_BALANCE_SUPPLIER_PO_NOTES,
    receivedAt: new Date(),
  }),
  'received opening PO is not opening-AP candidate',
)

const result = evaluateRule('t1', BUSINESS_RULE_CATALOG_KEYS.NOTES_CONTAIN_OPENING_BALANCE, {
  notes: 'x OPENING_BALANCE y',
})
assert(result.value === true && result.source === 'default', 'evaluateRule default source')

const skipSet = saleSourcesSkippedForAutoJournal()
assert(skipSet.includes('REPAIR') && skipSet.includes('OPENING_BALANCE'), 'prisma skip set')

let threw = false
try {
  evaluateRule('t1', 'UNKNOWN_RULE' as any, {})
} catch {
  threw = true
}
assert(threw, 'unknown rule key throws')

console.log('business-rules-engine.service.test.ts: all checks passed')
