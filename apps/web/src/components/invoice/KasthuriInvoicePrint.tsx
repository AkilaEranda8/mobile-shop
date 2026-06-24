'use client'

import { forwardRef, useRef } from 'react'
import { Download, Printer, MapPin, Globe, Mail, Phone } from 'lucide-react'
import type { InvoiceSettings } from '@/lib/invoiceSettings'

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

const MIN_ROWS = 8

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

  const labelStyle: React.CSSProperties = { fontSize: 11, color: '#111', margin: '0 0 6px' }
  const thStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, padding: '8px 6px', textAlign: 'left', borderBottom: '1px solid #111' }
  const tdStyle: React.CSSProperties = { fontSize: 11, padding: '7px 6px', verticalAlign: 'top' }

  const invoiceBody = (
    <div ref={invoiceRef} style={{ width: 794, minHeight: 1123, margin: hideControls ? 0 : '0 auto', background: '#fff', color: '#111', fontFamily: 'Arial, Helvetica, sans-serif', padding: '36px 40px 28px', boxSizing: 'border-box' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 42, fontWeight: 700, letterSpacing: 1 }}>INVOICE</h1>
          <div style={{ textAlign: 'right', maxWidth: 300 }}>
            <img src={logo} alt={settings.shopName || 'Kasthuri Mobile Solutions'} style={{ maxHeight: 80, maxWidth: 280, objectFit: 'contain' }} crossOrigin="anonymous" />
          </div>
        </div>

        {/* Customer / Invoice meta */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 22, gap: 24 }}>
          <div style={{ flex: 1 }}>
            <p style={labelStyle}><strong>Customer Name :</strong> {data.customerName}</p>
            <p style={labelStyle}><strong>Mobile Number :</strong> {data.customerPhone || '—'}</p>
            <p style={labelStyle}><strong>Vat Reg. No. :</strong> {data.customerVatRegNo || '—'}</p>
          </div>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <p style={labelStyle}><strong>Invoice No. :</strong> {data.invoiceNumber}</p>
            <p style={labelStyle}><strong>Date :</strong> {data.date}</p>
            <p style={labelStyle}><strong>Vat Reg. No. :</strong> {data.companyVatRegNo || '—'}</p>
          </div>
        </div>

        {/* Items table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 36 }}>NO.</th>
              <th style={thStyle}>DESCRIPTION</th>
              <th style={{ ...thStyle, width: 48, textAlign: 'right' }}>QTY.</th>
              <th style={{ ...thStyle, width: 88, textAlign: 'right' }}>UNIT PRICE</th>
              <th style={{ ...thStyle, width: 56, textAlign: 'right' }}>DIS. %</th>
              <th style={{ ...thStyle, width: 88, textAlign: 'right' }}>AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, idx) => (
              <tr key={idx}>
                <td style={tdStyle}>{idx + 1}</td>
                <td style={tdStyle}>
                  <div>{item.description}</div>
                  {item.imei && <div style={{ fontSize: 9, color: '#444', marginTop: 2 }}>IMEI: {item.imei}</div>}
                  {item.warrantyCode && <div style={{ fontSize: 9, color: '#444' }}>Warranty: {item.warrantyCode}</div>}
                  {item.warrantyExpiry && <div style={{ fontSize: 9, color: '#444' }}>Expires: {item.warrantyExpiry}</div>}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{item.qty}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(item.unitPrice)}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{item.discountPct > 0 ? item.discountPct.toFixed(2) : '—'}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(item.amount)}</td>
              </tr>
            ))}
            {Array.from({ length: emptyRows }).map((_, i) => (
              <tr key={`e-${i}`}>
                <td style={tdStyle}>&nbsp;</td>
                <td style={tdStyle} />
                <td style={tdStyle} />
                <td style={tdStyle} />
                <td style={tdStyle} />
                <td style={tdStyle} />
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ borderBottom: '1px solid #111', marginBottom: 16 }} />

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 28 }}>
          <div style={{ width: 240, fontSize: 11 }}>
            {[
              ['Total Value :', fmt(data.totalValue)],
              ['Disc. Total :', fmt(data.discountTotal)],
              ['VAT :', fmt(data.vat)],
              ['Total :', fmt(data.total)],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span>{label}</span><span>{value}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid #111', margin: '8px 0 6px', paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
              <span>Advance :</span><span>{fmt(data.advance)}</span>
            </div>
            <div style={{ borderBottom: '3px double #111', paddingBottom: 4, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>Balance :</span><span>{fmt(data.balance)}</span>
            </div>
          </div>
        </div>

        {/* Terms */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700 }}>Terms &amp; Conditions</p>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 10, lineHeight: 1.6 }}>
            {(settings.terms?.length ? settings.terms : [
              'Checking warranty does not apply if the warranty sticker is broken or removed.',
              'Goods / Parts / Accessories once sold will not be taken back.',
            ]).map((t, i) => (
              <li key={i} style={{ marginBottom: 4 }}>* {t}</li>
            ))}
          </ul>
        </div>

        <div style={{ borderTop: '1px solid #111', marginBottom: 14 }} />

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1, fontSize: 10, lineHeight: 1.7 }}>
            <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700 }}>{companyName}</p>
            {settings.address && (
              <p style={{ margin: '0 0 4px', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <MapPin size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{settings.address}</span>
              </p>
            )}
            {settings.website && (
              <p style={{ margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Globe size={12} />
                <span>{settings.website}</span>
              </p>
            )}
            {settings.email && (
              <p style={{ margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Mail size={12} />
                <span>{settings.email}</span>
              </p>
            )}
            {settings.phone && (
              <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Phone size={12} />
                <span>{settings.phone}</span>
              </p>
            )}
          </div>
          <img src={qrSrc} alt="QR" width={88} height={88} style={{ flexShrink: 0 }} crossOrigin="anonymous" />
        </div>

        {settings.slogan && (
          <p style={{ margin: '18px 0 0', fontSize: 8.5, color: '#444', textAlign: 'center', lineHeight: 1.5 }}>
            {settings.slogan}
          </p>
        )}
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
