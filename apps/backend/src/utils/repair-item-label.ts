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
