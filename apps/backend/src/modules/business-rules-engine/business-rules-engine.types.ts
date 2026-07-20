/** Catalogued rule keys (Phase 1). Tenant overrides come in Phase 2. */
export const BUSINESS_RULE_CATALOG_KEYS = {
  NOTES_CONTAIN_OPENING_BALANCE: 'NOTES_CONTAIN_OPENING_BALANCE',
  SALE_SOURCE_SKIP_AUTO_JOURNAL: 'SALE_SOURCE_SKIP_AUTO_JOURNAL',
  PO_IS_OPENING_SUPPLIER_BALANCE: 'PO_IS_OPENING_SUPPLIER_BALANCE',
} as const

export type BusinessRuleCatalogKey =
  (typeof BUSINESS_RULE_CATALOG_KEYS)[keyof typeof BUSINESS_RULE_CATALOG_KEYS]

export type RuleEvaluationSource = 'default' | 'tenant_override' | 'feature_flag'

export type RuleEvaluationResult<T = unknown> = {
  key: BusinessRuleCatalogKey
  value: T
  source: RuleEvaluationSource
}

export type NotesOpeningBalanceContext = {
  notes?: string | null
}

export type SaleSourceSkipContext = {
  source?: string | null
}

export type PoOpeningSupplierContext = {
  notes?: string | null
  /** When set, opening supplier AP requires no receive date. */
  receivedAt?: Date | string | null
}

export type RuleContextMap = {
  NOTES_CONTAIN_OPENING_BALANCE: NotesOpeningBalanceContext
  SALE_SOURCE_SKIP_AUTO_JOURNAL: SaleSourceSkipContext
  PO_IS_OPENING_SUPPLIER_BALANCE: PoOpeningSupplierContext
}

export type RuleValueMap = {
  NOTES_CONTAIN_OPENING_BALANCE: boolean
  SALE_SOURCE_SKIP_AUTO_JOURNAL: boolean
  PO_IS_OPENING_SUPPLIER_BALANCE: boolean
}
