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
import type { ExchangeTradeInBill } from '@/lib/exchangeBill'

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
    storage?: string
    color?: string
    itemNotes?: string
    warrantyMonths?: number
    warrantyNote?: string
    warrantyEndDate?: string
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
  tradeIn?: ExchangeTradeInBill | null
}

const PAGE_W = '241mm'
const PAGE_H = '279mm'
const PAGE_MARGIN_V = '16mm'
const PAGE_CONTENT_MIN_H = `calc(${PAGE_H} - ${PAGE_MARGIN_V})`

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
  const abs = Math.abs(n)
  const formatted = fmtAmt(abs)
  if (n < 0) return `-${sym} ${formatted}`
  return `${sym} ${formatted}`
}

function isTradeInLineItem(item: StockFormSale['items'][number]): boolean {
  return item.productName.trim().toLowerCase().startsWith('trade-in:')
}

function tradeInFromItems(items: StockFormSale['items']): ExchangeTradeInBill | null {
  const item = items.find(isTradeInLineItem)
  if (!item) return null
  const condition = item.itemNotes?.replace(/^Condition:\s*/i, '').trim()
  return {
    productName: item.productName.replace(/^Trade-in:\s*/i, '').trim() || 'Trade-in device',
    imei: item.imei,
    storage: item.storage,
    color: item.color,
    condition: condition || undefined,
    creditAmount: Math.abs(Number(item.total)),
  }
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
  const variantInName = item.productName.includes(' · ')
  if (!variantInName && (item.storage || item.color)) {
    lines.push([item.storage, item.color].filter(Boolean).join(' · '))
  }
  if (item.condition) lines.push(`Condition: ${productConditionLabel(item.condition)}`)
  if (item.itemNotes?.trim()) lines.push(item.itemNotes.trim())
  if (item.imei) lines.push(`IMEI: ${item.imei}`)
  if ((item.warrantyMonths ?? 0) > 0) {
    lines.push(`Warranty: ${formatWarrantyPeriodLabel(item.warrantyMonths!)}`)
    const until = item.warrantyEndDate
      ? new Date(item.warrantyEndDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : fmtExpiryDate(saleDate, item.warrantyMonths)
    if (until) lines.push(`Valid until: ${until}`)
  }
  return lines.map(l => esc(l)).join('<br/>')
}

function itemWarrantyNoteHtml(item: StockFormSale['items'][number]): string {
  const note = item.warrantyNote?.trim()
  if (!note) return ''
  return `<div class="warranty-note"><span class="warranty-note-label">Warranty Note:</span> ${esc(note)}</div>`
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
  opts?: { targetWindow?: Window | null },
): boolean {
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
  const resolvedTradeIn = sale.tradeIn ?? tradeInFromItems(sale.items)

  const tradeInBlock = resolvedTradeIn
    ? `
    <div class="block trade-in-section">
      <div class="block-title">Trade-in Device</div>
      <div class="bill-row"><span class="lbl">Device</span><span class="val">${esc(resolvedTradeIn.productName)}</span></div>
      ${resolvedTradeIn.storage || resolvedTradeIn.color
        ? `<div class="bill-row"><span class="lbl">Variant</span><span class="val">${esc([resolvedTradeIn.storage, resolvedTradeIn.color].filter(Boolean).join(' · '))}</span></div>`
        : ''}
      ${resolvedTradeIn.imei
        ? `<div class="bill-row"><span class="lbl">IMEI</span><span class="val" style="font-family:monospace">${esc(resolvedTradeIn.imei)}</span></div>`
        : ''}
      ${resolvedTradeIn.condition
        ? `<div class="bill-row"><span class="lbl">Condition</span><span class="val">${esc(resolvedTradeIn.condition)}</span></div>`
        : ''}
      <div class="bill-row"><span class="lbl">Trade-in Value</span><span class="val trade-in-credit">${f(-resolvedTradeIn.creditAmount)}</span></div>
    </div>
    <hr class="rule" />`
    : ''

  const itemRows = sale.items.map(item => {
    const meta = itemMetaLines(item, sale.createdAt)
    const warrantyNote = itemWarrantyNoteHtml(item)
    const tradeInRow = isTradeInLineItem(item)
    return `
    <tr class="${tradeInRow ? 'trade-in-row' : ''}">
      <td class="desc">
        <div class="name">${esc(item.productName)}</div>
        ${meta ? `<div class="meta">${meta}</div>` : ''}
        ${warrantyNote}
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
          ${resolvedTradeIn
            ? `<tr>
                <td colspan="2"></td>
                <td class="money total-label">Trade-in Credit</td>
                <td class="money">${f(-resolvedTradeIn.creditAmount)}</td>
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

    .sheet {
      display: flex;
      flex-direction: column;
      min-height: ${PAGE_CONTENT_MIN_H};
      padding: 0;
    }
    .sheet-body { flex: 0 0 auto; }
    .sheet-bottom {
      margin-top: auto;
      flex-shrink: 0;
      padding-top: 12px;
    }
    .sheet-bottom .terms-block + .terms-block { margin-top: 8px; }

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
    table.items .warranty-note {
      font-size: 9.5px;
      color: #111;
      margin-top: 5px;
      padding-top: 4px;
      line-height: 1.5;
      border-top: 1px dotted #888;
      word-break: break-word;
    }
    table.items .warranty-note-label {
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.2px;
    }

    .trade-in-section {
      border: 1px solid #000;
      padding: 6px 8px;
      margin: 4px 0;
    }
    .trade-in-section .block-title { margin-bottom: 4px; }
    .trade-in-credit { font-weight: 800; }
    tr.trade-in-row td { background: #f5f5f5; }
    tr.trade-in-row .name { font-style: italic; }

    .terms-block { margin-top: 0; page-break-inside: avoid; }
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
      margin-top: 10px;
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
      margin-top: 8px;
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
        size: ${PAGE_W} ${PAGE_H};
        margin: 8mm 10mm;
      }
      html, body {
        width: 100%;
        height: auto;
        margin: 0;
      }
      .sheet {
        min-height: ${PAGE_CONTENT_MIN_H};
        display: flex;
        flex-direction: column;
        padding: 0;
      }
      .sheet-bottom { margin-top: auto; }
    }
  </style>
</head>
<body>
  <div class="sheet">

    <div class="sheet-body">
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

    ${tradeInBlock}

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
    </div>

    <div class="sheet-bottom">
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

  </div>
</body>
</html>`

  const win = opts?.targetWindow ?? window.open('', '_blank', 'width=800,height=900')
  if (!win || win.closed) {
    if (!opts?.targetWindow) alert('Please allow pop-ups to print the stock form invoice.')
    return false
  }
  try {
    win.document.open()
    win.document.write(html)
    win.document.close()
    const runPrint = () => {
      try {
        win.focus()
        win.print()
        setTimeout(() => {
          try { win.close() } catch { /* ignore */ }
        }, 400)
      } catch {
        /* ignore */
      }
    }
    setTimeout(runPrint, 50)
    return true
  } catch {
    try { win.close() } catch { /* ignore */ }
    return false
  }
}
