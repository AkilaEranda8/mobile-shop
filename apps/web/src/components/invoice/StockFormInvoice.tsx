'use client'

/**
 * StockFormInvoice — 9.5" × 11" continuous stock form (241 mm × 279 mm)
 * Designed for dot-matrix printers with tractor-feed paper.
 *
 * ⚠️  ZERO changes to existing code.  This file is purely additive.
 *     – No changes to database schema, API, controllers, or services.
 *     – No changes to ThermalReceipt, InvoicePrint, or WarrantyCertificate.
 *     – Existing 58mm / 80mm print paths are completely unaffected.
 */

import type { InvoiceSettings, ShopContext } from '@/lib/invoiceSettings'
import { mergeReceiptSettings } from '@/lib/invoiceSettings'

// ─── Data shape (mirrors ThermalSale so it can be fed the same data) ──────────

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
  dueAmount?: number
}

// ─── Dimensions ───────────────────────────────────────────────────────────────

/** Printable width on 9.5" stock form with 0.5" margins = 241 mm total width */
const PAGE_W = '241mm'
const PAGE_H = '279mm'     // 11 inches
const BODY_W = '215mm'     // 8.5" printable area (0.5" each side)

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function fmtCur(n: number, currency = 'LKR'): string {
  return currency + ' ' + fmtAmt(n)
}

function fmtDate(iso?: string): { date: string; time: string } {
  const d = iso ? new Date(iso) : new Date()
  return {
    date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' }),
  }
}

// ─── Main print function ───────────────────────────────────────────────────────

/**
 * Opens a new window and prints a 9.5" × 11" stock form invoice.
 * Call exactly like `printThermalReceipt(sale, settings, ctx)`.
 */
export function printStockFormInvoice(
  sale: StockFormSale,
  settings: InvoiceSettings,
  ctx?: ShopContext,
): void {
  settings = mergeReceiptSettings(settings, ctx)

  const currency = settings.currency || 'LKR'
  const f = (n: number) => esc(fmtCur(n, currency))
  const { date: dateStr, time: timeStr } = fmtDate(sale.createdAt)
  const shopName = esc(settings.shopName || 'My Shop')
  const isPaid = !sale.dueAmount || sale.dueAmount === 0

  // ── Items rows ────────────────────────────────────────────────────────────
  let itemRows = ''
  sale.items.forEach((item, idx) => {
    const bg = idx % 2 === 0 ? '#ffffff' : '#f5f5f5'
    itemRows += `
      <tr style="background:${bg};">
        <td style="padding:4px 8px;border-bottom:1px solid #ccc;">
          <b>${esc(item.productName)}</b>
          ${item.sku  ? `<br><span style="font-size:10px;color:#555;">SKU: ${esc(item.sku)}</span>` : ''}
          ${item.imei ? `<br><span style="font-size:10px;color:#555;">IMEI: ${esc(item.imei)}</span>` : ''}
        </td>
        <td style="padding:4px 8px;border-bottom:1px solid #ccc;text-align:center;">${item.quantity}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #ccc;text-align:right;white-space:nowrap;">${f(item.unitPrice)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #ccc;text-align:right;white-space:nowrap;"><b>${f(item.total)}</b></td>
      </tr>`
  })

  // ── Payment rows ──────────────────────────────────────────────────────────
  let payRows = ''
  if (sale.payments && sale.payments.length > 0) {
    sale.payments.forEach(p => {
      payRows += `<tr>
        <td style="padding:3px 6px;text-transform:uppercase;font-size:11px;">${esc(p.method)}</td>
        <td style="padding:3px 6px;text-align:right;font-size:11px;">${f(p.amount)}</td>
      </tr>`
    })
  } else if (sale.paymentMethod) {
    payRows += `<tr>
      <td style="padding:3px 6px;text-transform:uppercase;font-size:11px;">${esc(sale.paymentMethod)}</td>
      <td style="padding:3px 6px;text-align:right;font-size:11px;">${f(sale.total)}</td>
    </tr>`
  }

  // ── Warranty block ────────────────────────────────────────────────────────
  let warrantyHtml = ''
  if (sale.warrantyNumbers && sale.warrantyNumbers.length > 0) {
    warrantyHtml = `
      <div style="border-top:2px dashed #000;margin-top:14px;padding-top:10px;">
        <b style="font-size:12px;text-transform:uppercase;letter-spacing:1px;">Warranty Information</b>
        ${sale.warrantyNumbers.map((w, i) => `
          <div style="display:flex;justify-content:space-between;margin-top:5px;font-size:11px;">
            <span>Warranty ${sale.warrantyNumbers!.length > 1 ? i + 1 : ''}:</span>
            <b style="font-family:monospace;">${esc(w)}</b>
          </div>`).join('')}
        ${sale.warrantyMonths ? `<p style="font-size:11px;margin-top:4px;">Valid for ${sale.warrantyMonths} month${sale.warrantyMonths !== 1 ? 's' : ''} from purchase date.</p>` : ''}
      </div>`
  }

  // ── Full HTML document ────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Invoice ${esc(sale.invoiceNumber)}</title>
  <style>
    /* ── Reset ── */
    *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }

    /* ── Base ── */
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      line-height: 1.5;
      color: #000;
      background: #fff;
      width: ${BODY_W};
      margin: 0 auto;
      padding: 10mm 0;
    }

    table { width:100%; border-collapse:collapse; }
    th    { font-weight:700; text-transform:uppercase; font-size:10px; letter-spacing:.8px; }

    .divider-solid  { border-top:2px solid #000; margin:8px 0; }
    .divider-dashed { border-top:1px dashed #000; margin:6px 0; }
    .text-right  { text-align:right; }
    .text-center { text-align:center; }
    .mono        { font-family: 'Courier New', Courier, monospace; }

    /* ── Header band ── */
    .hdr {
      display:flex; justify-content:space-between; align-items:flex-start;
      border-bottom:3px solid #000; padding-bottom:8px; margin-bottom:8px;
    }
    .hdr-shop  { font-size:18px; font-weight:900; letter-spacing:.5px; }
    .hdr-sub   { font-size:10px; color:#444; margin-top:2px; }
    .hdr-inv   { text-align:right; }
    .hdr-inv-label { font-size:22px; font-weight:900; letter-spacing:2px; }
    .hdr-inv-num   { font-size:13px; font-family:monospace; margin-top:2px; }
    .hdr-inv-date  { font-size:10px; color:#555; }

    /* ── Meta grid ── */
    .meta { display:flex; gap:40px; font-size:11px; margin-bottom:8px; border-bottom:1px solid #ccc; padding-bottom:6px; }
    .meta-block label { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.8px; color:#666; display:block; }
    .meta-block span  { font-weight:600; }

    /* ── Parties ── */
    .parties { display:flex; gap:0; border:1px solid #ccc; margin-bottom:8px; }
    .party { flex:1; padding:8px 12px; border-right:1px solid #ccc; font-size:11px; }
    .party:last-child { border-right:none; }
    .party-label { font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:1px; color:#666; margin-bottom:3px; }
    .party-name  { font-size:13px; font-weight:700; }

    /* ── Items table ── */
    .items-table th { background:#000; color:#fff; padding:5px 8px; text-align:left; }
    .items-table th.r { text-align:right; }
    .items-table th.c { text-align:center; }
    .items-table td   { vertical-align:top; }

    /* ── Totals ── */
    .totals { display:flex; justify-content:flex-end; margin-top:8px; }
    .totals-box { width:220px; font-size:12px; }
    .totals-row { display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px solid #eee; }
    .totals-grand { display:flex; justify-content:space-between; padding:5px 0; font-size:16px; font-weight:900; border-top:2px solid #000; margin-top:4px; }

    /* ── Payment ── */
    .payment-section { margin-top:10px; border-top:1px dashed #000; padding-top:8px; }

    /* ── Status stamp ── */
    .stamp {
      display:inline-block; border:3px solid #000;
      padding:3px 14px; font-size:13px; font-weight:900;
      letter-spacing:2px; text-transform:uppercase;
      transform:rotate(-5deg); margin-top:6px;
    }
    .stamp-paid { color:#1a7a1a; border-color:#1a7a1a; }
    .stamp-partial { color:#b45309; border-color:#b45309; }

    /* ── Footer ── */
    .footer { margin-top:12px; border-top:2px solid #000; padding-top:8px; font-size:10px; color:#555; display:flex; justify-content:space-between; }

    /* ── Signature lines ── */
    .sig-line { border-top:1px solid #000; width:160px; margin-top:30px; text-align:center; font-size:10px; padding-top:3px; }

    /* ── @page for print ── */
    @media print {
      @page {
        size: ${PAGE_W} ${PAGE_H};
        margin: 8mm 13mm;  /* 0.5" side margins for tractor holes */
      }
      body { padding:0; width:100%; }
    }
  </style>
</head>
<body>

  <!-- ═══ HEADER ══════════════════════════════════════════════════════════ -->
  <div class="hdr">
    <div>
      <div class="hdr-shop">${shopName}</div>
      ${settings.slogan ? `<div class="hdr-sub">${esc(settings.slogan)}</div>` : ''}
      ${settings.address ? `<div class="hdr-sub">${esc(settings.address)}</div>` : ''}
      ${settings.phone   ? `<div class="hdr-sub">Tel: ${esc(settings.phone)}</div>` : ''}
      ${settings.email   ? `<div class="hdr-sub">${esc(settings.email)}</div>` : ''}
    </div>
    <div class="hdr-inv">
      <div class="hdr-inv-label">INVOICE</div>
      <div class="hdr-inv-num mono">${esc(sale.invoiceNumber)}</div>
      <div class="hdr-inv-date">${dateStr} &bull; ${timeStr}</div>
      <div style="margin-top:8px;">
        <span class="stamp ${isPaid ? 'stamp-paid' : 'stamp-partial'}">${isPaid ? 'PAID' : 'PARTIAL'}</span>
      </div>
    </div>
  </div>

  <!-- ═══ META STRIP ══════════════════════════════════════════════════════ -->
  <div class="meta">
    <div class="meta-block"><label>Date</label><span>${dateStr}</span></div>
    <div class="meta-block"><label>Time</label><span>${timeStr}</span></div>
    <div class="meta-block"><label>Cashier</label><span>${esc(sale.cashierName || '—')}</span></div>
    <div class="meta-block"><label>Payment</label><span>${esc(sale.payments?.map(p => p.method).join(' + ') || sale.paymentMethod || '—')}</span></div>
  </div>

  <!-- ═══ BILL FROM / BILL TO ═════════════════════════════════════════════ -->
  <div class="parties">
    <div class="party">
      <div class="party-label">Bill From</div>
      <div class="party-name">${shopName}</div>
      ${settings.address ? `<div style="font-size:10px;color:#555;">${esc(settings.address)}</div>` : ''}
      ${settings.phone   ? `<div style="font-size:10px;color:#555;">${esc(settings.phone)}</div>` : ''}
    </div>
    <div class="party">
      <div class="party-label">Bill To</div>
      <div class="party-name">${esc(sale.customerName || 'Walk-in Customer')}</div>
      ${sale.customerPhone   ? `<div style="font-size:10px;color:#555;">${esc(sale.customerPhone)}</div>` : ''}
      ${sale.customerAddress ? `<div style="font-size:10px;color:#555;">${esc(sale.customerAddress)}</div>` : ''}
    </div>
  </div>

  <!-- ═══ ITEMS TABLE ══════════════════════════════════════════════════════ -->
  <table class="items-table" style="border:1px solid #ccc;">
    <thead>
      <tr>
        <th style="width:55%;padding:6px 8px;">Description</th>
        <th class="c" style="width:8%;padding:6px 8px;">Qty</th>
        <th class="r" style="width:18%;padding:6px 8px;">Unit Price</th>
        <th class="r" style="width:19%;padding:6px 8px;">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- ═══ TOTALS ══════════════════════════════════════════════════════════ -->
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Subtotal</span><span>${f(sale.subtotal)}</span></div>
      ${sale.discountAmount > 0 ? `<div class="totals-row" style="color:#c00;"><span>Discount</span><span>- ${f(sale.discountAmount)}</span></div>` : ''}
      <div class="totals-grand"><span>TOTAL</span><span>${f(sale.total)}</span></div>
      ${sale.dueAmount && sale.dueAmount > 0 ? `<div class="totals-row" style="color:#b45309;font-weight:700;"><span>Outstanding</span><span>${f(sale.dueAmount)}</span></div>` : ''}
    </div>
  </div>

  <!-- ═══ PAYMENT INFO ═════════════════════════════════════════════════════ -->
  ${payRows ? `
  <div class="payment-section">
    <b style="font-size:11px;text-transform:uppercase;letter-spacing:.8px;">Payment Details</b>
    <table style="width:auto;margin-top:4px;">${payRows}</table>
    ${sale.cashReceived && sale.cashReceived > 0 ? `
      <div style="display:flex;justify-content:space-between;width:180px;margin-top:4px;font-size:11px;">
        <span>Cash Received:</span><span>${f(sale.cashReceived)}</span>
      </div>` : ''}
    ${sale.changeAmount && sale.changeAmount > 0 ? `
      <div style="display:flex;justify-content:space-between;width:180px;font-size:11px;font-weight:700;">
        <span>Change:</span><span>${f(sale.changeAmount)}</span>
      </div>` : ''}
  </div>` : ''}

  <!-- ═══ WARRANTY ════════════════════════════════════════════════════════ -->
  ${warrantyHtml}

  <!-- ═══ BANK DETAILS ════════════════════════════════════════════════════ -->
  ${(settings.bankName || settings.accNumber) ? `
  <div style="margin-top:12px;font-size:10px;color:#555;border-top:1px dashed #000;padding-top:8px;">
    ${settings.bankName  ? `<div>Bank: ${esc(settings.bankName)}</div>` : ''}
    ${settings.accNumber ? `<div>A/C: ${esc(settings.accNumber)}</div>` : ''}
    ${settings.accHolder ? `<div>Name: ${esc(settings.accHolder)}</div>` : ''}
  </div>` : ''}

  <!-- ═══ SIGNATURE LINES ══════════════════════════════════════════════════ -->
  <div style="display:flex;justify-content:space-between;margin-top:20px;">
    <div class="sig-line">Customer Signature</div>
    <div class="sig-line">${esc(settings.signatoryName || 'Authorized Signatory')}</div>
  </div>

  <!-- ═══ FOOTER ══════════════════════════════════════════════════════════ -->
  <div class="footer">
    <span>${esc(settings.footerNote || 'Thank you for your business!')}</span>
    <span>${settings.website ? esc(settings.website) : ''}</span>
  </div>

</body>
</html>`

  const win = window.open('', '_blank', `width=960,height=740`)
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
