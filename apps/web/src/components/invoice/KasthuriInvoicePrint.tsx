'use client'

import { forwardRef, useRef } from 'react'
import { Download, Printer, MapPin, Globe, Mail, Phone } from 'lucide-react'
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
  const balance = sale.dueAmount ?? Math.max(0, total - advance)

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

const fmt = (n: number, currency = 'LKR') =>
  new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

const MIN_ROWS = 6

const BRAND = {
  dark: '#0f172a',
  text: '#1e293b',
  muted: '#64748b',
  border: '#cbd5e1',
  borderLight: '#e2e8f0',
  headerBg: '#0f172a',
  panelBg: '#f8fafc',
  accent: '#1d4ed8',
}

const FONT = {
  title: 40,
  subtitle: 12,
  sectionLabel: 11,
  body: 13,
  bodySm: 11.5,
  tableHead: 11,
  tableBody: 13,
  detail: 11.5,
  termsTitle: 12,
  termsBody: 11.5,
  totalRow: 13,
  totalHighlight: 15,
  footer: 12,
  footerTitle: 14,
  footerSm: 10,
  slogan: 10,
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: FONT.body, lineHeight: 1.45 }}>
      <span style={{ color: BRAND.muted, minWidth: 118, flexShrink: 0 }}>{label}</span>
      <span style={{ color: BRAND.text, fontWeight: 600, flex: 1 }}>{value || '—'}</span>
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
    || `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(website.startsWith('http') ? website : `https://${website}`)}`

  const emptyRows = Math.max(0, MIN_ROWS - data.items.length)

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

  const thStyle: React.CSSProperties = {
    fontSize: FONT.tableHead,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    padding: '11px 10px',
    textAlign: 'left',
    color: '#fff',
    background: BRAND.headerBg,
    borderBottom: `2px solid ${BRAND.accent}`,
  }
  const tdStyle: React.CSSProperties = { fontSize: FONT.tableBody, padding: '10px 10px', verticalAlign: 'top', color: BRAND.text, borderBottom: `1px solid ${BRAND.borderLight}` }
  const terms = settings.terms?.length ? settings.terms : KASTHURI_INVOICE_PRESET.terms ?? []

  const invoiceBody = (
    <div
      ref={invoiceRef}
      style={{
        width: 794,
        minHeight: 1123,
        margin: hideControls ? 0 : '0 auto',
        background: '#fff',
        color: BRAND.text,
        fontFamily: "'Segoe UI', system-ui, -apple-system, Arial, sans-serif",
        padding: '0 0 24px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top accent */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${BRAND.headerBg} 0%, ${BRAND.accent} 100%)` }} />

      <div style={{ padding: '32px 44px 0', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, paddingBottom: 20, borderBottom: `2px solid ${BRAND.borderLight}` }}>
          <div>
            <h1 style={{ margin: 0, fontSize: FONT.title, fontWeight: 800, letterSpacing: 2, color: BRAND.dark }}>INVOICE</h1>
            <p style={{ margin: '6px 0 0', fontSize: FONT.subtitle, color: BRAND.muted, letterSpacing: 1.2, textTransform: 'uppercase' }}>Tax Invoice / Sales Receipt</p>
          </div>
          <div style={{ textAlign: 'right', maxWidth: 300 }}>
            <img
              src={logo}
              alt={settings.shopName || 'Kasthuri Mobile Solutions'}
              style={{ maxHeight: 72, maxWidth: 260, objectFit: 'contain' }}
              crossOrigin="anonymous"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
        </div>

        {/* Customer / Invoice meta */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ background: BRAND.panelBg, border: `1px solid ${BRAND.borderLight}`, borderRadius: 8, padding: '14px 16px' }}>
            <p style={{ margin: '0 0 10px', fontSize: FONT.sectionLabel, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: BRAND.accent }}>Bill To</p>
            <MetaRow label="Customer" value={data.customerName} />
            <MetaRow label="Mobile" value={data.customerPhone || '—'} />
            <MetaRow label="Customer VAT" value={data.customerVatRegNo || '—'} />
          </div>
          <div style={{ background: BRAND.panelBg, border: `1px solid ${BRAND.borderLight}`, borderRadius: 8, padding: '14px 16px' }}>
            <p style={{ margin: '0 0 10px', fontSize: FONT.sectionLabel, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: BRAND.accent }}>Invoice Details</p>
            <MetaRow label="Invoice No." value={data.invoiceNumber} />
            <MetaRow label="Date" value={data.date} />
            <MetaRow label="Company VAT" value={data.companyVatRegNo || '—'} />
          </div>
        </div>

        {/* Items table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 0, border: `1px solid ${BRAND.borderLight}`, borderRadius: 8, overflow: 'hidden' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 40, textAlign: 'center' }}>No.</th>
              <th style={thStyle}>Description</th>
              <th style={{ ...thStyle, width: 52, textAlign: 'center' }}>Qty</th>
              <th style={{ ...thStyle, width: 96, textAlign: 'right' }}>Unit Price</th>
              <th style={{ ...thStyle, width: 60, textAlign: 'center' }}>Disc %</th>
              <th style={{ ...thStyle, width: 96, textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, idx) => (
              <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#fcfdff' }}>
                <td style={{ ...tdStyle, textAlign: 'center', color: BRAND.muted, fontWeight: 600 }}>{idx + 1}</td>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 600, color: BRAND.dark }}>{item.description}</div>
                  {(item.imei || item.warrantyCode || item.warrantyExpiry) && (
                    <div style={{ marginTop: 6, padding: '7px 10px', background: BRAND.panelBg, borderLeft: `3px solid ${BRAND.accent}`, borderRadius: '0 4px 4px 0', fontSize: FONT.detail, lineHeight: 1.55, color: BRAND.muted }}>
                      {item.imei && <div><span style={{ fontWeight: 700, color: BRAND.text }}>IMEI:</span> {item.imei}</div>}
                      {item.warrantyCode && <div><span style={{ fontWeight: 700, color: BRAND.text }}>Warranty:</span> {item.warrantyCode}</div>}
                      {item.warrantyExpiry && <div><span style={{ fontWeight: 700, color: BRAND.text }}>Valid until:</span> {item.warrantyExpiry}</div>}
                    </div>
                  )}
                </td>
                <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>{item.qty}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(item.unitPrice)}</td>
                <td style={{ ...tdStyle, textAlign: 'center', color: BRAND.muted }}>{item.discountPct > 0 ? item.discountPct.toFixed(2) : '—'}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(item.amount)}</td>
              </tr>
            ))}
            {Array.from({ length: emptyRows }).map((_, i) => (
              <tr key={`e-${i}`}>
                <td style={{ ...tdStyle, height: 28 }}>&nbsp;</td>
                <td style={tdStyle} />
                <td style={tdStyle} />
                <td style={tdStyle} />
                <td style={tdStyle} />
                <td style={tdStyle} />
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals + Terms row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 32, marginTop: 22, marginBottom: 24 }}>
          <div style={{ flex: 1, maxWidth: 380 }}>
            <p style={{ margin: '0 0 8px', fontSize: FONT.termsTitle, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: BRAND.dark }}>Terms &amp; Conditions</p>
            <ul style={{ margin: 0, paddingLeft: 14, fontSize: FONT.termsBody, lineHeight: 1.65, color: BRAND.muted }}>
              {terms.map((t, i) => (
                <li key={i} style={{ marginBottom: 5 }}>{t}</li>
              ))}
            </ul>
          </div>
          <div style={{ width: 280, border: `1px solid ${BRAND.borderLight}`, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
            {[
              ['Total Value', fmt(data.totalValue)],
              ['Discount', fmt(data.discountTotal)],
              ['VAT', fmt(data.vat)],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', fontSize: FONT.totalRow, borderBottom: `1px solid ${BRAND.borderLight}`, background: '#fff' }}>
                <span style={{ color: BRAND.muted }}>{label}</span>
                <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 14px', fontSize: FONT.totalHighlight, fontWeight: 800, background: BRAND.headerBg, color: '#fff' }}>
              <span>Total</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(data.total)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', fontSize: FONT.totalRow, borderBottom: `1px solid ${BRAND.borderLight}` }}>
              <span style={{ color: BRAND.muted }}>Advance Paid</span>
              <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(data.advance)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 14px', fontSize: FONT.totalHighlight, fontWeight: 800, background: data.balance > 0 ? '#fef3c7' : BRAND.panelBg, color: BRAND.dark }}>
              <span>Balance Due</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(data.balance)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer band */}
      <div style={{ marginTop: 'auto', borderTop: `2px solid ${BRAND.borderLight}`, background: BRAND.panelBg, padding: '18px 44px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
          <div style={{ flex: 1, fontSize: FONT.footer, lineHeight: 1.75 }}>
            <p style={{ margin: '0 0 8px', fontSize: FONT.footerTitle, fontWeight: 800, color: BRAND.dark, letterSpacing: 0.3 }}>{companyName}</p>
            {settings.address && (
              <p style={{ margin: '0 0 4px', display: 'flex', alignItems: 'flex-start', gap: 8, color: BRAND.muted }}>
                <MapPin size={14} style={{ flexShrink: 0, marginTop: 2, color: BRAND.accent }} />
                <span>{settings.address}</span>
              </p>
            )}
            {settings.website && (
              <p style={{ margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8, color: BRAND.muted }}>
                <Globe size={14} style={{ color: BRAND.accent }} />
                <span>{settings.website}</span>
              </p>
            )}
            {settings.email && (
              <p style={{ margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8, color: BRAND.muted }}>
                <Mail size={14} style={{ color: BRAND.accent }} />
                <span>{settings.email}</span>
              </p>
            )}
            {settings.phone && (
              <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: BRAND.muted }}>
                <Phone size={14} style={{ color: BRAND.accent }} />
                <span>{settings.phone}</span>
              </p>
            )}
          </div>
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <img src={qrSrc} alt="QR" width={80} height={80} style={{ display: 'block', border: `1px solid ${BRAND.borderLight}`, borderRadius: 6, background: '#fff', padding: 4 }} crossOrigin="anonymous" />
            <p style={{ margin: '6px 0 0', fontSize: FONT.footerSm, color: BRAND.muted }}>Scan to visit</p>
          </div>
        </div>
        {settings.slogan && (
          <p style={{ margin: '14px 0 0', paddingTop: 12, borderTop: `1px solid ${BRAND.borderLight}`, fontSize: FONT.slogan, color: BRAND.muted, textAlign: 'center', lineHeight: 1.55, fontStyle: 'italic' }}>
            {settings.slogan}
          </p>
        )}
      </div>
    </div>
  )

  return (
    <>
      {!hideControls && (
        <div style={{ background: '#f1f5f9', minHeight: '100vh', padding: 24 }}>
          <div style={{ maxWidth: 794, margin: '0 auto 16px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
              <Printer size={14} /> Print
            </button>
            <button onClick={handleDownloadPDF} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: 'none', background: '#111', color: '#fff', cursor: 'pointer', fontSize: 13 }}>
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
