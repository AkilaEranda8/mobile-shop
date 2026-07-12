import type { RepairTicket, RepairStatusHistory } from '@/types'

export const REPAIR_SERVICE_ITEM_LABEL = 'Repair Item'

export function formatRepairServiceItemName(deviceBrand: string, deviceModel: string) {
  const label = [deviceBrand, deviceModel].filter(Boolean).join(' ').trim()
  return label ? `${REPAIR_SERVICE_ITEM_LABEL} – ${label}` : REPAIR_SERVICE_ITEM_LABEL
}

/** Matches new and legacy repair service sale line names. */
export function isRepairServiceItemName(name?: string | null) {
  const n = String(name || '')
  return n.startsWith(REPAIR_SERVICE_ITEM_LABEL) || n.startsWith('Repair Service')
}

export const REPAIR_PROGRESS_FLOW = ['RECEIVED', 'IN_REPAIR', 'READY'] as const

/** Map API `history` → frontend `statusHistory`. */
export function normalizeRepairTicket(raw: unknown): RepairTicket {
  const ticket = (raw ?? {}) as RepairTicket & { history?: RepairStatusHistory[] }
  return {
    ...ticket,
    statusHistory: ticket.statusHistory ?? ticket.history ?? [],
  }
}

export function repairStatusHistory(repair: Pick<RepairTicket, 'statusHistory'> & { history?: RepairStatusHistory[] }) {
  return repair.statusHistory?.length ? repair.statusHistory : (repair.history ?? [])
}

/** Progress step 0–2 for RECEIVED→READY; 3 = delivered. */
export function repairProgressStep(status: string): number {
  switch (status) {
    case 'RECEIVED':
    case 'DIAGNOSED':
      return 0
    case 'IN_REPAIR':
    case 'QC':
      return 1
    case 'READY':
      return 2
    case 'DELIVERED':
      return 3
    default:
      return -1
  }
}

export function repairNextStatus(status: string): string | null {
  switch (status) {
    case 'RECEIVED':
    case 'DIAGNOSED':
      return 'IN_REPAIR'
    case 'IN_REPAIR':
    case 'QC':
      return 'READY'
    default:
      return null
  }
}

export function repairPartsLocked(status: string): boolean {
  return status === 'DELIVERED' || status === 'CANCELLED'
}

export function repairTicketEditable(status: string): boolean {
  return status !== 'DELIVERED' && status !== 'CANCELLED'
}

/** Payment breakdown for repair detail / invoice. */
export function repairPaymentSummary(
  repair: Pick<RepairTicket, 'status' | 'estimatedCost' | 'actualCost' | 'paidAmount' | 'dueAmount'>,
) {
  const quote = Number(repair.estimatedCost) || 0
  const isPaid = repair.status === 'DELIVERED'
  const billTotal = isPaid ? (Number(repair.actualCost) ?? quote) : quote
  const paid = isPaid ? (Number(repair.paidAmount) ?? billTotal) : 0
  const due = isPaid ? (Number(repair.dueAmount) ?? Math.max(0, billTotal - paid)) : quote
  const discount = isPaid ? Math.max(0, quote - billTotal) : 0
  return {
    quote,
    billTotal,
    paid,
    due,
    discount,
    isPaid,
    isPartial: isPaid && due > 0,
    isFull: isPaid && due <= 0,
  }
}

/** Parse device brand/model from combined repair warranty product name. */
export function parseRepairWarrantyDevice(productName?: string, brandName?: string) {
  const brand = brandName?.trim() || ''
  const name = productName?.trim() || ''
  const match = name.match(/^Repair – (.+?) \|/)
  if (!match) return { deviceBrand: brand, deviceModel: brand ? '' : name }
  const deviceLabel = match[1].trim()
  if (brand && deviceLabel.toLowerCase().startsWith(brand.toLowerCase())) {
    return { deviceBrand: brand, deviceModel: deviceLabel.slice(brand.length).trim() || deviceLabel }
  }
  const [first, ...rest] = deviceLabel.split(' ')
  return { deviceBrand: brand || first || '', deviceModel: brand ? deviceLabel : rest.join(' ') }
}
