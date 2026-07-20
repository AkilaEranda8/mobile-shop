/** POS / catalog price mode: retail = sellingPrice, wholesale falls back to retail when unset. */
export type PriceMode = 'retail' | 'wholesale'

export function resolveCatalogPrice(
  item: { sellingPrice?: number; wholesalePrice?: number; price?: number } | null | undefined,
  mode: PriceMode = 'retail',
): number {
  if (!item) return 0
  const retail = Number(item.sellingPrice ?? item.price) || 0
  if (mode === 'wholesale') {
    const wholesale = Number(item.wholesalePrice) || 0
    return wholesale > 0 ? wholesale : retail
  }
  return retail
}
