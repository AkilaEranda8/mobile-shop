'use client'

/**
 * StockFormInvoice — 9.5" × 11" continuous stock form (241 mm × 279 mm)
 * Compact professional invoice for dot-matrix / tractor-feed printers.
 */

import type { InvoiceSettings, ShopContext } from '@/lib/invoiceSettings'
import {
  mergeReceiptSettings,
  HEXALYTE_SOFTWARE_CREDIT,
  HEXALYTE_SUPPORT_PHONE,
} from '@/lib/invoiceSettings'
import { formatWarrantyPeriodLabel } from '@/components/pos/cart-rules'
import { productConditionLabel } from '@/lib/productCondition'

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
    condition?: 'BRAND_NEW' | 'USED'
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
  return `${date}  ${time}`
}

function discountPct(subtotal: number, discount: number): string {
  if (subtotal <= 0 || discount <= 0) return '0'
  return (discount / subtotal * 100).toFixed(1)
}

function fmtExpiryDate(iso?: string, months?: number): string | null {
  if (iso && months) {
    const d = new Date(iso)
    d.setMonth(d.getMonth() + months)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  if (iso && !months) {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  return null
}

function itemMetaLines(item: StockFormSale['items'][number], saleDate?: string): string {
  const lines: string[] = []
  if (item.condition) lines.push(`Condition: ${productConditionLabel(item.condition)}`)
  if (item.imei) lines.push(`IMEI: ${item.imei}`)
  if ((item.warrantyMonths ?? 0) > 0) {
    lines.push(`Warranty: ${formatWarrantyPeriodLabel(item.warrantyMonths!)}`)
    const until = fmtExpiryDate(saleDate, item.warrantyMonths)
    if (until) lines.push(`Valid until: ${until}`)
  }
  return lines.map(l => esc(l)).join('<br/>')
}

function termsBlockHtml(title: string, items: string[]): string {
  const lines = items.filter(t => t.trim())
  if (!lines.length) return ''
  return `
    <div class="block terms-block">
      <div class="block-title">${esc(title)}</div>
      <ul class="terms-list">
        ${lines.map(t => `<li>${esc(t)}</li>`).join('')}
      </ul>
    </div>`
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
  const shopTitle = esc(
    (settings.companyLegalName?.trim() || settings.shopName || 'My Shop').toUpperCase(),
  )
  const customerName = esc(sale.customerName || 'Walk-in Customer')
  const customerPhone = sale.customerPhone?.trim() ? esc(sale.customerPhone.trim()) : ''
  const customerCity = sale.customerAddress?.trim() ? esc(sale.customerAddress.trim()) : ''
  const discPctStr = discountPct(sale.subtotal, sale.discountAmount)

  const itemRows = sale.items.map(item => {
    const meta = itemMetaLines(item, sale.createdAt)
    return `
    <tr>
      <td class="desc">
        <div class="name">${esc(item.productName)}</div>
        ${meta ? `<div class="meta">${meta}</div>` : ''}
      </td>
      <td class="qty">${item.quantity}</td>
      <td class="money">${f(item.unitPrice)}</td>
      <td class="money"><strong>${f(item.total)}</strong></td>
    </tr>`
  }).join('')

  const payMethod = sale.payments?.length
    ? sale.payments.map(p => `${esc(p.method.toUpperCase())} ${f(p.amount)}`).join(' + ')
    : sale.paymentMethod
      ? `${esc(sale.paymentMethod.toUpperCase())} ${f(sale.total)}`
      : ''

  let paymentRows = ''
  if (payMethod) {
    paymentRows += `<tr><td colspan="2"></td><td class="money total-label">Paid</td><td class="money">${payMethod}</td></tr>`
  }
  if (sale.cashReceived && sale.cashReceived > 0) {
    paymentRows += `<tr><td colspan="2"></td><td class="money total-label">Cash Received</td><td class="money">${f(sale.cashReceived)}</td></tr>`
  }
  if (sale.changeAmount && sale.changeAmount > 0) {
    paymentRows += `<tr><td colspan="2"></td><td class="money total-label">Change</td><td class="money">${f(sale.changeAmount)}</td></tr>`
  }
  if (sale.dueAmount && sale.dueAmount > 0) {
    paymentRows += `<tr><td colspan="2"></td><td class="money total-label due">Outstanding</td><td class="money due"><strong>${f(sale.dueAmount)}</strong></td></tr>`
  }

  const totalsFooter = `
        <tfoot>
          <tr>
            <td colspan="2"></td>
            <td class="money total-label">Subtotal</td>
            <td class="money">${f(sale.subtotal)}</td>
          </tr>
          ${sale.discountAmount > 0
            ? `<tr>
                <td colspan="2"></td>
                <td class="money total-label">Discount (${discPctStr}%)</td>
                <td class="money">-${f(sale.discountAmount)}</td>
              </tr>`
            : ''}
          <tr class="grand-row">
            <td colspan="2"></td>
            <td class="money total-label grand">Grand Total</td>
            <td class="money grand"><strong>${f(sale.total)}</strong></td>
          </tr>
          ${paymentRows}
        </tfoot>`

  const tel = settings.phone ? `Tel: ${esc(settings.phone)}` : ''
  const email = settings.email ? esc(settings.email) : ''
  const contactLine = [tel, email].filter(Boolean).join('  ·  ')
  const footerNote = esc((settings.footerNote || 'Thank you for your business!').toUpperCase())

  const warrantyTermsHtml = termsBlockHtml(
    'Warranty & Service Terms',
    settings.warrantyServiceTerms ?? [],
  )
  const generalTermsHtml = termsBlockHtml(
    'Terms & Conditions',
    settings.terms ?? [],
  )

  const billToRows = [
    `<div class="bill-row"><span class="lbl">Customer</span><span class="val">${customerName}</span></div>`,
    customerPhone
      ? `<div class="bill-row"><span class="lbl">Phone</span><span class="val">${customerPhone}</span></div>`
      : '',
    customerCity
      ? `<div class="bill-row"><span class="lbl">City</span><span class="val">${customerCity}</span></div>`
      : '',
  ].filter(Boolean).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Invoice ${esc(sale.invoiceNumber)}</title>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #000;
      background: #fff;
      width: 100%;
      max-width: 190mm;
      margin: 0 auto;
      padding: 0;
    }

    .sheet { padding: 0; }

    .header { text-align: center; padding-bottom: 8px; }
    .logo { max-height: 48px; max-width: 70%; object-fit: contain; margin-bottom: 6px; }
    .shop-title {
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 0.4px;
      line-height: 1.25;
      margin-bottom: 4px;
    }
    .shop-sub {
      font-size: 9.5px;
      line-height: 1.45;
      color: #222;
      max-width: 92%;
      margin: 0 auto 3px;
    }

    hr.rule { border: none; border-top: 1px solid #000; margin: 7px 0; }
    hr.rule-thick { border: none; border-top: 2px solid #000; margin: 8px 0; }

    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 16px;
      font-size: 11px;
    }
    .meta-grid .full { grid-column: 1 / -1; }
    .meta-grid span { color: #444; }
    .meta-grid strong { font-weight: 700; color: #000; }

    .block { margin: 8px 0; }
    .block-title {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 5px;
    }

    .bill-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-size: 11px;
      padding: 2px 0;
    }
    .bill-row .lbl {
      color: #444;
      min-width: 72px;
    }
    .bill-row .val {
      text-align: right;
      font-weight: 600;
      word-break: break-word;
    }

    table.items {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
      margin-top: 2px;
    }
    table.items thead th {
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding: 5px 4px;
      border-top: 2px solid #000;
      border-bottom: 1px solid #000;
      vertical-align: bottom;
    }
    table.items tbody td {
      padding: 6px 4px;
      vertical-align: top;
      border-bottom: 1px solid #ccc;
    }
    table.items tbody tr:last-child td { border-bottom: 1px solid #000; }
    table.items tfoot td {
      padding: 4px 4px;
      vertical-align: top;
      border: none;
    }
    table.items tfoot tr:first-child td {
      padding-top: 8px;
      border-top: 1px solid #ccc;
    }
    table.items tfoot .total-label {
      text-align: right;
      font-weight: 600;
      white-space: nowrap;
    }
    table.items tfoot .grand {
      font-size: 12px;
      font-weight: 800;
      padding-top: 4px;
      padding-bottom: 4px;
    }
    table.items tfoot .due { font-weight: 800; }
    table.items .desc { width: 48%; }
    table.items .qty { width: 8%; text-align: center; }
    table.items .money {
      width: 22%;
      text-align: right;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    table.items .name { font-weight: 700; font-size: 11px; }
    table.items .meta {
      font-size: 9.5px;
      color: #333;
      margin-top: 3px;
      line-height: 1.45;
    }

    .terms-block { margin-top: 10px; page-break-inside: avoid; }
    .terms-list {
      margin: 0;
      padding-left: 16px;
      font-size: 9.5px;
      line-height: 1.5;
      color: #222;
    }
    .terms-list li { margin-bottom: 3px; }

    .signatures {
      display: flex;
      gap: 24px;
      margin-top: 12px;
      page-break-inside: avoid;
    }
    .sig {
      flex: 1;
      text-align: center;
      font-size: 10px;
    }
    .sig-line {
      height: 28px;
      margin-bottom: 4px;
    }

    .footer {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 2px solid #000;
      text-align: center;
      font-size: 9.5px;
      line-height: 1.55;
      page-break-inside: avoid;
    }
    .footer .thanks {
      font-weight: 800;
      font-size: 10.5px;
      margin-bottom: 4px;
      letter-spacing: 0.3px;
    }

    @media print {
      @page {
        size: ${PAGE_W} auto;
        margin: 8mm 10mm;
      }
      html, body { width: 100%; height: auto; }
      .sheet { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="sheet">

    <div class="header">
      ${settings.logo ? `<img class="logo" src="${esc(settings.logo)}" alt="" />` : ''}
      <div class="shop-title">${shopTitle}</div>
      ${settings.slogan ? `<div class="shop-sub">${esc(settings.slogan)}</div>` : ''}
      ${settings.address ? `<div class="shop-sub">${esc(settings.address)}</div>` : ''}
      ${contactLine ? `<div class="shop-sub">${contactLine}</div>` : ''}
    </div>

    <hr class="rule-thick" />

    <div class="meta-grid">
      <div><span>Invoice No: </span><strong>${esc(sale.invoiceNumber)}</strong></div>
      <div><span>Date: </span><strong>${orderDate}</strong></div>
    </div>

    <hr class="rule" />

    <div class="block">
      <div class="block-title">Bill To</div>
      ${billToRows}
    </div>

    <div class="block">
      <div class="block-title">Item Details</div>
      <table class="items">
        <thead>
          <tr>
            <th class="desc">Product / Description</th>
            <th class="qty">Qty</th>
            <th class="money">Unit Price</th>
            <th class="money">Amount</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
        ${totalsFooter}
      </table>
    </div>

    ${warrantyTermsHtml}
    ${generalTermsHtml}

    <div class="signatures">
      <div class="sig">
        <div class="sig-line"></div>
        Customer Signature
      </div>
      <div class="sig">
        <div class="sig-line"></div>
        ${esc(settings.signatoryName || 'Authorized Signature')}
      </div>
    </div>

    <div class="footer">
      <div class="thanks">${footerNote}</div>
      <div>${esc(HEXALYTE_SOFTWARE_CREDIT)} · ${esc(HEXALYTE_SUPPORT_PHONE)}</div>
      ${settings.website ? `<div>${esc(settings.website)}</div>` : ''}
    </div>

  </div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=800,height=900')
  if (!win) {
    alert('Please allow pop-ups to print the stock form invoice.')
    return
  }
  win.document.write(html)
  win.document.close()
  win.onload = () => {
    win.focus()
    setTimeout(() => {
      win.print()
      win.close()
    }, 300)
  }
}
