'use client'

import React, { forwardRef } from 'react'
import type { InvoiceSettings, ShopContext } from '@/lib/invoiceSettings'
import { mergeReceiptSettings, HEXALYTE_SOFTWARE_FOOTER, thermalLogoMaxHeight, thermalBodyFontWeight } from '@/lib/invoiceSettings'
import { formatWarrantyPeriodLabel, matchWarrantyMonths } from '@/components/pos/cart-rules'
import { productConditionLabel } from '@/lib/productCondition'

export interface ThermalWarrantyLine {
  warrantyCode: string
  productName?: string
  imei?: string
  endDate?: string
  monthsDuration?: number
}

export interface ThermalSale {
  invoiceNumber: string
  createdAt?: string
  customerName?: string
  customerPhone?: string
  items: {
    productName: string
    quantity: number
    unitPrice: number
    total: number
    sku?: string
    imei?: string
    storage?: string
    color?: string
    itemNotes?: string
    warrantyMonths?: number
    warrantyEndDate?: string
    condition?: 'BRAND_NEW' | 'USED'
  }[]
  subtotal: number
  discountAmount: number
  total: number
  paymentMethod?: string
  cashReceived?: number
  changeAmount?: number
  warrantyNumbers?: string[]
  warrantyMonths?: number
  warranties?: ThermalWarrantyLine[]
}

interface ThermalReceiptProps {
  sale: ThermalSale
  settings: InvoiceSettings
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, currency = 'LKR') {
  return currency + ' ' + new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2 }).format(n)
}

function fmtAmt(n: number) {
  return new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2 }).format(n)
}

function row(left: string, right: string) {
  return { left, right }
}

function thermalBodyWidth(paper: '58mm' | '80mm' | 'stockForm') {
  return paper === '80mm' ? '288px' : '200px'
}

function thermalFontScale(size: InvoiceSettings['thermalFontSize']) {
  if (size === 'sm') return { base: 11, title: 14, total: 14, small: 10 }
  if (size === 'lg') return { base: 15, title: 18, total: 18, small: 12 }
  return { base: 13, title: 16, total: 16, small: 11 }
}

function fmtWarrantyDate(iso?: string, fallbackCreatedAt?: string, months?: number): string {
  if (iso) {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  if (fallbackCreatedAt && months && months > 0) {
    const d = new Date(fallbackCreatedAt)
    d.setMonth(d.getMonth() + months)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  return '—'
}

function resolveWarrantyLines(sale: ThermalSale): ThermalWarrantyLine[] {
  if (sale.warranties?.length) return sale.warranties
  return (sale.warrantyNumbers ?? []).map(code => ({
    warrantyCode: code,
    monthsDuration: sale.warrantyMonths,
  }))
}

export const SAMPLE_THERMAL_SALE: ThermalSale = {
  invoiceNumber: 'INV-2026-0042',
  createdAt: new Date().toISOString(),
  customerName: 'Kamal Perera',
  customerPhone: '077 123 4567',
  items: [
    { productName: 'Samsung Galaxy A15', quantity: 1, unitPrice: 45990, total: 45990, sku: 'SAM-A15-BLK', imei: '356789012345678' },
    { productName: 'Screen Guard', quantity: 2, unitPrice: 500, total: 1000, sku: 'ACC-SG-01' },
  ],
  subtotal: 46990,
  discountAmount: 1990,
  total: 45000,
  paymentMethod: 'cash',
  cashReceived: 50000,
  changeAmount: 5000,
  warrantyNumbers: ['WR-2026-001'],
  warrantyMonths: 12,
  warranties: [{
    warrantyCode: 'WR-2026-001',
    productName: 'Samsung Galaxy A15',
    imei: '356789012345678',
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 12)).toISOString(),
    monthsDuration: 12,
  }],
}

// ── Component ─────────────────────────────────────────────────────────────────

const ThermalReceipt = forwardRef<HTMLDivElement, ThermalReceiptProps>(
  function ThermalReceipt({ sale, settings }, ref) {
    const currency = settings.currency || 'LKR'
    const f = (n: number) => fmt(n, currency)
    const paper = (settings.thermalWidthPOS === 'stockForm' ? '58mm' : (settings.thermalWidthPOS || '58mm')) as '58mm' | '80mm'
    const fs = thermalFontScale(settings.thermalFontSize || 'md')
    const logoHeight = thermalLogoMaxHeight(settings.thermalLogoSize)
    const bodyWeight = thermalBodyFontWeight(settings.thermalFontBold)
    const metaColor = settings.thermalFontBold !== false ? '#000' : '#333'
    const show = {
      logo: settings.thermalShowLogo !== false,
      slogan: settings.thermalShowSlogan !== false,
      address: settings.thermalShowAddress !== false,
      phone: settings.thermalShowPhone !== false,
      email: settings.thermalShowEmail !== false,
      customer: settings.thermalShowCustomer !== false,
      sku: settings.thermalShowSku !== false,
      imei: settings.thermalShowImei !== false,
      payment: settings.thermalShowPayment !== false,
      bank: settings.thermalShowBank !== false,
      website: settings.thermalShowWebsite !== false,
      warranty: settings.thermalShowWarranty !== false,
    }

    const date = sale.createdAt ? new Date(sale.createdAt) : new Date()
    const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    const timeStr = date.toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' })

    const rowStyle: React.CSSProperties = {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 6,
    }

    return (
      <div
        ref={ref}
        style={{
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: `${fs.base}px`,
          fontWeight: bodyWeight,
          lineHeight: '1.45',
          width: thermalBodyWidth(paper),
          maxWidth: '100%',
          padding: '6px 2px',
          background: '#fff',
          color: '#000',
          overflow: 'hidden',
          wordBreak: 'break-word',
        }}
      >
        {show.logo && settings.logo && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={settings.logo} alt="logo" style={{ display: 'block', maxHeight: logoHeight, maxWidth: '90%', objectFit: 'contain' }} />
          </div>
        )}
        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: fs.title }}>
          {settings.shopName || 'My Shop'}
        </div>
        {show.slogan && settings.slogan && (
          <div style={{ textAlign: 'center', fontSize: fs.small, fontWeight: bodyWeight }}>{settings.slogan}</div>
        )}
        {show.address && settings.address && (
          <div style={{ textAlign: 'center', fontSize: fs.small, fontWeight: bodyWeight, wordBreak: 'break-word' }}>{settings.address}</div>
        )}
        {show.phone && settings.phone && (
          <div style={{ textAlign: 'center', fontSize: fs.small, fontWeight: bodyWeight }}>Tel: {settings.phone}</div>
        )}
        {show.email && settings.email && (
          <div style={{ textAlign: 'center', fontSize: fs.small, fontWeight: bodyWeight, wordBreak: 'break-all' }}>{settings.email}</div>
        )}

        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

        {[
          row('Receipt:', sale.invoiceNumber),
          row('Date:', dateStr),
          row('Time:', timeStr),
          ...(show.customer && sale.customerName && sale.customerName !== 'Walk-in Customer' ? [row('Customer:', sale.customerName)] : []),
          ...(show.customer && sale.customerPhone ? [row('Phone:', sale.customerPhone)] : []),
        ].map(({ left, right }, i) => (
          <div key={i} style={rowStyle}>
            <span style={{ flexShrink: 0 }}>{left}</span>
            <span style={{ textAlign: 'right', wordBreak: 'break-all' }}>{right}</span>
          </div>
        ))}

        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

        {sale.items.map((item, i) => (
          <div key={i} style={{ marginBottom: 6 }}>
            <div style={{ fontWeight: 'bold' }}>{item.productName}</div>
            {show.sku && item.sku && <div style={{ fontSize: fs.small, color: metaColor, fontWeight: bodyWeight }}>SKU: {item.sku}</div>}
            {!item.productName.includes(' · ') && (item.storage || item.color) && (
              <div style={{ fontSize: fs.small, color: metaColor, fontWeight: bodyWeight }}>
                {[item.storage, item.color].filter(Boolean).join(' · ')}
              </div>
            )}
            {item.condition && (
              <div style={{ fontSize: fs.small, color: metaColor, fontWeight: bodyWeight }}>Condition: {productConditionLabel(item.condition)}</div>
            )}
            {item.itemNotes && <div style={{ fontSize: fs.small, color: metaColor, fontWeight: bodyWeight }}>{item.itemNotes}</div>}
            {show.imei && item.imei && <div style={{ fontSize: fs.small, color: metaColor, fontWeight: bodyWeight }}>IMEI: {item.imei}</div>}
            {(item.warrantyMonths ?? 0) > 0 && (
              <>
                <div style={{ fontSize: fs.small, color: metaColor, fontWeight: bodyWeight }}>
                  Warranty: {formatWarrantyPeriodLabel(item.warrantyMonths!)}
                </div>
                <div style={{ fontSize: fs.small, color: metaColor, fontWeight: bodyWeight }}>
                  Valid until: {fmtWarrantyDate(item.warrantyEndDate, sale.createdAt, item.warrantyMonths)}
                </div>
              </>
            )}
            <div style={{ ...rowStyle, marginTop: 2 }}>
              <span style={{ fontSize: fs.small }}>{item.quantity} x {f(item.unitPrice)}</span>
              <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>{f(item.total)}</span>
            </div>
          </div>
        ))}

        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

        <div style={rowStyle}><span>Subtotal:</span><span style={{ whiteSpace: 'nowrap' }}>{f(sale.subtotal)}</span></div>
        {sale.discountAmount > 0 && (
          <div style={rowStyle}><span>Discount:</span><span style={{ whiteSpace: 'nowrap' }}>-{f(sale.discountAmount)}</span></div>
        )}
        <div style={{ borderTop: '1px solid #000', margin: '4px 0' }} />
        <div style={{ ...rowStyle, fontWeight: 'bold', fontSize: fs.total }}>
          <span>TOTAL:</span>
          <span style={{ whiteSpace: 'nowrap' }}>{f(sale.total)}</span>
        </div>
        <div style={{ borderTop: '1px solid #000', margin: '4px 0' }} />

        {show.payment && sale.paymentMethod && (
          <div style={rowStyle}><span>Payment:</span><span>{sale.paymentMethod.toUpperCase()}</span></div>
        )}
        {show.payment && sale.cashReceived != null && sale.cashReceived > 0 && (
          <div style={rowStyle}><span>Cash:</span><span style={{ whiteSpace: 'nowrap' }}>{f(sale.cashReceived)}</span></div>
        )}
        {show.payment && sale.changeAmount != null && sale.changeAmount > 0 && (
          <div style={{ ...rowStyle, fontWeight: 'bold' }}><span>Change:</span><span style={{ whiteSpace: 'nowrap' }}>{f(sale.changeAmount)}</span></div>
        )}

        {show.warranty && resolveWarrantyLines(sale).length > 0 && (
          <>
            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
            <div style={{ textAlign: 'center', fontWeight: 'bold' }}>WARRANTY</div>
            {resolveWarrantyLines(sale).map((w, i) => {
              const months = matchWarrantyMonths(w, sale.items, sale.warrantyMonths)
              return (
              <div key={i} style={{ marginBottom: 6, fontSize: fs.small }}>
                {w.productName && <div style={{ fontWeight: 'bold' }}>{w.productName}</div>}
                {w.imei && <div>IMEI: {w.imei}</div>}
                <div style={rowStyle}>
                  <span>Code:</span>
                  <span style={{ fontWeight: 'bold', wordBreak: 'break-all' }}>{w.warrantyCode}</span>
                </div>
                {months > 0 && (
                  <div style={rowStyle}>
                    <span>Warranty Period:</span>
                    <span>{formatWarrantyPeriodLabel(months)}</span>
                  </div>
                )}
                <div style={rowStyle}>
                  <span>Valid Until:</span>
                  <span>{fmtWarrantyDate(w.endDate, sale.createdAt, months)}</span>
                </div>
              </div>
            )})}
          </>
        )}

        {show.bank && (settings.bankName || settings.accNumber) && (
          <>
            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
            {settings.bankName && <div style={{ fontSize: fs.small, wordBreak: 'break-word' }}>Bank: {settings.bankName}</div>}
            {settings.accNumber && <div style={{ fontSize: fs.small, wordBreak: 'break-all' }}>Acc: {settings.accNumber}</div>}
          </>
        )}

        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

        <div style={{ textAlign: 'center', fontSize: fs.base }}>
          {settings.footerNote || 'Thank you for your business!'}
        </div>
        {show.website && settings.website && (
          <div style={{ textAlign: 'center', fontSize: fs.small, wordBreak: 'break-all' }}>{settings.website}</div>
        )}
        <div style={{ textAlign: 'center', fontSize: fs.small, color: '#666', marginTop: 4 }}>{HEXALYTE_SOFTWARE_FOOTER}</div>
      </div>
    )
  }
)

ThermalReceipt.displayName = 'ThermalReceipt'

export default ThermalReceipt

// ── Standalone print helper ────────────────────────────────────────────────────

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function printThermalReceipt(sale: ThermalSale, settings: InvoiceSettings, ctx?: ShopContext) {
  settings = mergeReceiptSettings(settings, ctx)
  const currency = settings.currency || 'LKR'
  const f = (n: number) => esc(currency + ' ' + fmtAmt(n))
  const fs = thermalFontScale(settings.thermalFontSize || 'md')
  const logoHeight = thermalLogoMaxHeight(settings.thermalLogoSize)
  const bodyWeight = thermalBodyFontWeight(settings.thermalFontBold)
  const metaColor = settings.thermalFontBold !== false ? '#000' : '#333'
  const show = {
    logo: settings.thermalShowLogo !== false,
    slogan: settings.thermalShowSlogan !== false,
    address: settings.thermalShowAddress !== false,
    phone: settings.thermalShowPhone !== false,
    email: settings.thermalShowEmail !== false,
    customer: settings.thermalShowCustomer !== false,
    sku: settings.thermalShowSku !== false,
    imei: settings.thermalShowImei !== false,
    payment: settings.thermalShowPayment !== false,
    bank: settings.thermalShowBank !== false,
    website: settings.thermalShowWebsite !== false,
    warranty: settings.thermalShowWarranty !== false,
  }

  const date = sale.createdAt ? new Date(sale.createdAt) : new Date()
  const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' })

  const paperWidth = (settings.thermalWidthPOS === 'stockForm' ? '58mm' : (settings.thermalWidthPOS || '58mm')) as '58mm' | '80mm'
  const bodyWidth = thermalBodyWidth(paperWidth)

  const itemBlocks = sale.items.map(item => `
    <div class="item">
      <div class="item-name">${esc(item.productName)}</div>
      ${show.sku && item.sku ? `<div class="item-meta">SKU: ${esc(item.sku)}</div>` : ''}
      ${!item.productName.includes(' · ') && (item.storage || item.color) ? `<div class="item-meta">${esc([item.storage, item.color].filter(Boolean).join(' · '))}</div>` : ''}
      ${item.condition ? `<div class="item-meta">Condition: ${esc(productConditionLabel(item.condition))}</div>` : ''}
      ${item.itemNotes ? `<div class="item-meta">${esc(item.itemNotes)}</div>` : ''}
      ${show.imei && item.imei ? `<div class="item-meta">IMEI: ${esc(item.imei)}</div>` : ''}
      ${(item.warrantyMonths ?? 0) > 0 ? `<div class="item-meta">Warranty: ${esc(formatWarrantyPeriodLabel(item.warrantyMonths!))}</div>` : ''}
      ${(item.warrantyMonths ?? 0) > 0 ? `<div class="item-meta">Valid until: ${esc(fmtWarrantyDate(item.warrantyEndDate, sale.createdAt, item.warrantyMonths))}</div>` : ''}
      <div class="row item-line">
        <span class="item-meta">${item.quantity} x ${f(item.unitPrice)}</span>
        <span class="bold nowrap">${f(item.total)}</span>
      </div>
    </div>
  `).join('')

  const warrantyLines = resolveWarrantyLines(sale)
  const warrantyBlock = show.warranty && warrantyLines.length > 0 ? `
  <div class="dash"></div>
  <div class="center bold">WARRANTY</div>
  ${warrantyLines.map(w => {
    const months = matchWarrantyMonths(w, sale.items, sale.warrantyMonths)
    return `
    <div class="item">
      ${w.productName ? `<div class="item-name">${esc(w.productName)}</div>` : ''}
      ${w.imei ? `<div class="item-meta">IMEI: ${esc(w.imei)}</div>` : ''}
      <div class="row"><span>Code:</span><span class="bold wrap">${esc(w.warrantyCode)}</span></div>
      ${months > 0 ? `<div class="row"><span>Warranty Period:</span><span class="nowrap">${esc(formatWarrantyPeriodLabel(months))}</span></div>` : ''}
      <div class="row"><span>Valid Until:</span><span class="nowrap">${esc(fmtWarrantyDate(w.endDate, sale.createdAt, months))}</span></div>
    </div>`
  }).join('')}
  ` : ''

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Receipt ${esc(sale.invoiceNumber)}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body {
      width: 100%;
      overflow-x: hidden;
    }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: ${fs.base}px;
      font-weight: ${bodyWeight};
      line-height: 1.45;
      max-width: ${bodyWidth};
      margin: 0 auto;
      padding: 6px 2px;
      background: #fff;
      color: #000;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    .center { text-align: center; }
    .bold   { font-weight: bold; }
    .small  { font-size: ${fs.small}px; font-weight: ${bodyWeight}; }
    .large  { font-size: ${fs.title}px; }
    .total  { font-size: ${fs.total}px; }
    .wrap   { word-break: break-word; overflow-wrap: anywhere; }
    .email  { word-break: break-all; overflow-wrap: anywhere; }
    .nowrap { white-space: nowrap; }
    .dash   { border-top: 1px dashed #000; margin: 5px 0; }
    .solid  { border-top: 1px solid #000;  margin: 4px 0; }
    .row    { display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; }
    .row > span:first-child { flex-shrink: 0; }
    .row > span:last-child  { text-align: right; min-width: 0; word-break: break-all; }
    .item   { margin-bottom: 6px; }
    .item-name { font-weight: bold; }
    .item-meta { font-size: ${fs.small}px; color: ${metaColor}; font-weight: ${bodyWeight}; }
    .item-line { margin-top: 2px; }
    @media print {
      @page { margin: 2mm; size: ${paperWidth} auto; }
      html, body { width: 100%; max-width: 100%; padding: 0 1mm; }
    }
  </style>
</head>
<body>
  ${show.logo && settings.logo ? `<div style="margin-bottom:6px;display:flex;justify-content:center"><img src="${esc(settings.logo)}" style="display:block;max-height:${logoHeight}px;max-width:90%;object-fit:contain"/></div>` : ''}
  <div class="center bold large wrap">${esc(settings.shopName || 'My Shop')}</div>
  ${show.slogan && settings.slogan ? `<div class="center small wrap">${esc(settings.slogan)}</div>` : ''}
  ${show.address && settings.address ? `<div class="center small wrap">${esc(settings.address)}</div>` : ''}
  ${show.phone && settings.phone   ? `<div class="center small">Tel: ${esc(settings.phone)}</div>` : ''}
  ${show.email && settings.email   ? `<div class="center small email">${esc(settings.email)}</div>` : ''}

  <div class="dash"></div>

  <div class="row"><span>Receipt:</span><span>${esc(sale.invoiceNumber)}</span></div>
  <div class="row"><span>Date:</span><span class="nowrap">${esc(dateStr)}</span></div>
  <div class="row"><span>Time:</span><span class="nowrap">${esc(timeStr)}</span></div>
  ${(show.customer && sale.customerName && sale.customerName !== 'Walk-in Customer') ? `<div class="row"><span>Customer:</span><span class="wrap">${esc(sale.customerName)}</span></div>` : ''}
  ${(show.customer && sale.customerPhone) ? `<div class="row"><span>Phone:</span><span>${esc(sale.customerPhone)}</span></div>` : ''}

  <div class="dash"></div>

  ${itemBlocks}

  <div class="dash"></div>

  <div class="row"><span>Subtotal:</span><span class="nowrap">${f(sale.subtotal)}</span></div>
  ${sale.discountAmount > 0 ? `<div class="row"><span>Discount:</span><span class="nowrap">-${f(sale.discountAmount)}</span></div>` : ''}
  <div class="solid"></div>
  <div class="row bold total"><span>TOTAL:</span><span class="nowrap">${f(sale.total)}</span></div>
  <div class="solid"></div>

  ${show.payment && sale.paymentMethod ? `<div class="row"><span>Payment:</span><span>${esc(sale.paymentMethod.toUpperCase())}</span></div>` : ''}
  ${show.payment && (sale.cashReceived != null && sale.cashReceived > 0) ? `<div class="row"><span>Cash:</span><span class="nowrap">${f(sale.cashReceived)}</span></div>` : ''}
  ${show.payment && (sale.changeAmount != null && sale.changeAmount > 0) ? `<div class="row bold"><span>Change:</span><span class="nowrap">${f(sale.changeAmount)}</span></div>` : ''}

  ${warrantyBlock}

  ${show.bank && (settings.bankName || settings.accNumber) ? `
  <div class="dash"></div>
  ${settings.bankName ? `<div class="small wrap">Bank: ${esc(settings.bankName)}</div>` : ''}
  ${settings.accNumber ? `<div class="small email">Acc: ${esc(settings.accNumber)}</div>` : ''}
  ` : ''}

  <div class="dash"></div>
  <div class="center">${esc(settings.footerNote || 'Thank you for your business!')}</div>
  ${show.website && settings.website ? `<div class="center small email">${esc(settings.website)}</div>` : ''}
  <div class="center small" style="margin-top:4px;color:#666;">${esc(HEXALYTE_SOFTWARE_FOOTER)}</div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=400,height=600')
  if (!win) { alert('Please allow pop-ups to print the thermal receipt.'); return }
  win.document.write(html)
  win.document.close()
  win.onload = () => { win.focus(); win.print(); win.close() }
}
