export type ProductCondition = 'BRAND_NEW' | 'USED'

export const PRODUCT_CONDITION_OPTS: { value: ProductCondition; label: string }[] = [
  { value: 'BRAND_NEW', label: 'Brand New' },
  { value: 'USED', label: 'Used' },
]

export function productConditionLabel(value?: string | null): string {
  return PRODUCT_CONDITION_OPTS.find(o => o.value === value)?.label ?? 'Brand New'
}
