import {
  defaultNotesContainOpeningBalance,
  defaultPoIsOpeningSupplierBalance,
  defaultSaleSourceSkipAutoJournal,
} from './business-rules-engine.defaults'
import {
  BUSINESS_RULE_CATALOG_KEYS,
  type BusinessRuleCatalogKey,
  type RuleContextMap,
  type RuleValueMap,
} from './business-rules-engine.types'

export type RuleDefinition<K extends BusinessRuleCatalogKey> = {
  key: K
  description: string
  /** Phase 1: pure default only — no side effects. */
  evaluateDefault: (ctx: RuleContextMap[K]) => RuleValueMap[K]
}

type Registry = {
  [K in BusinessRuleCatalogKey]: RuleDefinition<K>
}

export const BUSINESS_RULE_REGISTRY: Registry = {
  [BUSINESS_RULE_CATALOG_KEYS.NOTES_CONTAIN_OPENING_BALANCE]: {
    key: BUSINESS_RULE_CATALOG_KEYS.NOTES_CONTAIN_OPENING_BALANCE,
    description: 'Detect OPENING_BALANCE marker in free-text notes (PO, sale, etc.).',
    evaluateDefault: defaultNotesContainOpeningBalance,
  },
  [BUSINESS_RULE_CATALOG_KEYS.SALE_SOURCE_SKIP_AUTO_JOURNAL]: {
    key: BUSINESS_RULE_CATALOG_KEYS.SALE_SOURCE_SKIP_AUTO_JOURNAL,
    description:
      'Sale sources that must not enqueue SALE_CREATED / SALE_COGS (repair, opening AR, credit collection).',
    evaluateDefault: defaultSaleSourceSkipAutoJournal,
  },
  [BUSINESS_RULE_CATALOG_KEYS.PO_IS_OPENING_SUPPLIER_BALANCE]: {
    key: BUSINESS_RULE_CATALOG_KEYS.PO_IS_OPENING_SUPPLIER_BALANCE,
    description: 'Purchase order is an opening supplier AP (notes marker; optional no receive).',
    evaluateDefault: defaultPoIsOpeningSupplierBalance,
  },
}

export function listRegisteredRules(): Array<{ key: BusinessRuleCatalogKey; description: string }> {
  return Object.values(BUSINESS_RULE_REGISTRY).map(r => ({
    key: r.key,
    description: r.description,
  }))
}

export function getRuleDefinition<K extends BusinessRuleCatalogKey>(key: K): RuleDefinition<K> {
  return BUSINESS_RULE_REGISTRY[key]
}
