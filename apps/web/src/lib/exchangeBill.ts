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
