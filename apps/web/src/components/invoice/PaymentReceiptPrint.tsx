'use client'

import { forwardRef, useRef } from 'react'
import { Download, Printer } from 'lucide-react'
import { HEXALYTE_SOFTWARE_FOOTER, type InvoiceSettings } from '@/lib/invoiceSettings'
import { buildItemWarrantyInfo, resolveSaleWarranties, type ItemWarrantyInfo } from '@/components/invoice/invoice-warranty.util'
import InvoiceItemWarrantyBlock from '@/components/invoice/InvoiceItemWarrantyBlock'

export interface PaymentReceiptItem {
  item: string
  description: string
  warranty?: ItemWarrantyInfo
  qty: number
  rate: number
  total: number
}

export interface PaymentReceiptData {
  receiptNumber: string
  receiptDate: string
  clientName: string
  items: PaymentReceiptItem[]
  subtotal: number
  discount: number
  advance: number
  balanceDue: number
  currency?: string
}

const MIN_ROWS = 13
const FONT = "Arial, Helvetica, sans-serif"
const C = {
  text: '#111827',
  muted: '#6b7280',
  line: '#d1d5db',
  headerBg: '#111827',
  rowAlt: '#f3f4f6',
  valueBg: '#e5e7eb',
}

const makeFmt = (currency = 'LKR') => (n: number) =>
  new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

export function buildPaymentReceiptData(
  sale: any,
  settings: InvoiceSettings,
  extras?: { subtotal?: number; discountAmount?: number },
): PaymentReceiptData {
  const warranties = resolveSaleWarranties(sale)
  const items: PaymentReceiptItem[] = (sale.items ?? []).map((i: any, idx: number) => {
    const qty = i.quantity ?? 1
    const rate = i.unitPrice ?? 0
    const lineDisc = i.discount ?? 0
    const lineSub = rate * qty
    return {
      item: i.productName ?? i.description ?? 'Item',
      description: [i.sku, i.imei ? `IMEI: ${i.imei}` : ''].filter(Boolean).join(' · ') || '—',
      warranty: buildItemWarrantyInfo(i, warranties, sale.createdAt, sale.warrantyMonths, idx),
      qty,
      rate,
      total: i.total ?? lineSub - lineDisc,
    }
  })

  const subtotal = extras?.subtotal ?? sale.subtotal ?? items.reduce((s, i) => s + i.rate * i.qty, 0)
  const discount = extras?.discountAmount ?? sale.discount ?? 0
  const total = sale.total ?? subtotal - discount + (sale.tax ?? 0)
  const advance = sale.paidAmount ?? Math.max(0, total - (sale.dueAmount ?? 0))
  const balanceDue = sale.dueAmount ?? Math.max(0, total - advance)

  const receiptDate = sale.createdAt
    ? new Date(sale.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return {
    receiptNumber: sale.invoiceNumber ?? `INV-${Date.now()}`,
    receiptDate,
    clientName: sale.customerName || 'Walk-in Customer',
    items,
    subtotal,
    discount,
    advance,
    balanceDue,
    currency: settings.currency || 'LKR',
  }
}

export const SAMPLE_PAYMENT_RECEIPT: PaymentReceiptData = {
  receiptNumber: 'INV-202607-000004',
  receiptDate: '02/07/2026',
  clientName: 'Akila Eranda Gankewela',
  items: [
    {
      item: 'iPhone 15 Pro',
      description: '256GB · Natural Titanium',
      warranty: { warrantyCode: 'WR-EYM1GH31', warrantyPeriod: '3 months', warrantyExpiry: '03/10/2026' },
      qty: 1,
      rate: 285000,
      total: 285000,
    },
    { item: 'Screen Guard', description: 'Tempered glass', qty: 2, rate: 1500, total: 3000 },
  ],
  subtotal: 288000,
  discount: 3000,
  advance: 288000,
  balanceDue: 0,
  currency: 'LKR',
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', border: `1px solid ${C.line}` }}>
      <div style={{
        background: C.headerBg, color: '#fff', fontSize: 11, fontWeight: 700,
        padding: '6px 10px', minWidth: 96, borderRight: `1px solid ${C.line}`,
      }}>{label}</div>
      <div style={{
        flex: 1, background: C.valueBg, fontSize: 11, fontWeight: 600,
        padding: '6px 10px', color: C.text,
      }}>{value}</div>
    </div>
  )
}

function TotalLine({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
      <span style={{
        fontSize: 11, fontWeight: highlight ? 800 : 600,
        background: highlight ? C.headerBg : 'transparent',
        color: highlight ? '#fff' : C.text,
        padding: highlight ? '5px 8px' : 0,
        minWidth: highlight ? 140 : undefined,
      }}>{label}</span>
      <span style={{
        fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
        background: highlight ? C.valueBg : 'transparent',
        padding: highlight ? '5px 10px' : 0,
        minWidth: highlight ? 72 : undefined,
        textAlign: 'right',
      }}>{value}</span>
    </div>
  )
}

const PaymentReceiptPrint = forwardRef<
  HTMLDivElement,
  { data: PaymentReceiptData; settings: InvoiceSettings; hideControls?: boolean }
>(function PaymentReceiptPrint({ data, settings, hideControls = false }, outerRef) {
  const localRef = useRef<HTMLDivElement>(null)
  const invoiceRef = (outerRef as React.RefObject<HTMLDivElement>) ?? localRef
  const fmt = makeFmt(data.currency)

  const brandName = settings.shopName || 'Your Business'
  const legalName = settings.companyLegalName || brandName
  const logo = settings.logo?.trim()
  const website = settings.website || ''
  const emptyRows = Math.max(0, MIN_ROWS - data.items.length)

  const primaryBank = [
    settings.bankName && `Bank: ${settings.bankName}`,
    settings.accNumber && `Account No: ${settings.accNumber}`,
    settings.swiftCode && `Branch: ${settings.swiftCode}`,
    settings.accHolder && `Name: ${settings.accHolder}`,
  ].filter(Boolean).join('\n')

  const paymentInfo = settings.bankDetails?.trim() || primaryBank || 'Add bank details in Invoice settings.'
  const remarks = (settings.terms ?? []).filter(Boolean).join(' ') || settings.footerNote || ''

  const handleDownloadPDF = async () => {
    if (!invoiceRef.current) return
    const { default: html2canvas } = await import('html2canvas')
    const { default: jsPDF } = await import('jspdf')
    const canvas = await html2canvas(invoiceRef.current, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pdfW = pdf.internal.pageSize.getWidth()
    const pdfH = (canvas.height * pdfW) / canvas.width
    pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH)
    pdf.save(`receipt-${data.receiptNumber}.pdf`)
  }

  const handlePrint = () => {
    if (!invoiceRef.current) return
    const w = window.open('', '_blank', 'width=820,height=1160')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><title>Receipt ${data.receiptNumber}</title>
      <style>@page{size:A4;margin:12mm}body{margin:0;font-family:Arial,Helvetica,sans-serif}</style></head>
      <body>${invoiceRef.current.outerHTML}</body></html>`)
    w.document.close()
    w.focus()
    w.print()
    w.close()
  }

  const th: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4,
    padding: '8px 6px', color: '#fff', background: C.headerBg, border: 'none', textAlign: 'left',
  }
  const td: React.CSSProperties = {
    fontSize: 10, padding: '7px 6px', verticalAlign: 'top', color: C.text, border: 'none',
  }

  const subLessDisc = data.subtotal - data.discount
  const year = new Date().getFullYear()

  const body = (
    <div
      ref={invoiceRef}
      style={{
        width: 794, minHeight: 1123, margin: hideControls ? 0 : '0 auto',
        background: '#fff', color: C.text, fontFamily: FONT,
        padding: '32px 40px 24px', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, paddingBottom: 14, borderBottom: `1.5px solid ${C.text}` }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {logo ? (
            <img src={logo} alt={brandName} style={{ maxHeight: 56, maxWidth: 200, objectFit: 'contain', marginBottom: 6 }} crossOrigin="anonymous" />
          ) : (
            <p style={{ margin: '0 0 2px', fontSize: 28, fontWeight: 900, letterSpacing: 0.5, lineHeight: 1.1 }}>{brandName}</p>
          )}
          {settings.slogan && <p style={{ margin: '4px 0 0', fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: C.muted }}>{settings.slogan}</p>}
          {website && <p style={{ margin: '6px 0 0', fontSize: 10, color: C.muted }}>{website}</p>}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, maxWidth: 280 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3 }}>{legalName}</p>
          {settings.phone && <p style={{ margin: '6px 0 0', fontSize: 10, color: C.text }}>{settings.phone}</p>}
          {settings.email && <p style={{ margin: '2px 0 0', fontSize: 10, color: C.text }}>{settings.email}</p>}
        </div>
      </div>

      {/* Title */}
      <h1 style={{ margin: '22px 0 16px', textAlign: 'center', fontSize: 22, fontWeight: 900, letterSpacing: 1.5, textTransform: 'uppercase' }}>
        Payment Receipt
      </h1>

      {/* Client + meta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, marginBottom: 14 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
          <span style={{ fontWeight: 800 }}>Client :</span> {data.clientName}
        </p>
        <div style={{ width: 260, flexShrink: 0 }}>
          <MetaCell label="Receipt Date" value={data.receiptDate} />
          <MetaCell label="Receipt No" value={data.receiptNumber} />
        </div>
      </div>

      {/* Items table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: `1.5px solid ${C.text}`, borderBottom: `1.5px solid ${C.text}` }}>
        <thead>
          <tr>
            <th style={{ ...th, width: 36, textAlign: 'center' }}>No</th>
            <th style={{ ...th, width: 120 }}>Item</th>
            <th style={th}>Description</th>
            <th style={{ ...th, width: 44, textAlign: 'center' }}>Qty.</th>
            <th style={{ ...th, width: 80, textAlign: 'right' }}>Rate</th>
            <th style={{ ...th, width: 88, textAlign: 'right' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, idx) => (
            <tr key={idx} style={{ background: idx % 2 === 1 ? C.rowAlt : '#fff' }}>
              <td style={{ ...td, textAlign: 'center' }}>{idx + 1}</td>
              <td style={{ ...td, fontWeight: 600 }}>{item.item}</td>
              <td style={{ ...td, color: C.muted }}>
                <div>{item.description}</div>
                <InvoiceItemWarrantyBlock info={item.warranty} fontSize={9} color={C.muted} />
              </td>
              <td style={{ ...td, textAlign: 'center' }}>{item.qty}</td>
              <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(item.rate)}</td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(item.total)}</td>
            </tr>
          ))}
          {Array.from({ length: emptyRows }).map((_, i) => (
            <tr key={`e-${i}`} style={{ background: (data.items.length + i) % 2 === 1 ? C.rowAlt : '#fff' }}>
              <td style={{ ...td, height: 26 }}>&nbsp;</td>
              <td style={td} />
              <td style={td} />
              <td style={td} />
              <td style={td} />
              <td style={td} />
            </tr>
          ))}
        </tbody>
      </table>

      {/* Payment info + totals */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 28, marginTop: 18, flex: 1 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>Payment Information</p>
          <pre style={{ margin: 0, fontSize: 10, lineHeight: 1.55, whiteSpace: 'pre-wrap', fontFamily: FONT, color: C.text }}>{paymentInfo}</pre>
          {remarks && (
            <div style={{ marginTop: 14 }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 800 }}>Remarks:</p>
              <p style={{ margin: 0, fontSize: 10, lineHeight: 1.5, color: C.muted }}>{remarks}</p>
            </div>
          )}
        </div>
        <div style={{ width: 250, flexShrink: 0 }}>
          <TotalLine label="Sub Total" value={fmt(data.subtotal)} />
          <TotalLine label="Discount" value={fmt(data.discount)} />
          <TotalLine label="Sub Total less Discount" value={fmt(subLessDisc)} />
          <TotalLine label="Advance" value={fmt(data.advance)} />
          <div style={{ marginTop: 6 }}>
            <TotalLine label={`Balance Due (${data.currency ?? 'LKR'})`} value={fmt(data.balanceDue)} highlight />
          </div>
          <div style={{ marginTop: 28, textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: 10, color: C.muted }}>Authorised Sign</p>
            <div style={{ marginTop: 28, borderBottom: `1px dotted ${C.muted}`, width: 160, marginLeft: 'auto' }} />
            {settings.signatoryName && <p style={{ margin: '6px 0 0', fontSize: 10, fontWeight: 600 }}>{settings.signatoryName}</p>}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: `1px solid ${C.line}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <p style={{ margin: 0, fontSize: 9, color: C.muted, flex: 1, textAlign: 'center' }}>
            Copyright © {year} {legalName}. All Rights Reserved.
          </p>
          {logo && (
            <img src={logo} alt="" style={{ maxHeight: 28, maxWidth: 100, objectFit: 'contain', marginLeft: 12 }} crossOrigin="anonymous" />
          )}
        </div>
        {!hideControls && (
          <p style={{ margin: '8px 0 0', fontSize: 8, color: '#9ca3af', textAlign: 'center' }}>{HEXALYTE_SOFTWARE_FOOTER}</p>
        )}
      </div>
    </div>
  )

  if (hideControls) return body

  return (
    <div>
      <div className="flex items-center justify-center gap-2 mb-4 print:hidden">
        <button type="button" onClick={handlePrint} className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-white/10 bg-white/5 text-white hover:bg-white/10">
          <Printer size={14} /> Print
        </button>
        <button type="button" onClick={handleDownloadPDF} className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-500">
          <Download size={14} /> Download PDF
        </button>
      </div>
      {body}
    </div>
  )
})

export default PaymentReceiptPrint
