/** POS / catalog price mode: non-retail modes fall back to retail when unset (0). */
export type PriceMode = 'retail' | 'wholesale' | 'credit'

export function resolveCatalogPrice(
  item: {
    sellingPrice?: number
    wholesalePrice?: number
    creditPrice?: number
    price?: number
  } | null | undefined,
  mode: PriceMode = 'retail',
): number {
  if (!item) return 0
  const retail = Number(item.sellingPrice ?? item.price) || 0
  if (mode === 'wholesale') {
    const wholesale = Number(item.wholesalePrice) || 0
    return wholesale > 0 ? wholesale : retail
  }
  if (mode === 'credit') {
    const credit = Number(item.creditPrice) || 0
    return credit > 0 ? credit : retail
  }
  return retail
}
