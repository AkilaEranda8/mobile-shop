'use client'

/**
 * StockFormInvoice — 9.5" × 11" continuous stock form (241 mm × 279 mm)
 * Dot-matrix / tractor-feed layout matching the Ashoka-style invoice design.
 */

import type { InvoiceSettings, ShopContext } from '@/lib/invoiceSettings'
import {
  mergeReceiptSettings,
  HEXALYTE_SOFTWARE_CREDIT,
  HEXALYTE_SUPPORT_PHONE,
} from '@/lib/invoiceSettings'
import { formatWarrantyMonths } from '@/components/pos/cart-rules'

export interface StockFormSale {
  invoiceNumber: string
  createdAt?: string
  customerName?: string
  customerPhone?: string
  customerAddress?: string
  cashierName?: string
  items: {
    productName: string
    quantity: number
    unitPrice: number
    total: number
    sku?: string
    imei?: string
    warrantyMonths?: number
  }[]
  subtotal: number
  discountAmount: number
  total: number
  paymentMethod?: string
  payments?: { method: string; amount: number }[]
  cashReceived?: number
  changeAmount?: number
  warrantyNumbers?: string[]
  warrantyMonths?: number
  warranties?: {
    warrantyCode: string
    productName?: string
    imei?: string
    endDate?: string
    monthsDuration?: number
  }[]
  dueAmount?: number
}

const PAGE_W = '241mm'
const PAGE_H = '279mm'
const BODY_W = '215mm'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtAmt(n: number): string {
  return new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2 }).format(n)
}

function fmtRs(n: number, currency = 'LKR'): string {
  const sym = currency === 'LKR' ? 'Rs' : currency
  return `${sym} ${fmtAmt(n)}`
}

function fmtOrderDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date()
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  return `${date} ${time}`
}

function discountPct(subtotal: number, discount: number): string {
  if (subtotal <= 0 || discount <= 0) return '0'
  return (discount / subtotal * 100).toFixed(1)
}

export function printStockFormInvoice(
  sale: StockFormSale,
  settings: InvoiceSettings,
  ctx?: ShopContext,
): void {
  settings = mergeReceiptSettings(settings, ctx)

  const currency = settings.currency || 'LKR'
  const f = (n: number) => esc(fmtRs(n, currency))
  const orderDate = esc(fmtOrderDate(sale.createdAt))
  const shopName = esc((settings.shopName || 'My Shop').toUpperCase())
  const customerName = esc(sale.customerName || 'Walk-in Customer')
  const customerPhone = sale.customerPhone ? esc(sale.customerPhone) : '—'
  const customerCity = sale.customerAddress ? esc(sale.customerAddress) : '—'
  const discPctStr = discountPct(sale.subtotal, sale.discountAmount)

  const itemRows = sale.items.map(item => {
    const extras = [
      item.sku ? `SKU: ${esc(item.sku)}` : '',
      item.imei ? `IMEI: ${esc(item.imei)}` : '',
      (item.warrantyMonths ?? 0) > 0 ? `Warranty Period: ${esc(formatWarrantyMonths(item.warrantyMonths!))}` : '',
    ].filter(Boolean).join(' · ')
    return `
      <tr>
        <td class="desc">
          <span class="name">${esc(item.productName)}</span>
          ${extras ? `<span class="sub">${extras}</span>` : ''}
        </td>
        <td class="num">${item.quantity}</td>
        <td class="num">${f(item.unitPrice)}</td>
        <td class="num">${f(item.total)}</td>
      </tr>`
  }).join('')

  let paymentHtml = ''
  if (sale.payments?.length) {
    const rows = sale.payments.map(p =>
      `<div class="kv"><span>Payment</span><span>${esc(p.method.toUpperCase())} : ${f(p.amount)}</span></div>`
    ).join('')
    paymentHtml = `
      <div class="sep-dash"></div>
      <div class="section-title">PAYMENT</div>
      ${rows}
      ${sale.cashReceived && sale.cashReceived > 0 ? `<div class="kv"><span>Cash Received</span><span>${f(sale.cashReceived)}</span></div>` : ''}
      ${sale.changeAmount && sale.changeAmount > 0 ? `<div class="kv"><span>Change</span><span>${f(sale.changeAmount)}</span></div>` : ''}
      ${sale.dueAmount && sale.dueAmount > 0 ? `<div class="kv due"><span>Outstanding</span><span>${f(sale.dueAmount)}</span></div>` : ''}`
  } else if (sale.paymentMethod) {
    paymentHtml = `
      <div class="sep-dash"></div>
      <div class="section-title">PAYMENT</div>
      <div class="kv"><span>Method</span><span>${esc(sale.paymentMethod.toUpperCase())}</span></div>
      ${sale.dueAmount && sale.dueAmount > 0 ? `<div class="kv due"><span>Outstanding</span><span>${f(sale.dueAmount)}</span></div>` : ''}`
  }

  type WarrantyLine = NonNullable<StockFormSale['warranties']>[number]
  const warrantyLines: WarrantyLine[] = sale.warranties?.length
    ? sale.warranties
    : (sale.warrantyNumbers ?? []).map(code => ({
        warrantyCode: code,
        monthsDuration: sale.warrantyMonths,
      }))

  const fmtExpiry = (endDate?: string, months?: number) => {
    if (endDate) return new Date(endDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    if (sale.createdAt && months) {
      const d = new Date(sale.createdAt)
      d.setMonth(d.getMonth() + months)
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }
    return '—'
  }

  let warrantyHtml = ''
  if ((warrantyLines?.length ?? 0) > 0) {
    const rows = (warrantyLines ?? []).map((w, i) => `
      <div class="warranty-row">
        ${w.productName ? `<div>${esc(w.productName)}</div>` : ''}
        ${w.imei ? `<div>IMEI: ${esc(w.imei)}</div>` : ''}
        <div class="kv"><span>Warranty ${(warrantyLines ?? []).length > 1 ? i + 1 : ''}</span><span class="mono">${esc(w.warrantyCode)}</span></div>
        ${(w.monthsDuration ?? 0) > 0 ? `<div class="kv"><span>Period</span><span>${esc(formatWarrantyMonths(w.monthsDuration!))}</span></div>` : ''}
        <div class="kv"><span>Expires</span><span>${esc(fmtExpiry(w.endDate, w.monthsDuration))}</span></div>
      </div>`).join('')
    warrantyHtml = `
      <div class="sep-dash"></div>
      <div class="section-title">WARRANTY</div>
      ${rows}`
  }

  const telLine = [
    settings.phone ? `Tel: ${esc(settings.phone)}` : '',
    settings.email ? esc(settings.email) : '',
  ].filter(Boolean).join(' | ')

  const footerNote = esc((settings.footerNote || 'THANK YOU FOR YOUR BUSINESS!').toUpperCase())
  const softwareLine = esc(`Software Powered by: ${HEXALYTE_SOFTWARE_CREDIT}`)
  const contactLine = esc(`Contact: ${HEXALYTE_SUPPORT_PHONE}${settings.email ? ` | ${settings.email}` : ''}`)

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Invoice ${esc(sale.invoiceNumber)}</title>
  <style>
    *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }

    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      line-height: 1.55;
      color: #000;
      background: #fff;
      width: ${BODY_W};
      margin: 0 auto;
      padding: 8mm 0;
    }

    .center { text-align: center; }
    .shop-name { font-size: 16px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 2px; }
    .shop-line { font-size: 11px; }

    .sep-eq, .sep-dash {
      font-size: 11px;
      letter-spacing: 0;
      white-space: nowrap;
      overflow: hidden;
      color: #000;
      margin: 8px 0;
      line-height: 1;
    }
    .sep-eq::before  { content: '${'='.repeat(72)}'; }
    .sep-dash::before { content: '${'-'.repeat(72)}'; }

    .meta { font-size: 12px; }
    .meta div { margin: 2px 0; }

    .section-title {
      font-weight: 700;
      font-size: 12px;
      letter-spacing: 0.5px;
      margin: 4px 0 6px;
    }

    .kv {
      display: flex;
      gap: 8px;
      font-size: 12px;
      margin: 2px 0;
    }
    .kv span:first-child { min-width: 72px; }
    .kv span:last-child { flex: 1; }

    table.items {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin-top: 4px;
    }
    table.items th {
      text-align: left;
      font-weight: 700;
      padding: 4px 0;
      border-bottom: 1px solid #000;
      font-size: 11px;
    }
    table.items th.num,
    table.items td.num { text-align: right; white-space: nowrap; width: 14%; }
    table.items th:nth-child(2),
    table.items td:nth-child(2) { width: 8%; }
    table.items td.desc { vertical-align: top; padding: 5px 8px 5px 0; }
    table.items td.num { vertical-align: top; padding: 5px 0; }
    table.items .name { display: block; }
    table.items .sub { display: block; font-size: 10px; color: #333; margin-top: 2px; }

    .totals { margin-top: 8px; font-size: 12px; }
    .totals .row {
      display: flex;
      justify-content: flex-end;
      gap: 16px;
      margin: 3px 0;
    }
    .totals .row span:first-child { min-width: 160px; text-align: right; }
    .totals .row span:last-child { min-width: 120px; text-align: right; white-space: nowrap; }
    .totals .discount span:last-child { color: #000; }

    .grand-total {
      text-align: center;
      font-size: 13px;
      font-weight: 700;
      margin: 6px 0;
      letter-spacing: 0.3px;
    }

    .signatures { margin-top: 14px; }
    .sig-grid {
      display: flex;
      justify-content: space-between;
      gap: 40px;
      margin-top: 10px;
    }
    .sig-box { flex: 1; text-align: center; font-size: 11px; }
    .sig-line {
      border-top: 1px dashed #000;
      margin-bottom: 6px;
      height: 36px;
    }

    .footer { margin-top: 4px; font-size: 11px; line-height: 1.7; }
    .footer .thanks { font-weight: 700; margin-bottom: 4px; }
    .mono { font-family: 'Courier New', Courier, monospace; }
    .due span:last-child { font-weight: 700; }
    .warranty-row { margin-bottom: 8px; font-size: 11px; }

    @media print {
      @page {
        size: ${PAGE_W} ${PAGE_H};
        margin: 8mm 13mm;
      }
      body { padding: 0; width: 100%; }
    }
  </style>
</head>
<body>

  <div class="center">
    <div class="shop-name">${shopName}</div>
    ${settings.slogan ? `<div class="shop-line">${esc(settings.slogan)}</div>` : ''}
    ${settings.address ? `<div class="shop-line">${esc(settings.address)}</div>` : ''}
    ${telLine ? `<div class="shop-line">${telLine}</div>` : ''}
  </div>

  <div class="sep-eq"></div>

  <div class="meta">
    <div>Invoice No &nbsp;: ${esc(sale.invoiceNumber)}</div>
    <div>Order Date : ${orderDate}</div>
    ${sale.cashierName ? `<div>Cashier &nbsp;&nbsp;&nbsp;: ${esc(sale.cashierName)}</div>` : ''}
  </div>

  <div class="sep-dash"></div>

  <div class="section-title">BILL TO</div>
  <div class="kv"><span>Company</span><span>: ${customerName}</span></div>
  <div class="kv"><span>Phone</span><span>: ${customerPhone}</span></div>
  <div class="kv"><span>City</span><span>: ${customerCity}</span></div>

  <div class="sep-dash"></div>

  <div class="section-title">ITEM DETAILS</div>
  <table class="items">
    <thead>
      <tr>
        <th>Product / Description</th>
        <th class="num">Qty</th>
        <th class="num">Unit Price</th>
        <th class="num">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="sep-dash"></div>

  <div class="totals">
    <div class="row"><span>SUBTOTAL</span><span>${f(sale.subtotal)}</span></div>
    ${sale.discountAmount > 0 ? `<div class="row discount"><span>DISCOUNT (${discPctStr}%)</span><span>-${f(sale.discountAmount)}</span></div>` : ''}
  </div>

  <div class="sep-eq"></div>
  <div class="grand-total">GRAND TOTAL : ${f(sale.total)}</div>
  <div class="sep-eq"></div>

  ${paymentHtml}
  ${warrantyHtml}

  <div class="signatures">
    <div class="section-title">SIGNATURES</div>
    <div class="sig-grid">
      <div class="sig-box">
        <div class="sig-line"></div>
        Customer Signature
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        ${esc(settings.signatoryName || 'Authorized Signature')}
      </div>
    </div>
  </div>

  <div class="sep-eq"></div>
  <div class="footer center">
    <div class="thanks">${footerNote}</div>
    <div>${softwareLine}</div>
    <div>${contactLine}</div>
    ${settings.website ? `<div>${esc(settings.website)}</div>` : ''}
  </div>

</body>
</html>`

  const win = window.open('', '_blank', 'width=960,height=740')
  if (!win) {
    alert('Please allow pop-ups to print the stock form invoice.')
    return
  }
  win.document.write(html)
  win.document.close()
  win.onload = () => {
    win.focus()
    win.print()
    win.close()
  }
}
