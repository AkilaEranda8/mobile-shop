import JsBarcode from 'jsbarcode'
import { formatCurrency } from './utils'

export type BarcodeLabelItem = {
  barcode: string
  name: string
  sku?: string
  price?: number
  qty?: number
}

/** Thermal sticker size used for shelf barcode labels. */
export const BARCODE_LABEL_WIDTH_MM = 38
export const BARCODE_LABEL_HEIGHT_MM = 25

export function renderBarcodeSvg(value: string, opts?: { height?: number; width?: number }): string {
  if (!value?.trim()) return ''
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  try {
    JsBarcode(svg, value.trim(), {
      format: 'CODE128',
      width: opts?.width ?? 1.1,
      height: opts?.height ?? 24,
      displayValue: true,
      fontSize: 7,
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

function singleLabelHtml(item: BarcodeLabelItem, copyIndex: number, copyTotal: number): string {
  const svg = renderBarcodeSvg(item.barcode)
  const seq = copyTotal > 1
    ? `<span class="seq">${copyIndex}/${copyTotal}</span>`
    : ''

  return `
    <div class="label">
      <div class="barcode">${svg}</div>
      <p class="name">${escapeHtml(item.name)}</p>
      ${item.sku ? `<p class="sku">SKU: ${escapeHtml(item.sku)}</p>` : ''}
      ${item.price != null ? `<p class="price">${escapeHtml(formatCurrency(item.price))}</p>` : ''}
      ${seq}
    </div>
  `
}

function labelHtml(item: BarcodeLabelItem): string {
  const copies = Math.max(1, Math.min(item.qty ?? 1, 99))
  return Array.from({ length: copies }, (_, i) => singleLabelHtml(item, i + 1, copies)).join('')
}

export function printBarcodeLabels(items: BarcodeLabelItem[]) {
  const valid = items.filter(i => i.barcode?.trim())
  if (!valid.length) return

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Barcode Labels</title>
<style>
  @page { size: ${BARCODE_LABEL_WIDTH_MM}mm ${BARCODE_LABEL_HEIGHT_MM}mm; margin: 0.5mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; }
  .label {
    width: ${BARCODE_LABEL_WIDTH_MM - 2}mm;
    height: ${BARCODE_LABEL_HEIGHT_MM - 2}mm;
    padding: 0.8mm 1.2mm 1.4mm;
    page-break-after: always;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    overflow: hidden;
  }
  .barcode {
    flex-shrink: 0;
    text-align: center;
    line-height: 0;
    margin-bottom: 0.5mm;
  }
  .barcode svg {
    max-width: 100%;
    height: auto;
    max-height: 8mm;
  }
  .name {
    font-size: 5.5pt;
    font-weight: 700;
    line-height: 1.1;
    word-break: break-word;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .sku {
    font-size: 5pt;
    font-weight: 600;
    margin-top: 0.4mm;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .price {
    font-size: 5pt;
    font-weight: 600;
    margin-top: 0.2mm;
  }
  .seq {
    position: absolute;
    right: 1.2mm;
    bottom: 0.6mm;
    font-size: 5pt;
    font-weight: 600;
    color: #222;
  }
  @media print {
    .label:last-child { page-break-after: auto; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style></head><body>
${valid.map(labelHtml).join('')}
<script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); };</script>
</body></html>`

  const w = window.open('', '_blank', 'width=480,height=640')
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
  opts?: BuildBarcodeLabelsOptions,
): { ok: boolean; totalLabels: number; skipped: number; productCount: number } {
  const { labels, skipped, totalLabels } = buildBarcodeLabelsFromProducts(products, opts)
  if (!labels.length) return { ok: false, totalLabels: 0, skipped, productCount: 0 }
  printBarcodeLabels(labels)
  return { ok: true, totalLabels, skipped, productCount: labels.length }
}
