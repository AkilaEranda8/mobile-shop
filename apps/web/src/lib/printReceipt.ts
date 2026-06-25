import { printThermalReceipt } from '@/components/invoice/ThermalReceipt'
import { printStockFormInvoice, type StockFormSale } from '@/components/invoice/StockFormInvoice'
import type { InvoiceSettings, ShopContext } from '@/lib/invoiceSettings'
import {
  tradeInFromSale,
  tradeInLineLabel,
  parseVariationString,
  soldVariantFromSale,
  soldConditionFromSale,
  productNameWithVariant,
  type ExchangeTradeInBill,
} from '@/lib/exchangeBill'

export type ReceiptSale = StockFormSale

export function receiptPrintLabel(settings: InvoiceSettings): string {
  return settings.thermalWidthPOS === 'stockForm' ? 'Stock Form Print' : 'Thermal Print'
}

/** Uses POS thermal / stock-form settings (`thermalWidthPOS`). */
export function printReceipt(sale: ReceiptSale, settings: InvoiceSettings, ctx?: ShopContext): void {
  if (settings.thermalWidthPOS === 'stockForm') {
    printStockFormInvoice(sale, settings, ctx)
  } else {
    printThermalReceipt(sale, settings, ctx)
  }
}

function findWarrantyForItem(
  item: { imei?: string },
  warranties: Array<{ imei?: string; endDate?: string; monthsDuration?: number }>,
) {
  if (!warranties.length) return undefined
  if (item.imei) {
    const match = warranties.find(w => w.imei === item.imei)
    if (match) return match
  }
  return warranties[0]
}

function appendTradeInItem(
  items: StockFormSale['items'],
  tradeIn: ExchangeTradeInBill,
): StockFormSale['items'] {
  return [
    ...items,
    {
      productName: productNameWithVariant(tradeInLineLabel(tradeIn), tradeIn.storage, tradeIn.color),
      quantity: 1,
      unitPrice: -tradeIn.creditAmount,
      total: -tradeIn.creditAmount,
      imei: tradeIn.imei,
      storage: tradeIn.storage,
      color: tradeIn.color,
      itemNotes: tradeIn.condition ? `Condition: ${tradeIn.condition}` : undefined,
    },
  ]
}

export function buildReceiptFromApiSale(
  sale: any,
  opts?: {
    warranties?: any[]
    customerAddress?: string
    cashierName?: string
    tradeIn?: ExchangeTradeInBill | null
    soldVariant?: { storage?: string; color?: string } | null
    soldCondition?: 'BRAND_NEW' | 'USED'
  },
): ReceiptSale {
  const tradeIn = opts?.tradeIn ?? tradeInFromSale(sale)
  const soldVar = opts?.soldVariant ?? soldVariantFromSale(sale)
  const soldCondition = opts?.soldCondition ?? soldConditionFromSale(sale) ?? 'BRAND_NEW'

  const warranties = (opts?.warranties ?? sale.warranties ?? []).map((w: any) => ({
    warrantyCode: w.warrantyCode ?? w.code,
    productName: w.productName,
    imei: w.imei,
    endDate: w.endDate ?? w.expiresAt,
    monthsDuration: w.monthsDuration ?? w.warrantyMonths,
  }))

  let items = (sale.items ?? []).map((i: any) => {
    const fromSku = parseVariationString(i.sku)
    const storage = soldVar.storage ?? fromSku.storage
    const color = soldVar.color ?? fromSku.color
    const warranty = findWarrantyForItem(i, warranties)
    const warrantyMonths = Number(i.warrantyMonths ?? warranty?.monthsDuration ?? 0) || undefined

    return {
      productName: productNameWithVariant(i.productName, storage, color),
      quantity: Number(i.quantity ?? 1),
      unitPrice: Number(i.unitPrice),
      total: Number(i.total),
      sku: i.sku ?? undefined,
      imei: i.imei ?? undefined,
      storage,
      color,
      condition: i.imei ? soldCondition : undefined,
      warrantyMonths,
      warrantyEndDate: warranty?.endDate,
    }
  })

  if (tradeIn) {
    items = appendTradeInItem(items, tradeIn)
  }

  const payments = (sale.payments ?? []).map((p: any) => ({
    method: String(p.method),
    amount: Number(p.amount),
  }))

  const warrantyNumbers = warranties
    .map((w: { warrantyCode?: string }) => w.warrantyCode)
    .filter(Boolean) as string[]

  const maxWarrantyMonths = Math.max(
    0,
    ...items.map(i => i.warrantyMonths ?? 0),
    ...warranties.map(w => w.monthsDuration ?? 0),
  )

  return {
    invoiceNumber: sale.invoiceNumber,
    createdAt: sale.createdAt,
    customerName: sale.customerName,
    customerPhone: sale.customerPhone,
    customerAddress: opts?.customerAddress ?? sale.customerAddress,
    cashierName: opts?.cashierName ?? sale.cashierName,
    items,
    subtotal: Number(sale.subtotal ?? 0),
    discountAmount: tradeIn ? 0 : Number(sale.discount ?? sale.discountAmount ?? 0),
    total: Number(sale.total ?? 0),
    paymentMethod: sale.paymentMethod ?? payments[0]?.method ?? 'CASH',
    payments: payments.length ? payments : undefined,
    cashReceived: sale.cashReceived != null ? Number(sale.cashReceived) : undefined,
    changeAmount: sale.changeAmount != null ? Number(sale.changeAmount) : undefined,
    warrantyNumbers: warrantyNumbers.length ? warrantyNumbers : undefined,
    warrantyMonths: maxWarrantyMonths > 0 ? maxWarrantyMonths : undefined,
    warranties: warranties.length ? warranties : undefined,
    dueAmount: sale.dueAmount != null ? Number(sale.dueAmount) : undefined,
    tradeIn: tradeIn ?? undefined,
  }
}
