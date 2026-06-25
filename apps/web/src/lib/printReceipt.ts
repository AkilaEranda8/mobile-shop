import { printThermalReceipt } from '@/components/invoice/ThermalReceipt'
import { printStockFormInvoice, type StockFormSale } from '@/components/invoice/StockFormInvoice'
import type { InvoiceSettings, ShopContext } from '@/lib/invoiceSettings'

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

export function buildReceiptFromApiSale(
  sale: any,
  opts?: {
    warranties?: any[]
    customerAddress?: string
    cashierName?: string
  },
): ReceiptSale {
  const items = (sale.items ?? []).map((i: any) => ({
    productName: i.productName,
    quantity: Number(i.quantity ?? 1),
    unitPrice: Number(i.unitPrice),
    total: Number(i.total),
    sku: i.sku ?? undefined,
    imei: i.imei ?? undefined,
    warrantyMonths: i.warrantyMonths ?? undefined,
  }))

  const payments = (sale.payments ?? []).map((p: any) => ({
    method: String(p.method),
    amount: Number(p.amount),
  }))

  const warranties = (opts?.warranties ?? sale.warranties ?? []).map((w: any) => ({
    warrantyCode: w.warrantyCode ?? w.code,
    productName: w.productName,
    imei: w.imei,
    endDate: w.endDate ?? w.expiresAt,
    monthsDuration: w.monthsDuration ?? w.warrantyMonths,
  }))

  const warrantyNumbers = warranties
    .map((w: { warrantyCode?: string }) => w.warrantyCode)
    .filter(Boolean) as string[]

  return {
    invoiceNumber: sale.invoiceNumber,
    createdAt: sale.createdAt,
    customerName: sale.customerName,
    customerPhone: sale.customerPhone,
    customerAddress: opts?.customerAddress ?? sale.customerAddress,
    cashierName: opts?.cashierName ?? sale.cashierName,
    items,
    subtotal: Number(sale.subtotal ?? 0),
    discountAmount: Number(sale.discount ?? sale.discountAmount ?? 0),
    total: Number(sale.total ?? 0),
    paymentMethod: sale.paymentMethod ?? payments[0]?.method ?? 'CASH',
    payments: payments.length ? payments : undefined,
    cashReceived: sale.cashReceived != null ? Number(sale.cashReceived) : undefined,
    changeAmount: sale.changeAmount != null ? Number(sale.changeAmount) : undefined,
    warrantyNumbers: warrantyNumbers.length ? warrantyNumbers : undefined,
    warrantyMonths: sale.warrantyMonths ?? warranties[0]?.monthsDuration,
    warranties: warranties.length ? warranties : undefined,
    dueAmount: sale.dueAmount != null ? Number(sale.dueAmount) : undefined,
  }
}
