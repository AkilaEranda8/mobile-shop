import type { RepairTicket, RepairStatusHistory } from '@/types'

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
