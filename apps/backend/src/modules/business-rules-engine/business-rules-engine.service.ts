import { AppError } from '../../middleware/error.middleware'
import { SALE_SOURCES_SKIP_AUTO_JOURNAL } from '../../constants/business-rules.constants'
import { getRuleDefinition, listRegisteredRules } from './business-rules-engine.registry'
import {
  BUSINESS_RULE_CATALOG_KEYS,
  type BusinessRuleCatalogKey,
  type NotesOpeningBalanceContext,
  type PoOpeningSupplierContext,
  type RuleContextMap,
  type RuleEvaluationResult,
  type RuleValueMap,
  type SaleSourceSkipContext,
} from './business-rules-engine.types'

export { BUSINESS_RULE_CATALOG_KEYS, listRegisteredRules }
export { SALE_SOURCES_SKIP_AUTO_JOURNAL }

function getKnownKeySet(): Set<string> {
  return new Set(Object.values(BUSINESS_RULE_CATALOG_KEYS))
}

function assertKnownKey(key: string): asserts key is BusinessRuleCatalogKey {
  if (!getKnownKeySet().has(key)) {
    throw new AppError(`Unknown business rule key: ${key}`, 400)
  }
}

/**
 * Evaluate a catalogued rule.
 * Phase 1 precedence: default only (tenantId reserved for Phase 2 overrides).
 * Evaluators are pure — no DB / no side effects.
 */
export function evaluateRule<K extends BusinessRuleCatalogKey>(
  _tenantId: string | null | undefined,
  key: K,
  context: RuleContextMap[K],
): RuleEvaluationResult<RuleValueMap[K]> {
  assertKnownKey(key)
  const def = getRuleDefinition(key)
  const value = def.evaluateDefault(context)
  return { key, value, source: 'default' }
}

/** Convenience: opening-balance marker in notes. */
export function evaluateNotesContainOpeningBalance(
  tenantId: string | null | undefined,
  notes: string | null | undefined,
): boolean {
  return evaluateRule(tenantId, BUSINESS_RULE_CATALOG_KEYS.NOTES_CONTAIN_OPENING_BALANCE, {
    notes,
  } satisfies NotesOpeningBalanceContext).value
}

/** Convenience: sale source should skip SALE_CREATED / SALE_COGS. */
export function evaluateSaleSourceSkipAutoJournal(
  tenantId: string | null | undefined,
  source: string | null | undefined,
): boolean {
  return evaluateRule(tenantId, BUSINESS_RULE_CATALOG_KEYS.SALE_SOURCE_SKIP_AUTO_JOURNAL, {
    source,
  } satisfies SaleSourceSkipContext).value
}

/** Convenience: PO is opening supplier balance. */
export function evaluatePoIsOpeningSupplierBalance(
  tenantId: string | null | undefined,
  ctx: PoOpeningSupplierContext,
): boolean {
  return evaluateRule(tenantId, BUSINESS_RULE_CATALOG_KEYS.PO_IS_OPENING_SUPPLIER_BALANCE, ctx).value
}

/** Prisma `source: { notIn: [...] }` — same set the skip rule uses. */
export function saleSourcesSkippedForAutoJournal(): readonly string[] {
  return SALE_SOURCES_SKIP_AUTO_JOURNAL
}
