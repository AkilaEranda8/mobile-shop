import type { InvoiceSettings } from '@/lib/invoiceSettings'
import type { RepairTicket } from '@/types'

export const REPAIR_WARRANTY_OPTIONS = [0, 1, 3, 6, 12, 24] as const

export function repairWarrantyMonths(settings: InvoiceSettings): number {
  const n = Number(settings.repairWarrantyMonths ?? 3)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
}

/** Ticket warranty only — unset until chosen in repair details. */
export function resolveRepairWarrantyMonths(
  repair: Pick<RepairTicket, 'warrantyMonths'>,
  _settings?: InvoiceSettings,
): number {
  if (repair.warrantyMonths != null && repair.warrantyMonths >= 0) {
    return Math.round(repair.warrantyMonths)
  }
  return 0
}

/** Build sale-shaped payload for repair PDF / WhatsApp / A4 invoice templates. */
export function buildRepairInvoiceSale(
  repair: RepairTicket,
  settings: InvoiceSettings,
  opts?: { isPaid?: boolean },
) {
  const serviceFee = Number(repair.estimatedCost ?? 0) || 0
  const subtotal = serviceFee
  const discount =
    repair.actualCost != null && Number(repair.actualCost) < subtotal
      ? subtotal - Number(repair.actualCost)
      : 0
  const total = Math.max(0, subtotal - discount)
  const isPaid = opts?.isPaid ?? repair.status === 'DELIVERED'
  const warrantyMonths = resolveRepairWarrantyMonths(repair, settings)

  const items: Array<{
    productName: string
    description?: string
    quantity: number
    unitPrice: number
    total: number
    warrantyMonths?: number
    imei?: string
    sku?: string
  }> = []

  if (serviceFee > 0) {
    items.push({
      productName: `Repair Service – ${repair.deviceBrand} ${repair.deviceModel}`,
      description: repair.reportedIssue?.trim() || undefined,
      quantity: 1,
      unitPrice: serviceFee,
      total: serviceFee,
      warrantyMonths,
      imei: repair.imei || undefined,
      sku: repair.ticketNumber,
    })
  }

  for (const p of repair.spareParts ?? []) {
    const qty = Number(p.quantity) || 1
    const unitPrice = Number(p.unitCost) || 0
    const lineTotal = Number(p.total) || unitPrice * qty
    items.push({
      productName: p.productName,
      description: 'Spare part used',
      quantity: qty,
      unitPrice,
      total: lineTotal,
      warrantyMonths: 0,
    })
  }

  return {
    invoiceNumber: repair.ticketNumber,
    createdAt: repair.createdAt,
    customerName: repair.customerName,
    customerPhone: repair.customerPhone,
    source: 'REPAIR' as const,
    notes: repair.reportedIssue?.trim()
      ? `Repair ticket: ${repair.ticketNumber} | Fault: ${repair.reportedIssue.trim()}`
      : `Repair ticket: ${repair.ticketNumber}`,
    items,
    subtotal,
    discount,
    tax: 0,
    total,
    paidAmount: isPaid ? total : 0,
    dueAmount: isPaid ? 0 : total,
    warrantyMonths,
  }
}
