import { formatWarrantyPeriodLabel } from '@/components/pos/cart-rules'
import { productConditionLabel } from '@/lib/productCondition'

export type ExchangeTradeInBill = {
  productName: string
  imei?: string
  storage?: string
  color?: string
  condition?: string
  creditAmount: number
}

function parseTradeInFromNotes(notes?: string | null): ExchangeTradeInBill | null {
  if (!notes) return null
  const line = notes.split('\n').find(l => l.trim().startsWith('Trade-in:'))
  if (!line) return null

  const imeiMatch = line.match(/IMEI\s+(\d{15})/i)
  const amountMatch = line.match(/LKR\s*([\d,]+(?:\.\d+)?)/i)
  const creditAmount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0
  if (!creditAmount) return null

  const namePart = line.replace(/^Trade-in:\s*/i, '').split('(')[0].trim()
  return {
    productName: namePart || 'Trade-in device',
    imei: imeiMatch?.[1],
    creditAmount,
  }
}

export function tradeInFromExchange(exchange: {
  oldBrand?: string | null
  oldModel?: string | null
  oldProductName?: string | null
  oldImei?: string | null
  oldStorage?: string | null
  oldColor?: string | null
  oldCondition?: string | null
  exchangeValue?: number | null
} | null | undefined): ExchangeTradeInBill | null {
  if (!exchange) return null
  const creditAmount = Number(exchange.exchangeValue ?? 0)
  if (creditAmount <= 0) return null

  const productName =
    [exchange.oldBrand, exchange.oldModel].filter(Boolean).join(' ').trim()
    || exchange.oldProductName?.trim()
    || 'Trade-in device'

  return {
    productName,
    imei: exchange.oldImei?.trim() || undefined,
    storage: exchange.oldStorage?.trim() || undefined,
    color: exchange.oldColor?.trim() || undefined,
    condition: exchange.oldCondition?.trim() || undefined,
    creditAmount,
  }
}

export function tradeInFromSale(sale: {
  source?: string | null
  notes?: string | null
  discount?: number | null
} | null | undefined): ExchangeTradeInBill | null {
  if (!sale || sale.source !== 'EXCHANGE') return null
  const fromNotes = parseTradeInFromNotes(sale.notes)
  if (fromNotes) return fromNotes

  const creditAmount = Number(sale.discount ?? 0)
  if (creditAmount <= 0) return null
  return { productName: 'Trade-in device', creditAmount }
}

export function tradeInLineLabel(tradeIn: ExchangeTradeInBill): string {
  return `Trade-in: ${tradeIn.productName}`
}

export function tradeInDetailLines(tradeIn: ExchangeTradeInBill): string[] {
  const lines: string[] = []
  if (tradeIn.storage || tradeIn.color) {
    lines.push([tradeIn.storage, tradeIn.color].filter(Boolean).join(' · '))
  }
  if (tradeIn.imei) lines.push(`IMEI: ${tradeIn.imei}`)
  if (tradeIn.condition) lines.push(`Condition: ${tradeIn.condition}`)
  return lines
}

export function parseVariationString(variation?: string | null): { storage?: string; color?: string } {
  if (!variation?.includes('::')) return {}
  const [storage, color] = variation.split('::').map(s => s.trim())
  return {
    storage: storage || undefined,
    color: color || undefined,
  }
}

export function soldVariantFromSale(sale: {
  notes?: string | null
  items?: { sku?: string | null }[] | null
} | null | undefined): { storage?: string; color?: string } {
  if (!sale) return {}
  const line = sale.notes?.split('\n').find(l => l.trim().toLowerCase().startsWith('sold variant:'))
  if (line) {
    const body = line.replace(/^sold variant:\s*/i, '').trim()
    const [storage, color] = body.split('/').map(s => s.trim())
    if (storage || color) return { storage: storage || undefined, color: color || undefined }
  }
  const sku = sale.items?.[0]?.sku
  return parseVariationString(sku)
}

export function soldVariantFromExchange(exchange: {
  newStorage?: string | null
  newColor?: string | null
  soldVariation?: string | null
} | null | undefined): { storage?: string; color?: string } {
  if (!exchange) return {}
  const storage = exchange.newStorage?.trim() || undefined
  const color = exchange.newColor?.trim() || undefined
  if (storage || color) return { storage, color }
  return parseVariationString(exchange.soldVariation)
}

export function variantLabel(storage?: string, color?: string): string | undefined {
  const line = [storage, color].filter(Boolean).join(' / ')
  return line || undefined
}

export function productNameWithVariant(name: string, storage?: string, color?: string): string {
  const variant = variantLabel(storage, color)
  if (!variant) return name
  return `${name} · ${variant}`
}

export function soldConditionFromSale(sale: {
  notes?: string | null
} | null | undefined): 'BRAND_NEW' | 'USED' | undefined {
  const line = sale?.notes?.split('\n').find(l => l.trim().toLowerCase().startsWith('sold condition:'))
  if (!line) return undefined
  const val = line.replace(/^sold condition:\s*/i, '').trim().toUpperCase().replace(/\s+/g, '_')
  if (val === 'USED') return 'USED'
  if (val === 'BRAND_NEW') return 'BRAND_NEW'
  return undefined
}

export function fmtReceiptValidUntil(saleDate?: string, months?: number, endDate?: string): string | undefined {
  if (endDate) {
    return new Date(endDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  if (saleDate && months && months > 0) {
    const d = new Date(saleDate)
    d.setMonth(d.getMonth() + months)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  return undefined
}

export function soldItemDetailLines(opts: {
  storage?: string
  color?: string
  imei?: string
  condition?: 'BRAND_NEW' | 'USED' | string
  warrantyMonths?: number
  warrantyEndDate?: string
  saleDate?: string
  includeVariant?: boolean
}): string[] {
  const lines: string[] = []
  if (opts.includeVariant !== false) {
    const variant = variantLabel(opts.storage, opts.color)
    if (variant) lines.push(variant)
  }
  if (opts.condition) {
    lines.push(`Condition: ${productConditionLabel(opts.condition)}`)
  }
  if (opts.imei) lines.push(`IMEI: ${opts.imei}`)
  if ((opts.warrantyMonths ?? 0) > 0) {
    lines.push(`Warranty: ${formatWarrantyPeriodLabel(opts.warrantyMonths!)}`)
    const until = fmtReceiptValidUntil(opts.saleDate, opts.warrantyMonths, opts.warrantyEndDate)
    if (until) lines.push(`Valid until: ${until}`)
  }
  return lines
}
