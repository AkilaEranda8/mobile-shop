export type WorkflowEntityType = 'RepairTicket' | 'PurchaseOrder'

export type RepairStatus =
  | 'RECEIVED'
  | 'DIAGNOSED'
  | 'IN_REPAIR'
  | 'QC'
  | 'READY'
  | 'DELIVERED'
  | 'CANCELLED'

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'SENT'
  | 'PARTIAL'
  | 'RECEIVED'
  | 'CLOSED'

export type TransitionContext = {
  /** e.g. collect_payment — allows RepairTicket → DELIVERED */
  via?: string
}

export type TransitionDecision = {
  allowed: boolean
  reason?: string
}
