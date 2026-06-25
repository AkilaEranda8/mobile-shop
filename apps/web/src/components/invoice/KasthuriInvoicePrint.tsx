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

export function buildKasthuriRepairInvoiceData(
  repair: {
    ticketNumber: string
    createdAt: string
    customerName: string
    customerPhone?: string
    deviceBrand: string
    deviceModel: string
    reportedIssue?: string
    estimatedCost?: number | string | null
    actualCost?: number | string | null
    status?: string
  },
  settings: InvoiceSettings,
): KasthuriInvoiceData {
  const serviceFee = Number(repair.estimatedCost ?? 0) || 0
  const subtotal = serviceFee
  const discount = repair.actualCost != null && Number(repair.actualCost) < subtotal
    ? subtotal - Number(repair.actualCost)
    : 0
  const total = Math.max(0, subtotal - discount)
  const isPaid = repair.status === 'DELIVERED'

  return buildKasthuriInvoiceData({
    invoiceNumber: repair.ticketNumber,
    createdAt: repair.createdAt,
    customerName: repair.customerName,
    customerPhone: repair.customerPhone,
    items: serviceFee > 0 ? [{
      productName: `Repair Service – ${repair.deviceBrand} ${repair.deviceModel}`,
      description: repair.reportedIssue,
      quantity: 1,
      unitPrice: serviceFee,
      discount,
      total,
    }] : [],
    subtotal,
    discount,
    tax: 0,
    total,
    paidAmount: isPaid ? total : 0,
    dueAmount: isPaid ? 0 : total,
  }, settings, { subtotal, discountAmount: discount })
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

const MIN_ROWS = 8

const C = {
  text: '#000000',
  muted: '#333333',
  line: '#000000',
  lineDark: '#000000',
}

const FONT = "'Segoe UI', Arial, Helvetica, sans-serif"

function WhatsAppIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.529 5.86L0 24l6.335-1.662A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.82a9.78 9.78 0 0 1-4.99-1.365l-.358-.213-3.76.987 1.004-3.66-.233-.375A9.82 9.82 0 0 1 2.18 12c0-5.422 4.398-9.82 9.82-9.82 5.422 0 9.82 4.398 9.82 9.82 0 5.422-4.398 9.82-9.82 9.82z" />
    </svg>
  )
}

function ContactLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <p style={{ display: 'flex', alignItems: 'flex-start', gap: 8, margin: '0 0 5px', fontSize: 12, color: C.muted, lineHeight: 1.45 }}>
      <span style={{ flexShrink: 0, marginTop: 1, color: C.text }}>{icon}</span>
      <span>{text}</span>
    </p>
  )
}

function HeaderField({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: last ? 0 : 11, fontSize: 15, color: C.text, lineHeight: 1.35 }}>
      <span style={{ whiteSpace: 'nowrap', fontWeight: 400 }}>{label}</span>
      <span style={{ marginLeft: 6, fontWeight: 600, flex: 1 }}>{value || ''}</span>
    </div>
  )
}

function TotalRow({ label, value, bold, highlight }: { label: string; value: string; bold?: boolean; highlight?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '4px 0', fontSize: highlight ? 16 : bold ? 15 : 14,
      fontWeight: bold || highlight ? 700 : 400, color: C.text,
    }}>
      <span>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 110, textAlign: 'right' }}>{value}</span>
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
    fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3,
    padding: '10px 6px', textAlign: 'left', color: C.text, border: 'none',
  }
  const td: React.CSSProperties = {
    fontSize: 14, padding: '8px 6px', verticalAlign: 'top', color: C.text, border: 'none',
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
      <div style={{ marginBottom: 0, paddingBottom: 12, borderBottom: `1.5px solid ${C.lineDark}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h1 style={{ margin: 0, fontSize: 38, fontWeight: 800, letterSpacing: 0.5, color: C.text }}>INVOICE</h1>
          <img
            src={logo}
            alt={settings.shopName || 'Logo'}
            style={{ maxHeight: 72, maxWidth: 260, objectFit: 'contain' }}
            crossOrigin="anonymous"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 64 }}>
          <div>
            <HeaderField label="Customer Name :" value={data.customerName} />
            <HeaderField label="Mobile Number :" value={data.customerPhone || ''} />
            <HeaderField label="Vat Reg. No. :" value={data.customerVatRegNo || ''} last />
          </div>
          <div>
            <HeaderField label="Invoice No. :" value={data.invoiceNumber} />
            <HeaderField label="Date :" value={data.date} />
            <HeaderField label="Vat Reg. No. :" value={data.companyVatRegNo || ''} last />
          </div>
        </div>
      </div>

      {/* Items table */}
      <table style={{
        width: '100%', borderCollapse: 'collapse', marginTop: 14,
        borderTop: `1.5px solid ${C.lineDark}`, borderBottom: `1.5px solid ${C.lineDark}`,
      }}>
        <thead>
          <tr style={{ borderBottom: `1.5px solid ${C.lineDark}` }}>
            <th style={{ ...th, width: 40, textAlign: 'center' }}>No.</th>
            <th style={th}>Description</th>
            <th style={{ ...th, width: 52, textAlign: 'center' }}>Qty.</th>
            <th style={{ ...th, width: 92, textAlign: 'right' }}>Unit Price</th>
            <th style={{ ...th, width: 58, textAlign: 'center' }}>Dis. %</th>
            <th style={{ ...th, width: 92, textAlign: 'right' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, idx) => (
            <tr key={idx}>
              <td style={{ ...td, textAlign: 'center' }}>{idx + 1}</td>
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
              <td style={{ ...td, textAlign: 'center' }}>{item.discountPct > 0 ? item.discountPct.toFixed(2) : ''}</td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(item.amount)}</td>
            </tr>
          ))}
          {Array.from({ length: emptyRows }).map((_, i) => (
            <tr key={`e-${i}`}>
              <td style={{ ...td, height: 28 }}>&nbsp;</td>
              <td style={td} />
              <td style={td} />
              <td style={td} />
              <td style={td} />
              <td style={td} />
            </tr>
          ))}
        </tbody>
      </table>

      {/* Terms + Totals */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 18, flex: 1 }}>
        <div style={{ paddingTop: 6 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text }}>Terms &amp; Conditions</p>
        </div>
        <div style={{ width: 300, flexShrink: 0 }}>
          <TotalRow label="Total Value :" value={fmt(data.totalValue)} />
          <TotalRow label="Disc. Total :" value={fmt(data.discountTotal)} />
          <TotalRow label="VAT :" value={fmt(data.vat)} />
          <TotalRow label="Total :" value={fmt(data.total)} bold />
          <TotalRow label="Advance :" value={fmt(data.advance)} />
          <div style={{ borderTop: `1px solid ${C.lineDark}`, marginTop: 4, paddingTop: 4, borderBottom: `3px double ${C.lineDark}`, paddingBottom: 4 }}>
            <TotalRow label="Balance :" value={fmt(data.total)} bold highlight />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 'auto', paddingTop: 28 }}>
        <p style={{ margin: '0 0 12px', fontSize: 11, lineHeight: 1.55, color: C.muted }}>
          {terms.map((t, i) => (
            <span key={i}>
              {i > 0 ? '  ' : ''}* {t}
            </span>
          ))}
        </p>
        <div style={{ borderTop: `1.5px solid ${C.lineDark}`, paddingTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                margin: '0 0 10px',
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                color: C.text,
                lineHeight: 1.25,
              }}>
                {companyName}
              </p>
              {settings.address && <ContactLine icon={<MapPin size={13} />} text={settings.address} />}
              {settings.website && <ContactLine icon={<Globe size={13} />} text={settings.website} />}
              {settings.email && <ContactLine icon={<Mail size={13} />} text={settings.email} />}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
              <img
                src={qrSrc}
                alt="QR"
                width={76}
                height={76}
                style={{ display: 'block' }}
                crossOrigin="anonymous"
              />
              {settings.phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, fontWeight: 600, color: C.text }}>
                  <Phone size={13} />
                  <WhatsAppIcon size={13} />
                  <span>{settings.phone}</span>
                </div>
              )}
            </div>
          </div>
          {settings.slogan && (
            <p style={{ margin: '12px 0 0', fontSize: 10, color: C.muted, lineHeight: 1.55 }}>
              {settings.slogan}
            </p>
          )}
        </div>
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
