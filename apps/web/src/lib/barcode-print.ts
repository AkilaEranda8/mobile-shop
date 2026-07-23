import JsBarcode from 'jsbarcode'
import { formatCurrency } from './utils'
import {
  DEFAULT_BARCODE_LABEL_SETTINGS,
  resolveBarcodeLabelSettings,
  type BarcodeLabelSettings,
} from './invoiceSettings'

export type BarcodeLabelItem = {
  barcode: string
  name: string
  sku?: string
  price?: number
  qty?: number
}

/** Thermal sticker size used for shelf barcode labels (default preset). */
export const BARCODE_LABEL_WIDTH_MM = DEFAULT_BARCODE_LABEL_SETTINGS.widthMm
export const BARCODE_LABEL_HEIGHT_MM = DEFAULT_BARCODE_LABEL_SETTINGS.heightMm

export type BarcodePrintOptions = {
  settings?: Partial<BarcodeLabelSettings> | BarcodeLabelSettings | null
  shopName?: string
  /** When true (default), open a preview window first — user clicks Print. When false, print immediately. */
  preview?: boolean
  /**
   * Pre-opened window (open synchronously from a click handler before any await).
   * Needed so browsers do not block the popup after async API calls.
   */
  targetWindow?: Window | null
}

export function resolvePrintBarcodeLabelSettings(
  settings?: Partial<BarcodeLabelSettings> | BarcodeLabelSettings | null,
): BarcodeLabelSettings {
  return resolveBarcodeLabelSettings({ barcodeLabel: settings as BarcodeLabelSettings })
}

/** Scale barcode digit type so long codes stay fully readable (no ellipsis). */
export function barcodeDigitsFontPt(value: string, dense: boolean): number {
  const len = value.trim().length
  if (len >= 20) return dense ? 3.8 : 4.2
  if (len >= 16) return dense ? 4.2 : 4.6
  if (len >= 13) return dense ? 4.6 : 5.1
  return dense ? 5.2 : 5.6
}

export function renderBarcodeSvg(
  value: string,
  opts?: {
    height?: number
    width?: number
    displayValue?: boolean
    fontSize?: number
  },
): string {
  if (!value?.trim()) return ''
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  try {
    JsBarcode(svg, value.trim(), {
      format: 'CODE128',
      width: opts?.width ?? DEFAULT_BARCODE_LABEL_SETTINGS.barcodeBarWidth,
      height: opts?.height ?? DEFAULT_BARCODE_LABEL_SETTINGS.barcodeHeight,
      displayValue: opts?.displayValue !== false,
      fontSize: opts?.fontSize ?? 7,
      textMargin: 0,
      margin: 1,
      background: '#ffffff',
      lineColor: '#000000',
    })
    return svg.outerHTML
  } catch {
    return ''
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function singleLabelHtml(
  item: BarcodeLabelItem,
  copyIndex: number,
  copyTotal: number,
  settings: BarcodeLabelSettings,
  shopName?: string,
  dense = false,
): string {
  // Bars only — digits rendered as separate row under barcode
  const svg = renderBarcodeSvg(item.barcode, {
    height: settings.barcodeHeight,
    width: settings.barcodeBarWidth,
    displayValue: false,
  })
  const seq =
    settings.showCopyIndex && copyTotal > 1
      ? `<span class="seq">${copyIndex}/${copyTotal}</span>`
      : ''
  const shop =
    settings.showShopName && shopName?.trim()
      ? `<p class="shop">${escapeHtml(shopName.trim())}</p>`
      : ''
  const name = settings.showProductName
    ? `<p class="name">${escapeHtml(item.name)}</p>`
    : ''
  const sku =
    settings.showSku && item.sku
      ? `<span class="sku">${escapeHtml(item.sku)}</span>`
      : ''
  const meta = sku ? `<div class="meta">${sku}</div>` : ''
  const digitsPt = barcodeDigitsFontPt(item.barcode, dense)
  const digits = settings.showBarcodeText
    ? `<p class="digits" style="font-size:${digitsPt}pt">${escapeHtml(item.barcode.trim())}</p>`
    : ''
  const price =
    settings.showPrice && item.price != null
      ? `<div class="footer"><p class="price">${escapeHtml(formatCurrency(item.price))}</p></div>`
      : '<div class="footer footer-empty"></div>'

  return `
    <div class="label">
      <div class="accent"></div>
      <div class="top">
        ${shop}
        ${name}
        ${meta}
      </div>
      <div class="mid">
        <div class="barcode">${svg}</div>
        ${digits}
      </div>
      ${price}
      ${seq}
    </div>
  `
}

function labelHtml(
  item: BarcodeLabelItem,
  settings: BarcodeLabelSettings,
  shopName?: string,
  dense = false,
): string {
  const copies = Math.max(1, Math.min(item.qty ?? 1, 99))
  return Array.from({ length: copies }, (_, i) =>
    singleLabelHtml(item, i + 1, copies, settings, shopName, dense),
  ).join('')
}

export function printBarcodeLabels(
  items: BarcodeLabelItem[],
  options?: BarcodePrintOptions,
) {
  const valid = items.filter(i => i.barcode?.trim())
  if (!valid.length) return false

  const settings = resolvePrintBarcodeLabelSettings(options?.settings)
  const previewFirst = options?.preview !== false
  const wMm = settings.widthMm
  const hMm = settings.heightMm
  const dense =
    settings.showShopName &&
    settings.showProductName &&
    settings.showSku &&
    settings.showBarcodeText &&
    settings.showPrice
  // Keep bars short enough that digits + price never collide on 50×30 dense labels
  const svgMaxH = Math.max(5, Math.min(hMm * (dense ? 0.18 : 0.24), dense ? 5.8 : 7.4))
  const pricePt = Math.min(dense ? 7.2 : 8.5, Math.max(settings.nameFontPt + 1.2, 6.5))
  const namePt = Math.min(settings.nameFontPt, dense ? 5.6 : 6.4)
  const labelCount = valid.reduce((sum, item) => sum + Math.max(1, Math.min(item.qty ?? 1, 99)), 0)
  const labelsBody = valid.map(item => labelHtml(item, settings, options?.shopName, dense)).join('')

  const toolbar = previewFirst
    ? `<div class="toolbar no-print">
        <div class="toolbar-left">
          <strong>Barcode preview</strong>
          <span>${labelCount} label${labelCount === 1 ? '' : 's'} · ${wMm}×${hMm}mm</span>
        </div>
        <div class="toolbar-actions">
          <button type="button" class="btn-close" onclick="window.close()">Close</button>
          <button type="button" class="btn-print" onclick="window.print()">Print</button>
        </div>
      </div>`
    : ''

  const bootScript = previewFirst
    ? ''
    : `<script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); };</script>`

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Barcode Labels Preview</title>
<style>
  @page { size: ${wMm}mm ${hMm}mm; margin: 0.35mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Segoe UI", Arial, Helvetica, sans-serif;
    color: #0a0a0a;
    background: ${previewFirst ? '#e2e8f0' : '#fff'};
  }
  .toolbar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding: 12px 16px;
    background: #0f172a;
    color: #f8fafc;
    box-shadow: 0 2px 12px rgba(15,23,42,0.25);
  }
  .toolbar-left {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 12px;
  }
  .toolbar-left strong { font-size: 14px; }
  .toolbar-left span { color: #94a3b8; }
  .toolbar-actions { display: flex; gap: 8px; }
  .toolbar button {
    border: 0;
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }
  .btn-print { background: #0f172a; color: #fff; border: 1px solid #38bdf8; }
  .btn-print:hover { background: #1e293b; }
  .btn-close { background: #334155; color: #e2e8f0; }
  .btn-close:hover { background: #475569; }
  .preview-wrap {
    padding: ${previewFirst ? '24px 16px 36px' : '0'};
    display: ${previewFirst ? 'flex' : 'block'};
    flex-wrap: wrap;
    justify-content: center;
    gap: 16px;
  }
  .label {
    width: ${wMm - 1.2}mm;
    height: ${hMm - 1.2}mm;
    padding: 0 1.5mm 1mm;
    page-break-after: always;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    text-align: center;
    overflow: hidden;
    background: #fff;
    ${previewFirst ? `border: 1px solid #94a3b8; border-radius: 3px; box-shadow: 0 8px 24px rgba(15,23,42,0.12);` : ''}
  }
  .accent {
    height: 0.55mm;
    width: 100%;
    background: #000;
    flex-shrink: 0;
    margin-bottom: 0.7mm;
  }
  .top, .mid {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25mm;
    flex-shrink: 0;
  }
  .mid {
    flex: 1 1 auto;
    justify-content: center;
    min-height: 0;
    overflow: hidden;
    gap: 0.35mm;
    padding: 0.2mm 0;
  }
  .shop {
    font-size: ${dense ? 3.6 : 4}pt;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #333;
    line-height: 1.1;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .name {
    font-size: ${namePt}pt;
    font-weight: 800;
    letter-spacing: -0.015em;
    color: #000;
    line-height: 1.12;
    max-width: 100%;
    word-break: break-word;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: ${settings.nameMaxLines};
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .meta {
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    margin-top: 0.1mm;
  }
  .sku {
    font-size: ${dense ? 3.5 : 3.8}pt;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #555;
    line-height: 1.1;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .barcode {
    width: 100%;
    height: ${svgMaxH}mm;
    max-height: ${svgMaxH}mm;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    line-height: 0;
    overflow: hidden;
    flex-shrink: 0;
  }
  .barcode svg {
    display: block;
    width: 100%;
    max-width: 100%;
    height: ${svgMaxH}mm !important;
    max-height: ${svgMaxH}mm !important;
  }
  .digits {
    font-weight: 700;
    font-family: "Consolas", "Courier New", Courier, monospace;
    letter-spacing: 0.04em;
    color: #111;
    line-height: 1.15;
    max-width: 100%;
    white-space: normal;
    word-break: break-all;
    overflow-wrap: anywhere;
    overflow: visible;
    text-overflow: clip;
    flex-shrink: 0;
    padding: 0 0.2mm;
  }
  .footer {
    width: 100%;
    flex-shrink: 0;
    margin-top: 0.35mm;
    padding-top: 0.55mm;
    border-top: 0.35mm solid #000;
  }
  .footer-empty {
    border-top: 0;
    padding-top: 0;
    height: 0.4mm;
  }
  .price {
    font-size: ${pricePt}pt;
    font-weight: 900;
    letter-spacing: -0.02em;
    color: #000;
    line-height: 1.05;
    padding-bottom: ${settings.showCopyIndex ? '1.1mm' : '0'};
  }
  .seq {
    position: absolute;
    right: 0.9mm;
    bottom: 0.45mm;
    font-size: 3.6pt;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: #444;
    line-height: 1;
  }
  @media print {
    .no-print { display: none !important; }
    body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .preview-wrap { padding: 0 !important; display: block !important; gap: 0 !important; }
    .label {
      border: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
    }
    .label:last-child { page-break-after: auto; }
  }
</style></head><body>
${toolbar}
<div class="preview-wrap">
${labelsBody}
</div>
${bootScript}
</body></html>`

  const w = options?.targetWindow ?? window.open('', '_blank', 'width=720,height=780')
  if (!w || w.closed) return false
  try {
    w.document.open()
    w.document.write(html)
    w.document.close()
    w.focus()
    return true
  } catch {
    try { w.close() } catch { /* ignore */ }
    return false
  }
}

export function effectiveBarcodeValue(product: {
  barcode?: string | null
  sku?: string
}): string | null {
  const code = product.barcode?.trim() || product.sku?.trim()
  return code || null
}

export function toBarcodeLabelItem(product: {
  name: string
  barcode?: string | null
  sku?: string
  sellingPrice?: number
  stock?: number
}, qty?: number): BarcodeLabelItem | null {
  const barcode = effectiveBarcodeValue(product)
  if (!barcode) return null
  const copies = qty ?? product.stock ?? 1
  return {
    barcode,
    name: product.name,
    sku: product.sku,
    price: product.sellingPrice,
    qty: Math.max(1, copies),
  }
}

export type BuildBarcodeLabelsOptions = {
  /** When true, print one label per unit in stock (default). When false, one label each. */
  qtyFromStock?: boolean
  /** Skip IMEI-tracked devices in bulk jobs (shelf labels use product barcode; units use IMEI). */
  skipTrackImei?: boolean
  /** Max labels per product (default 99). */
  maxPerProduct?: number
}

export function buildBarcodeLabelsFromProducts(
  products: Array<{
    name: string
    barcode?: string | null
    sku?: string
    sellingPrice?: number
    stock?: number
    trackImei?: boolean
  }>,
  opts: BuildBarcodeLabelsOptions = {},
): { labels: BarcodeLabelItem[]; skipped: number; totalLabels: number } {
  const qtyFromStock = opts.qtyFromStock !== false
  const skipTrackImei = opts.skipTrackImei !== false
  const maxPerProduct = opts.maxPerProduct ?? 99
  const labels: BarcodeLabelItem[] = []
  let skipped = 0

  for (const p of products) {
    if (skipTrackImei && p.trackImei) { skipped++; continue }
    const stock = Math.max(0, p.stock ?? 0)
    if (qtyFromStock && stock === 0) { skipped++; continue }
    const label = toBarcodeLabelItem(p, qtyFromStock ? stock : 1)
    if (!label) { skipped++; continue }
    label.qty = Math.min(label.qty ?? 1, maxPerProduct)
    labels.push(label)
  }

  const totalLabels = labels.reduce((s, l) => s + (l.qty ?? 1), 0)
  return { labels, skipped, totalLabels }
}

export function printBarcodeLabelsForProducts(
  products: Parameters<typeof buildBarcodeLabelsFromProducts>[0],
  opts?: BuildBarcodeLabelsOptions & BarcodePrintOptions,
): { ok: boolean; totalLabels: number; skipped: number; productCount: number } {
  const { labels, skipped, totalLabels } = buildBarcodeLabelsFromProducts(products, opts)
  if (!labels.length) return { ok: false, totalLabels: 0, skipped, productCount: 0 }
  printBarcodeLabels(labels, { settings: opts?.settings, shopName: opts?.shopName })
  return { ok: true, totalLabels, skipped, productCount: labels.length }
}
