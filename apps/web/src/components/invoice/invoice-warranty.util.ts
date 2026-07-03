import { formatWarrantyPeriodLabel, matchWarrantyMonths } from '@/components/pos/cart-rules'

export interface ItemWarrantyInfo {
  warrantyCode?: string
  warrantyPeriod?: string
  warrantyExpiry?: string
}

export type SaleWarranty = {
  warrantyCode?: string
  productName?: string
  imei?: string
  endDate?: string
  monthsDuration?: number
}

export function resolveSaleWarranties(sale: {
  warranties?: SaleWarranty[]
  warrantyNumbers?: string[]
  warrantyMonths?: number
}): SaleWarranty[] {
  if (Array.isArray(sale.warranties) && sale.warranties.length > 0) {
    return sale.warranties
  }
  return (sale.warrantyNumbers ?? []).map(code => ({
    warrantyCode: code,
    monthsDuration: sale.warrantyMonths,
  }))
}

export function fmtWarrantyExpiryDate(
  endDate?: string,
  saleCreatedAt?: string,
  months?: number,
): string | undefined {
  if (endDate) {
    return new Date(endDate).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }
  if (saleCreatedAt && months && months > 0) {
    const d = new Date(saleCreatedAt)
    d.setMonth(d.getMonth() + months)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  return undefined
}

function matchWarrantyForItem(
  item: { productName?: string; imei?: string },
  warranties: SaleWarranty[],
  itemIndex: number,
): SaleWarranty | undefined {
  if (item.imei) {
    const byImei = warranties.find(w => w.imei && w.imei === item.imei)
    if (byImei) return byImei
  }
  if (item.productName) {
    const byName = warranties.find(w => w.productName && w.productName === item.productName)
    if (byName) return byName
  }
  return warranties[itemIndex]
}

export function buildItemWarrantyInfo(
  item: {
    productName?: string
    imei?: string
    warrantyMonths?: number
    warrantyEndDate?: string
  },
  warranties: SaleWarranty[],
  saleCreatedAt?: string,
  saleWarrantyMonths?: number,
  itemIndex = 0,
): ItemWarrantyInfo | undefined {
  const matched = matchWarrantyForItem(item, warranties, itemIndex)
  const months = matched
    ? matchWarrantyMonths(matched, [item], saleWarrantyMonths)
    : (item.warrantyMonths ?? 0)

  const warrantyCode = matched?.warrantyCode
  const warrantyPeriod = months > 0 ? formatWarrantyPeriodLabel(months) : undefined
  const warrantyExpiry = item.warrantyEndDate
    ? fmtWarrantyExpiryDate(item.warrantyEndDate)
    : fmtWarrantyExpiryDate(matched?.endDate, saleCreatedAt, months)

  if (!warrantyCode && !warrantyPeriod && !warrantyExpiry) return undefined

  return { warrantyCode, warrantyPeriod, warrantyExpiry }
}
