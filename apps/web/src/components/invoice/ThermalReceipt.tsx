'use client'

import React, { forwardRef } from 'react'
import type { InvoiceSettings } from '@/lib/invoiceSettings'

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
}

interface ThermalReceiptProps {
  sale: ThermalSale
  settings: InvoiceSettings
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const LINE = '─'.repeat(32)
const DASH = '- '.repeat(16)

function fmt(n: number, currency = 'LKR') {
  return currency + ' ' + new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2 }).format(n)
}

function center(text: string, width = 32) {
  const pad = Math.max(0, Math.floor((width - text.length) / 2))
  return ' '.repeat(pad) + text
}

function row(left: string, right: string, width = 32) {
  const space = Math.max(1, width - left.length - right.length)
  return left + ' '.repeat(space) + right
}

// ── Component ─────────────────────────────────────────────────────────────────

const ThermalReceipt = forwardRef<HTMLDivElement, ThermalReceiptProps>(
  function ThermalReceipt({ sale, settings }, ref) {
    const currency = settings.currency || 'LKR'
    const f = (n: number) => fmt(n, currency)

    const date = sale.createdAt ? new Date(sale.createdAt) : new Date()
    const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    const timeStr = date.toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' })

    return (
      <div
        ref={ref}
        style={{
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: '12px',
          lineHeight: '1.5',
          width: settings.thermalWidthPOS === '58mm' ? '216px' : '302px',
          padding: '8px 4px',
          background: '#fff',
          color: '#000',
          whiteSpace: 'pre',
        }}
      >
        {/* Header */}
        {settings.logo && (
          <div style={{ textAlign: 'center', marginBottom: 6 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={settings.logo} alt="logo" style={{ maxHeight: 48, maxWidth: 120, objectFit: 'contain' }} />
          </div>
        )}
        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 14 }}>
          {settings.shopName || 'SHOP NAME'}
        </div>
        {settings.slogan && (
          <div style={{ textAlign: 'center', fontSize: 10 }}>{settings.slogan}</div>
        )}
        {settings.address && (
          <div style={{ textAlign: 'center', fontSize: 10 }}>{settings.address}</div>
        )}
        {settings.phone && (
          <div style={{ textAlign: 'center', fontSize: 10 }}>Tel: {settings.phone}</div>
        )}
        {settings.email && (
          <div style={{ textAlign: 'center', fontSize: 10 }}>{settings.email}</div>
        )}

        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

        {/* Invoice info */}
        <div>{row('Receipt:', sale.invoiceNumber)}</div>
        <div>{row('Date:', dateStr)}</div>
        <div>{row('Time:', timeStr)}</div>
        {(sale.customerName && sale.customerName !== 'Walk-in Customer') && (
          <div>{row('Customer:', sale.customerName.slice(0, 20))}</div>
        )}
        {sale.customerPhone && (
          <div>{row('Phone:', sale.customerPhone)}</div>
        )}

        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

        {/* Items header */}
        <div style={{ fontWeight: 'bold' }}>{'ITEM            QTY   AMOUNT'}</div>
        <div style={{ borderTop: '1px solid #000', margin: '2px 0' }} />

        {/* Items */}
        {sale.items.map((item, i) => {
          const nameSlice = item.productName.slice(0, 18)
          const qtyStr = String(item.quantity).padStart(3)
          const amtStr = f(item.total)
          const namePad = nameSlice.padEnd(18)
          return (
            <React.Fragment key={i}>
              <div>{namePad + qtyStr + '  ' + amtStr}</div>
              <div style={{ fontSize: 10, paddingLeft: 2 }}>
                {fmt(item.unitPrice, currency) + ' each'}
                {item.sku ? `  SKU:${item.sku}` : ''}
              </div>
              {item.imei && (
                <div style={{ fontSize: 10, paddingLeft: 2 }}>IMEI: {item.imei}</div>
              )}
            </React.Fragment>
          )
        })}

        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

        {/* Totals */}
        <div>{row('Subtotal:', f(sale.subtotal))}</div>
        {sale.discountAmount > 0 && (
          <div>{row('Discount:', '-' + f(sale.discountAmount))}</div>
        )}
        <div style={{ borderTop: '1px solid #000', margin: '2px 0' }} />
        <div style={{ fontWeight: 'bold', fontSize: 14 }}>{row('TOTAL:', f(sale.total))}</div>
        <div style={{ borderTop: '1px solid #000', margin: '2px 0' }} />

        {/* Payment */}
        {sale.paymentMethod && (
          <div>{row('Payment:', sale.paymentMethod.toUpperCase())}</div>
        )}
        {sale.cashReceived != null && sale.cashReceived > 0 && (
          <div>{row('Cash:', f(sale.cashReceived))}</div>
        )}
        {sale.changeAmount != null && sale.changeAmount > 0 && (
          <div style={{ fontWeight: 'bold' }}>{row('Change:', f(sale.changeAmount))}</div>
        )}

        {/* Bank details */}
        {(settings.bankName || settings.accNumber) && (
          <>
            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
            <div style={{ fontSize: 10 }}>Bank: {settings.bankName}</div>
            {settings.accNumber && <div style={{ fontSize: 10 }}>Acc: {settings.accNumber}</div>}
          </>
        )}

        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: 11 }}>
          {settings.footerNote || 'Thank you for your business!'}
        </div>
        {settings.website && (
          <div style={{ textAlign: 'center', fontSize: 10 }}>{settings.website}</div>
        )}
        <div style={{ textAlign: 'center', fontSize: 10, marginTop: 4 }}>
          {'* * * * * * * * * * * * * * *'}
        </div>
      </div>
    )
  }
)

ThermalReceipt.displayName = 'ThermalReceipt'

export default ThermalReceipt

// ── Standalone print helper ────────────────────────────────────────────────────

export function printThermalReceipt(sale: ThermalSale, settings: InvoiceSettings) {
  const currency = settings.currency || 'LKR'
  const f = (n: number) => currency + ' ' + new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2 }).format(n)

  const date = sale.createdAt ? new Date(sale.createdAt) : new Date()
  const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' })

  const itemRows = sale.items.map(item => `
    <tr>
      <td style="padding:2px 0">${item.productName}${item.sku ? `<br><small>SKU: ${item.sku}</small>` : ''}${item.imei ? `<br><small>IMEI: ${item.imei}</small>` : ''}</td>
      <td style="text-align:center;padding:2px 4px">${item.quantity}</td>
      <td style="text-align:right;white-space:nowrap;padding:2px 0">${f(item.unitPrice)}</td>
      <td style="text-align:right;white-space:nowrap;padding:2px 0">${f(item.total)}</td>
    </tr>
  `).join('')

  const paperWidth = settings.thermalWidthPOS || '58mm'
  const bodyWidth   = paperWidth === '58mm' ? '216px' : '302px'

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Receipt ${sale.invoiceNumber}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      width: ${bodyWidth};
      margin: 0 auto;
      padding: 8px 4px;
      background: #fff;
      color: #000;
    }
    .center { text-align: center; }
    .bold   { font-weight: bold; }
    .small  { font-size: 10px; }
    .large  { font-size: 14px; }
    .dash   { border-top: 1px dashed #000; margin: 5px 0; }
    .solid  { border-top: 1px solid #000;  margin: 3px 0; }
    table   { width: 100%; border-collapse: collapse; }
    td      { font-size: 11px; vertical-align: top; }
    .row    { display: flex; justify-content: space-between; }
    @media print {
      @page { margin: 0; size: ${settings.thermalWidthPOS || '58mm'} auto; }
      body  { width: 100%; }
    }
  </style>
</head>
<body>
  ${settings.logo ? `<div class="center" style="margin-bottom:6px"><img src="${settings.logo}" style="max-height:48px;max-width:120px;object-fit:contain"/></div>` : ''}
  <div class="center bold large">${settings.shopName || 'SHOP NAME'}</div>
  ${settings.slogan ? `<div class="center small">${settings.slogan}</div>` : ''}
  ${settings.address ? `<div class="center small">${settings.address}</div>` : ''}
  ${settings.phone   ? `<div class="center small">Tel: ${settings.phone}</div>` : ''}
  ${settings.email   ? `<div class="center small">${settings.email}</div>` : ''}

  <div class="dash"></div>

  <div class="row"><span>Receipt:</span><span>${sale.invoiceNumber}</span></div>
  <div class="row"><span>Date:</span><span>${dateStr}</span></div>
  <div class="row"><span>Time:</span><span>${timeStr}</span></div>
  ${(sale.customerName && sale.customerName !== 'Walk-in Customer') ? `<div class="row"><span>Customer:</span><span>${sale.customerName}</span></div>` : ''}
  ${sale.customerPhone ? `<div class="row"><span>Phone:</span><span>${sale.customerPhone}</span></div>` : ''}

  <div class="dash"></div>

  <table>
    <thead>
      <tr>
        <th style="text-align:left;font-size:11px;padding-bottom:2px">ITEM</th>
        <th style="text-align:center;font-size:11px;padding-bottom:2px">QTY</th>
        <th style="text-align:right;font-size:11px;padding-bottom:2px">PRICE</th>
        <th style="text-align:right;font-size:11px;padding-bottom:2px">TOTAL</th>
      </tr>
    </thead>
    <tbody>
      <tr><td colspan="4"><div class="solid"></div></td></tr>
      ${itemRows}
    </tbody>
  </table>

  <div class="dash"></div>

  <div class="row"><span>Subtotal:</span><span>${f(sale.subtotal)}</span></div>
  ${sale.discountAmount > 0 ? `<div class="row"><span>Discount:</span><span>-${f(sale.discountAmount)}</span></div>` : ''}
  <div class="solid"></div>
  <div class="row bold large"><span>TOTAL:</span><span>${f(sale.total)}</span></div>
  <div class="solid"></div>

  ${sale.paymentMethod ? `<div class="row"><span>Payment:</span><span>${sale.paymentMethod.toUpperCase()}</span></div>` : ''}
  ${(sale.cashReceived != null && sale.cashReceived > 0) ? `<div class="row"><span>Cash:</span><span>${f(sale.cashReceived)}</span></div>` : ''}
  ${(sale.changeAmount != null && sale.changeAmount > 0) ? `<div class="row bold"><span>Change:</span><span>${f(sale.changeAmount)}</span></div>` : ''}

  ${(settings.bankName || settings.accNumber) ? `
  <div class="dash"></div>
  ${settings.bankName ? `<div class="small">Bank: ${settings.bankName}</div>` : ''}
  ${settings.accNumber ? `<div class="small">Acc: ${settings.accNumber}</div>` : ''}
  ` : ''}

  <div class="dash"></div>
  <div class="center" style="font-size:11px">${settings.footerNote || 'Thank you for your business!'}</div>
  ${settings.website ? `<div class="center small">${settings.website}</div>` : ''}
  <div class="center small" style="margin-top:4px">* * * * * * * * * * * * * * *</div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=400,height=600')
  if (!win) { alert('Please allow pop-ups to print the thermal receipt.'); return }
  win.document.write(html)
  win.document.close()
  win.onload = () => { win.focus(); win.print(); win.close() }
}
