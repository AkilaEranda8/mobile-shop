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

/** Max copies of a single label per print job (manual quantity input). */
export const MAX_LABEL_COPIES = 500

/** Clamp a user-typed copies value to a safe printable range. */
export function clampLabelCopies(raw: number | string): number {
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(n, MAX_LABEL_COPIES)
}

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

/** Reject symbology labels accidentally saved as barcode (e.g. "Code 128 (C128)"). */
export function isUsableBarcodeValue(value: string): boolean {
  const v = value.trim()
  if (!v) return false
  if (/^(code\s*128|code\s*39|ean-?13|ean-?8|upc-?a|qr\s*code)\b/i.test(v)) return false
  if (/\(\s*c128\s*\)|\(\s*c39\s*\)/i.test(v)) return false
  return true
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
  if (!value?.trim() || !isUsableBarcodeValue(value)) return ''
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  try {
    JsBarcode(svg, value.trim(), {
      format: 'CODE128',
      width: opts?.width ?? DEFAULT_BARCODE_LABEL_SETTINGS.barcodeBarWidth,
      height: opts?.height ?? DEFAULT_BARCODE_LABEL_SETTINGS.barcodeHeight,
      displayValue: opts?.displayValue !== false,
      fontSize: opts?.fontSize ?? 7,
      textMargin: 0,
      margin: 0,
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 2,
      marginRight: 2,
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
  const hasTop =
    (settings.showShopName && !!shopName?.trim()) ||
    settings.showProductName ||
    (settings.showSku && !!item.sku)
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
      ? `<p class="sku">${escapeHtml(item.sku)}</p>`
      : ''
  const digitsPt = barcodeDigitsFontPt(item.barcode, dense)
  const digits = settings.showBarcodeText
    ? `<p class="digits" style="font-size:${digitsPt}pt">${escapeHtml(item.barcode.trim())}</p>`
    : ''
  const price =
    settings.showPrice && item.price != null
      ? `<div class="footer"><p class="price">${escapeHtml(formatCurrency(item.price))}</p></div>`
      : '<div class="footer footer-empty"></div>'

  return `
    <div class="label${hasTop ? '' : ' label-minimal'}">
      ${hasTop ? `<div class="top">${shop}${name}${sku}</div>` : ''}
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
  const copies = Math.max(1, Math.min(item.qty ?? 1, MAX_LABEL_COPIES))
  return Array.from({ length: copies }, (_, i) =>
    singleLabelHtml(item, i + 1, copies, settings, shopName, dense),
  ).join('')
}

export function printBarcodeLabels(
  items: BarcodeLabelItem[],
  options?: BarcodePrintOptions,
) {
  const valid = items.filter(i => i.barcode?.trim() && isUsableBarcodeValue(i.barcode))
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
  const minimal =
    !settings.showShopName &&
    !settings.showProductName &&
    !settings.showSku &&
    settings.showBarcodeText &&
    settings.showPrice
  // Keep bars short enough that digits + price never collide on 50×30 dense labels
  const svgMaxH = Math.max(
    5.5,
    Math.min(hMm * (dense ? 0.18 : minimal ? 0.38 : 0.28), dense ? 5.8 : minimal ? 11 : 8.2),
  )
  // Soft-cap by label height so XL still fits; keep print text compact
  const pricePt = Math.max(6, Math.min(settings.priceFontPt, hMm * 0.42, dense ? 10 : 12))
  const namePt = Math.min(settings.nameFontPt, dense ? 5.2 : 5.8)
  const labelCount = valid.reduce((sum, item) => sum + Math.max(1, Math.min(item.qty ?? 1, MAX_LABEL_COPIES)), 0)
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
    padding: ${minimal ? '1.4mm 2mm 1.2mm' : '1.2mm 1.8mm 1.1mm'};
    page-break-after: always;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: ${minimal ? 'center' : 'flex-start'};
    text-align: center;
    overflow: hidden;
    background: #fff;
    ${previewFirst ? `border: 1px solid #cbd5e1; border-radius: 4px; box-shadow: 0 6px 18px rgba(15,23,42,0.1);` : ''}
  }
  .top, .mid {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: ${dense ? '0.35mm' : '0.55mm'};
    flex-shrink: 0;
  }
  .top {
    padding-bottom: 0.55mm;
    margin-bottom: 0.45mm;
    border-bottom: 0.18mm solid #d4d4d4;
  }
  .mid {
    flex: 1 1 auto;
    justify-content: center;
    min-height: 0;
    overflow: hidden;
    gap: ${minimal ? '0.9mm' : '0.55mm'};
    padding: ${minimal ? '0.4mm 0' : '0.35mm 0'};
  }
  .shop {
    font-size: ${dense ? 3.6 : 4}pt;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #525252;
    line-height: 1.2;
    max-width: 100%;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    word-break: break-word;
  }
  .name {
    font-size: ${namePt}pt;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: #0a0a0a;
    line-height: 1.15;
    max-width: 100%;
    word-break: break-word;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: ${settings.nameMaxLines};
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .sku {
    font-size: ${dense ? 3.5 : 3.9}pt;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #737373;
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
    font-weight: 600;
    font-family: "Segoe UI", Arial, Helvetica, sans-serif;
    letter-spacing: 0.12em;
    color: #171717;
    line-height: 1.2;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
    padding: 0 0.3mm;
  }
  .footer {
    width: 100%;
    flex-shrink: 0;
    margin-top: ${minimal ? '1mm' : '0.55mm'};
    padding-top: ${minimal ? '0.85mm' : '0.65mm'};
    border-top: 0.2mm solid #a3a3a3;
  }
  .footer-empty {
    border-top: 0;
    padding-top: 0;
    height: 0.4mm;
  }
  .price {
    font-size: ${pricePt}pt;
    font-weight: 800;
    letter-spacing: 0.01em;
    color: #0a0a0a;
    line-height: 1.1;
    padding-bottom: ${settings.showCopyIndex ? '1.1mm' : '0'};
  }
  .seq {
    position: absolute;
    right: 1mm;
    bottom: 0.55mm;
    font-size: 3.5pt;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: #737373;
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
  const barcode = product.barcode?.trim()
  if (barcode && isUsableBarcodeValue(barcode)) return barcode
  const sku = product.sku?.trim()
  if (sku && isUsableBarcodeValue(sku)) return sku
  return null
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
