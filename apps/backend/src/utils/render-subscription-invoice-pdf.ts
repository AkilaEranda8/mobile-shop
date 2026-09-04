import type { BillingBankSettings } from '../modules/billing/billing-config'
import { buildSubscriptionInvoicePdf } from './subscription-invoice-pdf'

/** Shared invoice shape used by admin + shop PDF endpoints */
export type SubscriptionInvoicePdfSource = {
  invoiceNumber: string
  plan: string
  months: number
  mrrSnapshot: number
  total: number
  subtotal?: number | null
  discount?: number | null
  tax?: number | null
  billingPeriodStart: Date
  billingPeriodEnd: Date
  issueDate?: Date | null
  dueDate?: Date | null
  status?: string | null
  paidAt?: Date | null
  paidByName?: string | null
  tenant: {
    name: string
    ownerName?: string | null
    ownerEmail?: string | null
  }
}

/** Build the exact same PDF bytes for admin download and shop download. */
export function renderSubscriptionInvoicePdf(
  invoice: SubscriptionInvoicePdfSource,
  bank: BillingBankSettings,
): Buffer {
  return buildSubscriptionInvoicePdf({
    invoiceNo: invoice.invoiceNumber,
    shopName: invoice.tenant.name,
    ownerName: invoice.tenant.ownerName || '',
    ownerEmail: invoice.tenant.ownerEmail,
    plan: invoice.plan,
    months: invoice.months,
    mrr: invoice.mrrSnapshot,
    total: invoice.total,
    periodStart: invoice.billingPeriodStart,
    periodEnd: invoice.billingPeriodEnd,
    issueDate: invoice.issueDate ?? undefined,
    dueDate: invoice.dueDate ?? undefined,
    status: invoice.status ?? undefined,
    discount: invoice.discount ?? 0,
    tax: invoice.tax ?? 0,
    subtotal: invoice.subtotal ?? invoice.total,
    paidAt: invoice.paidAt,
    paidByName: invoice.paidByName || null,
    bank,
  })
}
