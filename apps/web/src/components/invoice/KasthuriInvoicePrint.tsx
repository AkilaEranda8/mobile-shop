'use client'

import { forwardRef, useRef } from 'react'
import { Download, Printer } from 'lucide-react'
import { KASTHURI_INVOICE_PRESET, type InvoiceSettings } from '@/lib/invoiceSettings'

export interface KasthuriInvoiceItem {
  description: string
  imei?: string
  warrantyCode?: string
  warrantyExpiry?: string
  qty: number
  unitPrice: number
  discountPct: number
  amount: number
}

export interface KasthuriInvoiceData {
  invoiceNumber: string
  date: string
  customerName: string
  customerPhone?: string
  customerVatRegNo?: string
  companyVatRegNo?: string
  items: KasthuriInvoiceItem[]
  totalValue: number
  discountTotal: number
  vat: number
  total: number
  advance: number
  balance: number
  currency?: string
}

export function buildKasthuriInvoiceData(
  sale: any,
  settings: InvoiceSettings,
  extras?: { subtotal?: number; discountAmount?: number },
): KasthuriInvoiceData {
  const warranties: Array<{ warrantyCode?: string; productName?: string; imei?: string; endDate?: string; monthsDuration?: number }> =
    sale.warranties ?? (sale.warrantyNumbers ?? []).map((code: string) => ({ warrantyCode: code, monthsDuration: sale.warrantyMonths }))

  const fmtExpiry = (endDate?: string, months?: number) => {
    if (endDate) return new Date(endDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    if (sale.createdAt && months) {
      const d = new Date(sale.createdAt)
      d.setMonth(d.getMonth() + months)
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }
    return undefined
  }

  const items: KasthuriInvoiceItem[] = (sale.items ?? []).map((i: any) => {
    const lineSub = (i.unitPrice ?? 0) * (i.quantity ?? 0)
    const lineDisc = i.discount ?? 0
    const discountPct = lineSub > 0 ? Math.round((lineDisc / lineSub) * 10000) / 100 : 0
    const matched = warranties.find(w => w.imei && i.imei && w.imei === i.imei)
      ?? warranties.find(w => w.productName && i.productName && w.productName === i.productName)
    return {
      description: i.productName ?? i.description ?? 'Item',
      imei: i.imei,
      warrantyCode: matched?.warrantyCode,
      warrantyExpiry: matched ? fmtExpiry(matched.endDate, matched.monthsDuration ?? i.warrantyMonths) : undefined,
      qty: i.quantity ?? 0,
      unitPrice: i.unitPrice ?? 0,
      discountPct,
      amount: i.total ?? lineSub - lineDisc,
    }
  })

  const totalValue = extras?.subtotal ?? sale.subtotal ?? items.reduce((s, i) => s + i.unitPrice * i.qty, 0)
  const discountTotal = extras?.discountAmount ?? sale.discount ?? 0
  const vat = sale.tax ?? 0
  const total = sale.total ?? totalValue - discountTotal + vat
  const advance = sale.paidAmount ?? (total - (sale.dueAmount ?? 0))
  const balance = total

  const date = sale.createdAt
    ? new Date(sale.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return {
    invoiceNumber: sale.invoiceNumber ?? `INV-${Date.now()}`,
    date,
    customerName: sale.customerName || 'Walk-in Customer',
    customerPhone: sale.customerPhone || '',
    customerVatRegNo: sale.customerVatRegNo || '',
    companyVatRegNo: settings.vatRegNo || '',
    items,
    totalValue,
    discountTotal,
    vat,
    total,
    advance,
    balance,
    currency: settings.currency || 'LKR',
  }
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

const MIN_ROWS = 6

const C = {
  text: '#111827',
  muted: '#4b5563',
  line: '#9ca3af',
  lineDark: '#374151',
}

const FONT = "'Segoe UI', Arial, Helvetica, sans-serif"

function MetaField({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: last ? 0 : 10 }}>
      <span style={{ fontSize: 15, color: C.text, fontWeight: 500, whiteSpace: 'nowrap', minWidth: 132 }}>{label}</span>
      <span style={{
        flex: 1,
        fontSize: 16,
        fontWeight: 700,
        color: C.text,
        borderBottom: `1.5px solid ${C.lineDark}`,
        paddingBottom: 2,
        minHeight: 20,
        lineHeight: 1.2,
      }}>
        {value || '\u00A0'}
      </span>
    </div>
  )
}

function TotalRow({ label, value, bold, highlight }: { label: string; value: string; bold?: boolean; highlight?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '6px 0', fontSize: highlight ? 17 : bold ? 15 : 14,
      fontWeight: bold || highlight ? 700 : 500, color: C.text,
      borderBottom: highlight ? `2px double ${C.lineDark}` : undefined,
    }}>
      <span>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 100, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

const KasthuriInvoicePrint = forwardRef<
  HTMLDivElement,
  { data: KasthuriInvoiceData; settings: InvoiceSettings; hideControls?: boolean }
>(function KasthuriInvoicePrint({ data, settings, hideControls = false }, outerRef) {
  const localRef = useRef<HTMLDivElement>(null)
  const invoiceRef = (outerRef as React.RefObject<HTMLDivElement>) ?? localRef

  const companyName = settings.companyLegalName || settings.shopName || 'KASTHURI MOBILE SOLUTIONS (PVT) LTD'
  const logo = settings.logo?.trim() || '/invoice-templates/kasthuri-logo.png'
  const website = settings.website || 'www.kasthurimobile.com'
  const qrSrc = settings.qrCodeUrl
    || `https://api.qrserver.com/v1/create-qr-code/?size=88x88&data=${encodeURIComponent(website.startsWith('http') ? website : `https://${website}`)}`

  const emptyRows = Math.max(0, MIN_ROWS - data.items.length)
  const terms = settings.terms?.length ? settings.terms : KASTHURI_INVOICE_PRESET.terms ?? []

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
    pdf.save(`invoice-${data.invoiceNumber}.pdf`)
  }

  const handlePrint = () => {
    if (!invoiceRef.current) return
    const w = window.open('', '_blank', 'width=820,height=1160')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><title>Invoice ${data.invoiceNumber}</title>
      <style>@page{size:A4;margin:12mm}body{margin:0;font-family:Arial,Helvetica,sans-serif}</style></head>
      <body>${invoiceRef.current.outerHTML}</body></html>`)
    w.document.close()
    w.focus()
    w.print()
    w.close()
  }

  const th: React.CSSProperties = {
    fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4,
    padding: '9px 6px', textAlign: 'left', color: C.text, borderBottom: `1.5px solid ${C.lineDark}`,
  }
  const td: React.CSSProperties = {
    fontSize: 14, padding: '9px 6px', verticalAlign: 'top', color: C.text,
    borderBottom: `1px solid ${C.line}`,
  }

  const invoiceBody = (
    <div
      ref={invoiceRef}
      style={{
        width: 794,
        minHeight: 1123,
        margin: hideControls ? 0 : '0 auto',
        background: '#fff',
        color: C.text,
        fontFamily: FONT,
        padding: '36px 48px 28px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 40, fontWeight: 800, letterSpacing: 1, color: C.text }}>INVOICE</h1>
        <img
          src={logo}
          alt={settings.shopName || 'Logo'}
          style={{ maxHeight: 64, maxWidth: 240, objectFit: 'contain' }}
          crossOrigin="anonymous"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      </div>

      {/* Customer / Invoice meta */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        marginBottom: 14,
        border: `1.5px solid ${C.lineDark}`,
      }}>
        <div style={{ padding: '10px 14px', borderRight: `1.5px solid ${C.lineDark}` }}>
          <MetaField label="Customer Name :" value={data.customerName} />
          <MetaField label="Mobile Number :" value={data.customerPhone || ''} />
          <MetaField label="Vat Reg. No. :" value={data.customerVatRegNo || ''} last />
        </div>
        <div style={{ padding: '10px 14px' }}>
          <MetaField label="Invoice No. :" value={data.invoiceNumber} />
          <MetaField label="Date :" value={data.date} />
          <MetaField label="Vat Reg. No. :" value={data.companyVatRegNo || ''} last />
        </div>
      </div>

      {/* Items table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 0, borderTop: `1.5px solid ${C.lineDark}` }}>
        <thead>
          <tr>
            <th style={{ ...th, width: 36, textAlign: 'center' }}>No.</th>
            <th style={th}>Description</th>
            <th style={{ ...th, width: 48, textAlign: 'center' }}>Qty.</th>
            <th style={{ ...th, width: 88, textAlign: 'right' }}>Unit Price</th>
            <th style={{ ...th, width: 56, textAlign: 'center' }}>Dis. %</th>
            <th style={{ ...th, width: 88, textAlign: 'right' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, idx) => (
            <tr key={idx}>
              <td style={{ ...td, textAlign: 'center', color: C.muted }}>{idx + 1}</td>
              <td style={td}>
                <div style={{ fontWeight: 600 }}>{item.description}</div>
                {(item.imei || item.warrantyCode || item.warrantyExpiry) && (
                  <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.5, color: C.muted }}>
                    {item.imei && <div>IMEI: {item.imei}</div>}
                    {item.warrantyCode && <div>Warranty: {item.warrantyCode}</div>}
                    {item.warrantyExpiry && <div>Valid until: {item.warrantyExpiry}</div>}
                  </div>
                )}
              </td>
              <td style={{ ...td, textAlign: 'center' }}>{item.qty}</td>
              <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(item.unitPrice)}</td>
              <td style={{ ...td, textAlign: 'center', color: C.muted }}>{item.discountPct > 0 ? item.discountPct.toFixed(2) : ''}</td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(item.amount)}</td>
            </tr>
          ))}
          {Array.from({ length: emptyRows }).map((_, i) => (
            <tr key={`e-${i}`}>
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

      {/* Totals + Terms */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 40, marginTop: 20, flex: 1 }}>
        <div style={{ flex: 1, maxWidth: 400, paddingTop: 8 }}>
          <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: C.text }}>Terms &amp; Conditions</p>
          <ul style={{ margin: 0, paddingLeft: 14, fontSize: 13, lineHeight: 1.65, color: C.muted }}>
            {terms.map((t, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{t}</li>
            ))}
          </ul>
        </div>
        <div style={{ width: 280, flexShrink: 0, borderTop: `1.5px solid ${C.lineDark}`, paddingTop: 8 }}>
          <TotalRow label="Total Value :" value={fmt(data.totalValue)} />
          <TotalRow label="Disc. Total :" value={fmt(data.discountTotal)} />
          <TotalRow label="VAT :" value={fmt(data.vat)} />
          <TotalRow label="Total :" value={fmt(data.total)} bold />
          <TotalRow label="Advance :" value={fmt(data.advance)} />
          <div style={{ borderTop: `1px solid ${C.lineDark}`, marginTop: 4, paddingTop: 4 }}>
            <TotalRow label="Balance :" value={fmt(data.total)} bold highlight />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: `1.5px solid ${C.lineDark}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
          <div style={{ flex: 1, fontSize: 14, lineHeight: 1.7, color: C.muted }}>
            <p style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 800, color: C.text }}>{companyName}</p>
            {settings.address && <p style={{ margin: '0 0 3px' }}>{settings.address}</p>}
            {settings.website && <p style={{ margin: '0 0 3px' }}>{settings.website}</p>}
            {settings.email && <p style={{ margin: 0 }}>{settings.email}</p>}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexShrink: 0 }}>
            {settings.phone && (
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.text, textAlign: 'right', lineHeight: 1.6 }}>
                {settings.phone}
              </p>
            )}
            <img
              src={qrSrc}
              alt="QR"
              width={72}
              height={72}
              style={{ display: 'block', border: `1px solid ${C.line}` }}
              crossOrigin="anonymous"
            />
          </div>
        </div>
        {settings.slogan && (
          <p style={{
            margin: '16px 0 0', paddingTop: 12, borderTop: `1px solid ${C.line}`,
            fontSize: 12, color: C.muted, textAlign: 'center', lineHeight: 1.55,
          }}>
            {settings.slogan}
          </p>
        )}
      </div>
    </div>
  )

  return (
    <>
      {!hideControls && (
        <div style={{ background: '#f3f4f6', minHeight: '100vh', padding: 24 }}>
          <div style={{ maxWidth: 794, margin: '0 auto 16px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
              <Printer size={14} /> Print
            </button>
            <button onClick={handleDownloadPDF} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, border: 'none', background: '#111', color: '#fff', cursor: 'pointer', fontSize: 13 }}>
              <Download size={14} /> Download PDF
            </button>
          </div>
          {invoiceBody}
        </div>
      )}
      {hideControls && invoiceBody}
    </>
  )
})

export default KasthuriInvoicePrint
