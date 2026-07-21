/** Mirror of backend destBranchSku — branch-scoped catalog SKU suffix. */
export const BRANCH_CATALOG_SKU_SUFFIX_RE = /-BR[A-Z0-9]{6}$/i

export function destBranchSku(baseSku: string, toBranchId: string) {
  const suffix = `-BR${toBranchId.slice(-6).toUpperCase()}`
  const max = 100 - suffix.length
  return `${baseSku.slice(0, max)}${suffix}`
}

export function catalogBaseSku(sku: string) {
  return sku.replace(BRANCH_CATALOG_SKU_SUFFIX_RE, '')
}
