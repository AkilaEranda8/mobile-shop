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
}

export function resolvePrintBarcodeLabelSettings(
  settings?: Partial<BarcodeLabelSettings> | BarcodeLabelSettings | null,
): BarcodeLabelSettings {
  return resolveBarcodeLabelSettings({ barcodeLabel: settings as BarcodeLabelSettings })
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
): string {
  // Bars only — digits rendered as separate row under barcode (reference layout)
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
      ? `<p class="sku">${escapeHtml(item.sku)}</p>`
      : ''
  const digits = settings.showBarcodeText
    ? `<p class="digits">${escapeHtml(item.barcode.trim())}</p>`
    : ''
  const price =
    settings.showPrice && item.price != null
      ? `<p class="price">${escapeHtml(formatCurrency(item.price))}</p>`
      : ''

  // Order matches sticker sheet: shop → name → code → barcode → digits → price
  return `
    <div class="label">
      ${shop}
      ${name}
      ${sku}
      <div class="barcode">${svg}</div>
      ${digits}
      ${price}
      ${seq}
    </div>
  `
}

function labelHtml(
  item: BarcodeLabelItem,
  settings: BarcodeLabelSettings,
  shopName?: string,
): string {
  const copies = Math.max(1, Math.min(item.qty ?? 1, 99))
  return Array.from({ length: copies }, (_, i) =>
    singleLabelHtml(item, i + 1, copies, settings, shopName),
  ).join('')
}

export function printBarcodeLabels(
  items: BarcodeLabelItem[],
  options?: BarcodePrintOptions,
) {
  const valid = items.filter(i => i.barcode?.trim())
  if (!valid.length) return

  const settings = resolvePrintBarcodeLabelSettings(options?.settings)
  const previewFirst = options?.preview !== false
  const wMm = settings.widthMm
  const hMm = settings.heightMm
  const svgMaxH = Math.max(6, Math.min(hMm * 0.38, settings.barcodeHeight * 0.38))
  const pricePt = Math.max(settings.nameFontPt + 1.5, 7)
  const labelCount = valid.reduce((sum, item) => sum + Math.max(1, Math.min(item.qty ?? 1, 99)), 0)
  const labelsBody = valid.map(item => labelHtml(item, settings, options?.shopName)).join('')

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
  @page { size: ${wMm}mm ${hMm}mm; margin: 0.5mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #000;
    background: ${previewFirst ? '#e8edf3' : '#fff'};
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
  .btn-print { background: #7c3aed; color: #fff; }
  .btn-print:hover { background: #6d28d9; }
  .btn-close { background: #334155; color: #e2e8f0; }
  .btn-close:hover { background: #475569; }
  .preview-wrap {
    padding: ${previewFirst ? '20px 16px 32px' : '0'};
    display: ${previewFirst ? 'flex' : 'block'};
    flex-wrap: wrap;
    justify-content: center;
    gap: 14px;
  }
  .label {
    width: ${wMm - 2}mm;
    height: ${hMm - 2}mm;
    padding: 1mm 1.4mm 1.2mm;
    page-break-after: always;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    text-align: center;
    overflow: hidden;
    background: #fff;
    ${previewFirst ? `border: 1px solid #cbd5e1; border-radius: 2px; box-shadow: 0 4px 14px rgba(15,23,42,0.08);` : ''}
  }
  .shop {
    font-size: 4.5pt;
    font-weight: 500;
    color: #666;
    line-height: 1.15;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 0.4mm;
  }
  .name {
    font-size: ${settings.nameFontPt}pt;
    font-weight: 700;
    color: #111;
    line-height: 1.15;
    max-width: 100%;
    word-break: break-word;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: ${settings.nameMaxLines};
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin-bottom: 0.3mm;
  }
  .sku {
    font-size: 4.5pt;
    font-weight: 500;
    color: #777;
    line-height: 1.1;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 0.5mm;
  }
  .barcode {
    flex-shrink: 0;
    width: 100%;
    text-align: center;
    line-height: 0;
    margin: 0.2mm 0 0.4mm;
  }
  .barcode svg {
    max-width: 100%;
    height: auto;
    max-height: ${svgMaxH}mm;
  }
  .digits {
    font-size: 5.5pt;
    font-weight: 600;
    font-family: "Courier New", Courier, monospace;
    letter-spacing: 0.02em;
    color: #111;
    line-height: 1.1;
    margin-bottom: 0.5mm;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .price {
    font-size: ${pricePt}pt;
    font-weight: 800;
    color: #000;
    line-height: 1.1;
    margin-top: auto;
    padding-top: 0.4mm;
  }
  .seq {
    position: absolute;
    right: 1mm;
    bottom: 0.5mm;
    font-size: 4.5pt;
    font-weight: 600;
    color: #555;
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

  const w = window.open('', '_blank', 'width=720,height=780')
  if (!w) return
  w.document.write(html)
  w.document.close()
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
