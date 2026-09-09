/** Broadcast when a subscription invoice is confirmed paid (LankaQR / bank). */
export const BILLING_PAID_EVENT = 'hx:billing-paid'

export function notifyBillingPaid(detail?: { invoiceNumber?: string; paymentId?: string }) {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(BILLING_PAID_EVENT, { detail: detail ?? {} }))
  } catch {
    /* ignore */
  }
}
