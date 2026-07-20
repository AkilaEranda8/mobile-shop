/** Canonical keys for business-rule detection and accounting source tagging. */
export const BUSINESS_RULE_KEYS = {
  OPENING_BALANCE: 'OPENING_BALANCE',
  CREDIT_COLLECTION: 'CREDIT_COLLECTION',
  REPAIR: 'REPAIR',
} as const

export type BusinessRuleKey = (typeof BUSINESS_RULE_KEYS)[keyof typeof BUSINESS_RULE_KEYS]

/** Marker substring in notes fields (PO, sale, etc.). */
export const OPENING_BALANCE_NOTES_MARKER = BUSINESS_RULE_KEYS.OPENING_BALANCE

export const OPENING_BALANCE_SUPPLIER_PO_NOTES =
  'OPENING_BALANCE — Prior supplier outstanding brought into the system'

/**
 * Sale.source values that must not enqueue SALE_CREATED / SALE_COGS
 * (avoids double-counting repair invoices, opening AR, credit collections).
 */
export const SALE_SOURCES_SKIP_AUTO_JOURNAL = [
  BUSINESS_RULE_KEYS.REPAIR,
  BUSINESS_RULE_KEYS.OPENING_BALANCE,
  BUSINESS_RULE_KEYS.CREDIT_COLLECTION,
] as const

export type SaleSourceSkipAutoJournal =
  (typeof SALE_SOURCES_SKIP_AUTO_JOURNAL)[number]

export function notesContainOpeningBalance(notes: string | null | undefined): boolean {
  return (notes ?? '').includes(OPENING_BALANCE_NOTES_MARKER)
}
