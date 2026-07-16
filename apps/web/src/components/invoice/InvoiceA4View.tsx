'use client'

import { forwardRef } from 'react'
import InvoicePrint, { type InvoiceData } from '@/components/invoice/InvoicePrint'
import KasthuriInvoicePrint, { buildKasthuriInvoiceData } from '@/components/invoice/KasthuriInvoicePrint'
import PaymentReceiptPrint, { buildPaymentReceiptData } from '@/components/invoice/PaymentReceiptPrint'
import {
  resolveInvoiceTemplate,
  type InvoiceSettings,
  type InvoiceTemplateId,
} from '@/lib/invoiceSettings'
import { buildItemWarrantyInfo, resolveSaleWarranties } from '@/components/invoice/invoice-warranty.util'
import { mapSaleItemForInvoice, repairInvoiceSaleItems, isRepairSparePartLine, extractInvoiceNotesFromSale } from '@/components/invoice/invoice-line-item.util'

export interface InvoiceA4ViewProps {
  sale: any
  settings: InvoiceSettings
  tenantSlug?: string
  shopName?: string
  template?: InvoiceTemplateId
  hideControls?: boolean
  extras?: { subtotal?: number; discountAmount?: number }
}

export function buildDefaultInvoiceData(
  sale: any,
  settings: InvoiceSettings,
  shopName = 'Our Shop',
  extras?: { subtotal?: number; discountAmount?: number },
): InvoiceData {
  const subtotal = extras?.subtotal ?? sale.subtotal ?? 0
  const discountAmount = extras?.discountAmount ?? sale.discount ?? 0
  const warranties = resolveSaleWarranties(sale)
  const isRepair = sale.source === 'REPAIR'
  return {
    companyName: settings.shopName || shopName,
    companySlogan: settings.slogan || 'Sales & Service',
    companyLogo: settings.logo || undefined,
    companyAddress: settings.address || '',
    companyPhone: settings.phone || '',
    companyEmail: settings.email || '',
    companyWebsite: settings.website || '',
    invoiceNumber: sale.invoiceNumber || `INV-${Date.now()}`,
    dueDate: sale.createdAt
      ? new Date(sale.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
    customerName: sale.customerName || 'Walk-in Customer',
    customerEmail: sale.customerEmail || '',
    customerAddress: sale.customerPhone ? `Phone: ${sale.customerPhone}` : '',
    items: repairInvoiceSaleItems(sale).map((i: any, idx: number) => {
      const { title, details } = mapSaleItemForInvoice(i, { sale, index: idx })
      return {
        description: title,
        details,
        warranty: buildItemWarrantyInfo(i, warranties, sale.createdAt, sale.warrantyMonths, idx, sale),
        price: i.unitPrice ?? 0,
        qty: i.quantity ?? 1,
        isRepairPart: isRepairSparePartLine(i, sale),
      }
    }),
    bankName: settings.bankName || '',
    accNumber: settings.accNumber || '',
    accHolder: settings.accHolder || settings.shopName || shopName,
    swiftCode: settings.swiftCode || '',
    currency: settings.currency || 'LKR',
    taxRate: settings.taxRate ?? 0,
    discountRate: subtotal > 0 ? Math.round((discountAmount / subtotal) * 100) : (settings.discountRate ?? 0),
    terms: settings.terms?.length
      ? settings.terms
      : ['Payment is due upon receipt of this invoice.', settings.footerNote || 'Thank you for your business!'],
    notes: extractInvoiceNotesFromSale(sale),
    signatoryName: settings.signatoryName || settings.shopName || shopName,
    signatoryTitle: settings.signatoryTitle || 'Authorized Signatory',
    subtotalOverride: isRepair ? subtotal : undefined,
    totalOverride: isRepair ? (sale.total ?? subtotal - discountAmount) : undefined,
  }
}

const InvoiceA4View = forwardRef<HTMLDivElement, InvoiceA4ViewProps>(function InvoiceA4View(
  { sale, settings, tenantSlug, shopName = 'Our Shop', template, hideControls = true, extras },
  ref,
) {
  const active = template ?? resolveInvoiceTemplate(settings, tenantSlug)

  if (active === 'kasthuri') {
    const data = buildKasthuriInvoiceData(sale, settings, extras)
    return <KasthuriInvoicePrint ref={ref} data={data} settings={settings} hideControls={hideControls} />
  }

  if (active === 'payment_receipt') {
    const data = buildPaymentReceiptData(sale, settings, extras)
    return <PaymentReceiptPrint ref={ref} data={data} settings={settings} hideControls={hideControls} />
  }

  const data = buildDefaultInvoiceData(sale, settings, shopName, extras)
  return <InvoicePrint ref={ref} data={data} hideControls={hideControls} />
})

export default InvoiceA4View

export const SAMPLE_SALE_FOR_PREVIEW = {
  invoiceNumber: 'INV-202607-000004',
  createdAt: new Date().toISOString(),
  customerName: 'Akila Eranda Gankewela',
  customerPhone: '+94 77 123 4567',
  subtotal: 288000,
  discount: 3000,
  tax: 0,
  total: 285000,
  paidAmount: 285000,
  dueAmount: 0,
  warrantyMonths: 3,
  warranties: [
    {
      warrantyCode: 'WR-EYM1GH31',
      productName: 'iPhone 15 Pro',
      monthsDuration: 3,
      endDate: '2026-10-03T00:00:00.000Z',
    },
  ],
  items: [
    {
      productName: 'iPhone 15 Pro',
      sku: 'IP15P-256',
      quantity: 1,
      unitPrice: 285000,
      total: 285000,
      warrantyMonths: 3,
    },
    { productName: 'Screen Guard', sku: 'SG-001', quantity: 2, unitPrice: 1500, total: 3000, discount: 3000 },
  ],
}
