'use client'

import React, { forwardRef } from 'react'
import type { InvoiceSettings, ShopContext } from '@/lib/invoiceSettings'
import { mergeReceiptSettings } from '@/lib/invoiceSettings'

export interface ThermalSale {
  invoiceNumber: string
  createdAt?: string
  customerName?: string
  customerPhone?: string
  items: { productName: string; quantity: number; unitPrice: number; total: number; sku?: string; imei?: string }[]
  subtotal: number
  discountAmount: number
  total: number
  paymentMethod?: string
  cashReceived?: number
  changeAmount?: number
  warrantyNumbers?: string[]
  warrantyMonths?: number
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

function thermalBodyWidth(paper: '58mm' | '80mm') {
  return paper === '58mm' ? '200px' : '288px'
}

// ── Component ─────────────────────────────────────────────────────────────────

const ThermalReceipt = forwardRef<HTMLDivElement, ThermalReceiptProps>(
  function ThermalReceipt({ sale, settings }, ref) {
    const currency = settings.currency || 'LKR'
    const f = (n: number) => fmt(n, currency)
    const paper = settings.thermalWidthPOS || '58mm'

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
          fontSize: '13px',
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
        {settings.logo && (
          <div style={{ textAlign: 'center', marginBottom: 6 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={settings.logo} alt="logo" style={{ maxHeight: 44, maxWidth: '90%', objectFit: 'contain' }} />
          </div>
        )}
        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 16 }}>
          {settings.shopName || 'My Shop'}
        </div>
        {settings.slogan && (
          <div style={{ textAlign: 'center', fontSize: 11 }}>{settings.slogan}</div>
        )}
        {settings.address && (
          <div style={{ textAlign: 'center', fontSize: 11, wordBreak: 'break-word' }}>{settings.address}</div>
        )}
        {settings.phone && (
          <div style={{ textAlign: 'center', fontSize: 11 }}>Tel: {settings.phone}</div>
        )}
        {settings.email && (
          <div style={{ textAlign: 'center', fontSize: 11, wordBreak: 'break-all' }}>{settings.email}</div>
        )}

        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

        {[
          row('Receipt:', sale.invoiceNumber),
          row('Date:', dateStr),
          row('Time:', timeStr),
          ...(sale.customerName && sale.customerName !== 'Walk-in Customer' ? [row('Customer:', sale.customerName)] : []),
          ...(sale.customerPhone ? [row('Phone:', sale.customerPhone)] : []),
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
            {item.sku && <div style={{ fontSize: 11, color: '#333' }}>SKU: {item.sku}</div>}
            {item.imei && <div style={{ fontSize: 11, color: '#333' }}>IMEI: {item.imei}</div>}
            <div style={{ ...rowStyle, marginTop: 2 }}>
              <span style={{ fontSize: 11 }}>{item.quantity} x {f(item.unitPrice)}</span>
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
        <div style={{ ...rowStyle, fontWeight: 'bold', fontSize: 16 }}>
          <span>TOTAL:</span>
          <span style={{ whiteSpace: 'nowrap' }}>{f(sale.total)}</span>
        </div>
        <div style={{ borderTop: '1px solid #000', margin: '4px 0' }} />

        {sale.paymentMethod && (
          <div style={rowStyle}><span>Payment:</span><span>{sale.paymentMethod.toUpperCase()}</span></div>
        )}
        {sale.cashReceived != null && sale.cashReceived > 0 && (
          <div style={rowStyle}><span>Cash:</span><span style={{ whiteSpace: 'nowrap' }}>{f(sale.cashReceived)}</span></div>
        )}
        {sale.changeAmount != null && sale.changeAmount > 0 && (
          <div style={{ ...rowStyle, fontWeight: 'bold' }}><span>Change:</span><span style={{ whiteSpace: 'nowrap' }}>{f(sale.changeAmount)}</span></div>
        )}

        {(settings.bankName || settings.accNumber) && (
          <>
            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
            {settings.bankName && <div style={{ fontSize: 11, wordBreak: 'break-word' }}>Bank: {settings.bankName}</div>}
            {settings.accNumber && <div style={{ fontSize: 11, wordBreak: 'break-all' }}>Acc: {settings.accNumber}</div>}
          </>
        )}

        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

        <div style={{ textAlign: 'center', fontSize: 12 }}>
          {settings.footerNote || 'Thank you for your business!'}
        </div>
        {settings.website && (
          <div style={{ textAlign: 'center', fontSize: 11, wordBreak: 'break-all' }}>{settings.website}</div>
        )}
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

  const date = sale.createdAt ? new Date(sale.createdAt) : new Date()
  const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' })

  const paperWidth = settings.thermalWidthPOS || '58mm'
  const bodyWidth = thermalBodyWidth(paperWidth)

  const itemBlocks = sale.items.map(item => `
    <div class="item">
      <div class="item-name">${esc(item.productName)}</div>
      ${item.sku ? `<div class="item-meta">SKU: ${esc(item.sku)}</div>` : ''}
      ${item.imei ? `<div class="item-meta">IMEI: ${esc(item.imei)}</div>` : ''}
      <div class="row item-line">
        <span class="item-meta">${item.quantity} x ${f(item.unitPrice)}</span>
        <span class="bold nowrap">${f(item.total)}</span>
      </div>
    </div>
  `).join('')

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
      font-size: 13px;
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
    .small  { font-size: 11px; }
    .large  { font-size: 16px; }
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
    .item-meta { font-size: 11px; color: #333; }
    .item-line { margin-top: 2px; }
    @media print {
      @page { margin: 2mm; size: ${paperWidth} auto; }
      html, body { width: 100%; max-width: 100%; padding: 0 1mm; }
    }
  </style>
</head>
<body>
  ${settings.logo ? `<div class="center" style="margin-bottom:6px"><img src="${esc(settings.logo)}" style="max-height:44px;max-width:90%;object-fit:contain"/></div>` : ''}
  <div class="center bold large wrap">${esc(settings.shopName || 'My Shop')}</div>
  ${settings.slogan ? `<div class="center small wrap">${esc(settings.slogan)}</div>` : ''}
  ${settings.address ? `<div class="center small wrap">${esc(settings.address)}</div>` : ''}
  ${settings.phone   ? `<div class="center small">Tel: ${esc(settings.phone)}</div>` : ''}
  ${settings.email   ? `<div class="center small email">${esc(settings.email)}</div>` : ''}

  <div class="dash"></div>

  <div class="row"><span>Receipt:</span><span>${esc(sale.invoiceNumber)}</span></div>
  <div class="row"><span>Date:</span><span class="nowrap">${esc(dateStr)}</span></div>
  <div class="row"><span>Time:</span><span class="nowrap">${esc(timeStr)}</span></div>
  ${(sale.customerName && sale.customerName !== 'Walk-in Customer') ? `<div class="row"><span>Customer:</span><span class="wrap">${esc(sale.customerName)}</span></div>` : ''}
  ${sale.customerPhone ? `<div class="row"><span>Phone:</span><span>${esc(sale.customerPhone)}</span></div>` : ''}

  <div class="dash"></div>

  ${itemBlocks}

  <div class="dash"></div>

  <div class="row"><span>Subtotal:</span><span class="nowrap">${f(sale.subtotal)}</span></div>
  ${sale.discountAmount > 0 ? `<div class="row"><span>Discount:</span><span class="nowrap">-${f(sale.discountAmount)}</span></div>` : ''}
  <div class="solid"></div>
  <div class="row bold large"><span>TOTAL:</span><span class="nowrap">${f(sale.total)}</span></div>
  <div class="solid"></div>

  ${sale.paymentMethod ? `<div class="row"><span>Payment:</span><span>${esc(sale.paymentMethod.toUpperCase())}</span></div>` : ''}
  ${(sale.cashReceived != null && sale.cashReceived > 0) ? `<div class="row"><span>Cash:</span><span class="nowrap">${f(sale.cashReceived)}</span></div>` : ''}
  ${(sale.changeAmount != null && sale.changeAmount > 0) ? `<div class="row bold"><span>Change:</span><span class="nowrap">${f(sale.changeAmount)}</span></div>` : ''}

  ${(sale.warrantyNumbers && sale.warrantyNumbers.length > 0) ? `
  <div class="dash"></div>
  <div class="center bold">WARRANTY</div>
  ${(sale.warrantyNumbers ?? []).map((w, i) => `<div class="row"><span>Warranty ${(sale.warrantyNumbers ?? []).length > 1 ? i+1 : ''}:</span><span class="bold wrap">${esc(w)}</span></div>`).join('')}
  ${sale.warrantyMonths ? `<div class="center small">Valid for ${sale.warrantyMonths} month${sale.warrantyMonths !== 1 ? 's' : ''}</div>` : ''}
  ` : ''}

  ${(settings.bankName || settings.accNumber) ? `
  <div class="dash"></div>
  ${settings.bankName ? `<div class="small wrap">Bank: ${esc(settings.bankName)}</div>` : ''}
  ${settings.accNumber ? `<div class="small email">Acc: ${esc(settings.accNumber)}</div>` : ''}
  ` : ''}

  <div class="dash"></div>
  <div class="center">${esc(settings.footerNote || 'Thank you for your business!')}</div>
  ${settings.website ? `<div class="center small email">${esc(settings.website)}</div>` : ''}
</body>
</html>`

  const win = window.open('', '_blank', 'width=400,height=600')
  if (!win) { alert('Please allow pop-ups to print the thermal receipt.'); return }
  win.document.write(html)
  win.document.close()
  win.onload = () => { win.focus(); win.print(); win.close() }
}
