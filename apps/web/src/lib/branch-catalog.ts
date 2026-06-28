/** Mirror of backend destBranchSku — branch-scoped catalog SKU suffix. */
export function destBranchSku(baseSku: string, toBranchId: string) {
  const suffix = `-BR${toBranchId.slice(-6).toUpperCase()}`
  const max = 100 - suffix.length
  return `${baseSku.slice(0, max)}${suffix}`
}
