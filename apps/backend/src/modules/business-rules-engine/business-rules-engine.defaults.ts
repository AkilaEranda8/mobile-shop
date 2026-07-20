import {
  notesContainOpeningBalance,
  SALE_SOURCES_SKIP_AUTO_JOURNAL,
} from '../../constants/business-rules.constants'
import type {
  NotesOpeningBalanceContext,
  PoOpeningSupplierContext,
  SaleSourceSkipContext,
} from './business-rules-engine.types'

/** Pure default: notes include OPENING_BALANCE marker. */
export function defaultNotesContainOpeningBalance(ctx: NotesOpeningBalanceContext): boolean {
  return notesContainOpeningBalance(ctx.notes)
}

/** Pure default: sale.source is in the auto-journal skip set. */
export function defaultSaleSourceSkipAutoJournal(ctx: SaleSourceSkipContext): boolean {
  const source = (ctx.source ?? '').trim()
  if (!source) return false
  return (SALE_SOURCES_SKIP_AUTO_JOURNAL as readonly string[]).includes(source)
}

/**
 * Pure default: PO notes mark opening supplier AP and (when receivedAt provided)
 * must not have been inventory-received.
 */
export function defaultPoIsOpeningSupplierBalance(ctx: PoOpeningSupplierContext): boolean {
  if (!notesContainOpeningBalance(ctx.notes)) return false
  if (ctx.receivedAt !== undefined && ctx.receivedAt != null) return false
  return true
}
