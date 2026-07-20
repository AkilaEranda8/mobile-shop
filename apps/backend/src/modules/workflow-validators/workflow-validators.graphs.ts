import type { PurchaseOrderStatus, RepairStatus } from './workflow-validators.types'

/** Canonical repair progress graph (UI progress + optional DIAGNOSED/QC steps). */
export const REPAIR_TRANSITIONS: Record<RepairStatus, readonly RepairStatus[]> = {
  RECEIVED: ['DIAGNOSED', 'IN_REPAIR', 'CANCELLED'],
  DIAGNOSED: ['IN_REPAIR', 'CANCELLED'],
  IN_REPAIR: ['QC', 'READY', 'CANCELLED'],
  QC: ['READY', 'IN_REPAIR', 'CANCELLED'],
  READY: ['CANCELLED'], // DELIVERED only via collect_payment
  DELIVERED: [],
  CANCELLED: [],
}

/** PO lifecycle graph — receive/restock is a side effect of → RECEIVED, not this validator. */
export const PO_TRANSITIONS: Record<PurchaseOrderStatus, readonly PurchaseOrderStatus[]> = {
  DRAFT: ['SENT', 'RECEIVED', 'CLOSED'],
  SENT: ['DRAFT', 'PARTIAL', 'RECEIVED', 'CLOSED'],
  PARTIAL: ['RECEIVED', 'CLOSED'],
  RECEIVED: ['CLOSED'],
  CLOSED: [],
}

export const REPAIR_STATUSES = Object.keys(REPAIR_TRANSITIONS) as RepairStatus[]
export const PO_STATUSES = Object.keys(PO_TRANSITIONS) as PurchaseOrderStatus[]
