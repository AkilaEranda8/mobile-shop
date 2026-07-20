import type { Product } from '@/types'
import { trackFlagToImeiType, type ImeiProductType } from '@/lib/productImei'
import type { ProductCondition } from '@/lib/productCondition'
import { variantSkuFromBase } from '@/lib/productCodes'

export { variantSkuFromBase }

export function warrantyMonthsToLabel(months: number): string {
  if (months >= 24) return '2 Years'
  if (months >= 12) return '1 Year'
  if (months >= 6) return '6 Months'
  if (months >= 3) return '3 Months'
  if (months >= 1) return '1 Month'
  return 'None'
}

export type ProductCopyDraft = {
  form: {
    name: string
    sku: string
    barcodeValue: string
    barcodeType: string
    brandName: string
    categoryName: string
    subCategory: string
    unit: string
    deviceModel: string
    description: string
    imageUrl: string
  }
  condition: ProductCondition
  imeiType: ImeiProductType
  imeiTouched: boolean
  warrantyTrack: boolean
  lowStock: boolean
  minStock: string
  manageStock: string
  initialQty: string
  pricing: {
    tax: string
    taxType: string
    purchaseEx: string
    purchaseInc: string
    sellingEx: string
    wholesaleEx: string
    creditEx: string
    margin: string
  }
  extra: {
    supplierId: string
    warranty: string
    warrantyNote: string
    hsCode: string
    tags: string
  }
  variants: Array<{
    id: string
    storage: string
    colorName: string
    colorHex: string
    sku: string
    sellingPrice: string
    wholesalePrice: string
    creditPrice: string
    costPrice: string
  }>
}

export type ProductCopySnapshot = {
  form: Omit<ProductCopyDraft['form'], 'sku' | 'barcodeValue'>
  condition: ProductCondition
  imeiType: ImeiProductType
  warrantyTrack: boolean
  lowStock: boolean
  minStock: string
  manageStock: string
  pricing: ProductCopyDraft['pricing']
  extra: ProductCopyDraft['extra']
  variants: Array<{
    storage: string
    colorName: string
    colorHex: string
    sellingPrice: string
    wholesalePrice: string
    creditPrice: string
    costPrice: string
  }>
}

function normPrice(value: string): string {
  const n = Number(value)
  return Number.isFinite(n) ? String(n) : value.trim()
}

function normVariants(
  rows: Array<{
    storage: string
    colorName: string
    colorHex: string
    sellingPrice: string
    wholesalePrice: string
    creditPrice: string
    costPrice: string
  }>,
) {
  return rows
    .map(v => ({
      storage: v.storage.trim(),
      colorName: v.colorName.trim(),
      colorHex: v.colorHex.trim().toLowerCase(),
      sellingPrice: normPrice(v.sellingPrice),
      wholesalePrice: normPrice(v.wholesalePrice),
      creditPrice: normPrice(v.creditPrice),
      costPrice: normPrice(v.costPrice),
    }))
    .sort((a, b) =>
      `${a.storage}-${a.colorName}`.localeCompare(`${b.storage}-${b.colorName}`),
    )
}

export function snapshotFromDraft(draft: ProductCopyDraft): ProductCopySnapshot {
  const { sku: _sku, barcodeValue: _barcode, ...form } = draft.form
  return {
    form: {
      ...form,
      name: form.name.trim(),
      brandName: form.brandName.trim(),
      categoryName: form.categoryName.trim(),
      subCategory: form.subCategory.trim(),
      unit: form.unit.trim(),
      deviceModel: form.deviceModel.trim(),
      description: form.description.trim(),
      imageUrl: form.imageUrl.trim(),
      barcodeType: form.barcodeType.trim(),
    },
    condition: draft.condition,
    imeiType: draft.imeiType,
    warrantyTrack: draft.warrantyTrack,
    lowStock: draft.lowStock,
    minStock: draft.minStock.trim(),
    manageStock: draft.manageStock.trim(),
    pricing: {
      ...draft.pricing,
      purchaseEx: normPrice(draft.pricing.purchaseEx),
      purchaseInc: normPrice(draft.pricing.purchaseInc),
      sellingEx: normPrice(draft.pricing.sellingEx),
      wholesaleEx: normPrice(draft.pricing.wholesaleEx),
      creditEx: normPrice(draft.pricing.creditEx),
      margin: normPrice(draft.pricing.margin),
    },
    extra: {
      supplierId: draft.extra.supplierId.trim(),
      warranty: draft.extra.warranty.trim(),
      warrantyNote: draft.extra.warrantyNote.trim(),
      hsCode: draft.extra.hsCode.trim(),
      tags: draft.extra.tags.trim(),
    },
    variants: normVariants(draft.variants),
  }
}

export function snapshotFromFormState(input: {
  form: ProductCopyDraft['form']
  condition: ProductCondition
  imeiType: ImeiProductType
  warrantyTrack: boolean
  lowStock: boolean
  minStock: string
  manageStock: string
  pricing: ProductCopyDraft['pricing']
  extra: ProductCopyDraft['extra']
  variants: ProductCopyDraft['variants']
}): ProductCopySnapshot {
  return snapshotFromDraft({
    ...input,
    form: input.form,
    imeiTouched: true,
    initialQty: '0',
  })
}

export function isProductCopyUnchanged(
  baseline: ProductCopySnapshot,
  current: ProductCopySnapshot,
): boolean {
  return JSON.stringify(baseline) === JSON.stringify(current)
}

export function buildProductCopyDraft(
  product: Product,
  genId: () => string,
): ProductCopyDraft {
  const buy = String(product.buyingPrice || '')
  const sell = String(product.sellingPrice || '')
  const wholesale = String(product.wholesalePrice || '')
  const credit = String(product.creditPrice || '')
  const margin = buy && sell && Number(buy) > 0
    ? String(Math.round(((Number(sell) - Number(buy)) / Number(buy)) * 10000) / 100)
    : ''

  const ext = product as Product & { subCategory?: string; deviceModel?: string }

  return {
    form: {
      name: product.name.trim(),
      sku: '',
      barcodeValue: '',
      barcodeType: 'Code 128 (C128)',
      brandName: product.brandName ?? '',
      categoryName: product.categoryName ?? '',
      subCategory: ext.subCategory ?? '',
      unit: 'Piece (Pc)',
      deviceModel: ext.deviceModel ?? '',
      description: product.description ?? '',
      imageUrl: product.imageUrl ?? '',
    },
    condition: (product.condition ?? 'BRAND_NEW') as ProductCondition,
    imeiType: trackFlagToImeiType(product.trackImei),
    imeiTouched: true,
    warrantyTrack: (product.warrantyMonths ?? 0) > 0,
    lowStock: (product.minStock ?? 0) > 0,
    minStock: String(product.minStock ?? 5),
    manageStock: 'Yes',
    initialQty: '0',
    pricing: {
      tax: 'None',
      taxType: 'Exclusive',
      purchaseEx: buy,
      purchaseInc: buy,
      sellingEx: sell,
      wholesaleEx: wholesale,
      creditEx: credit,
      margin,
    },
    extra: {
      supplierId: '',
      warranty: warrantyMonthsToLabel(product.warrantyMonths ?? 0),
      warrantyNote: product.warrantyNote ?? '',
      hsCode: '',
      tags: '',
    },
    variants: (product.storageVariations ?? []).map((v) => ({
      id: genId(),
      storage: v.storage,
      colorName: v.colorName,
      colorHex: v.colorHex,
      sku: '',
      sellingPrice: String(v.sellingPrice ?? ''),
      wholesalePrice: String(v.wholesalePrice ?? ''),
      creditPrice: String(v.creditPrice ?? ''),
      costPrice: String(v.costPrice ?? ''),
    })),
  }
}
