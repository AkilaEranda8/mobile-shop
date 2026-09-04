export const WHOLESALE_AI_EVENTS = [
  'wholesale.order.confirmed',
  'wholesale.invoice.created',
  'wholesale.payment.received',
  'wholesale.return.completed',
  'wholesale.visit.completed',
  'wholesale.settlement.submitted',
] as const

export type WholesaleAiEvent = (typeof WHOLESALE_AI_EVENTS)[number]
