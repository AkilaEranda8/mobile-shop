/** Detect POS reload / recharge-card sale lines (aligned with daily-closing). */
export function isReloadSaleItem(item: { sku?: string | null; productName?: string | null }) {
  const sku = (item.sku ?? '').toUpperCase()
  const name = (item.productName ?? '').toLowerCase()
  return (
    sku.startsWith('RELOAD-')
    || sku.startsWith('RCARD-')
    || name.includes('reload')
    || name.includes('recharge card')
  )
}
