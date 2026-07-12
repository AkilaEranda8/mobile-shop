import JsBarcode from 'jsbarcode'
import { formatCurrency } from './utils'

export type BarcodeLabelItem = {
  barcode: string
  name: string
  sku?: string
  price?: number
  qty?: number
}

export function renderBarcodeSvg(value: string, opts?: { height?: number; width?: number }): string {
  if (!value?.trim()) return ''
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  try {
    JsBarcode(svg, value.trim(), {
      format: 'CODE128',
      width: opts?.width ?? 1.8,
      height: opts?.height ?? 44,
      displayValue: true,
      fontSize: 11,
      margin: 6,
      background: '#ffffff',
      lineColor: '#000000',
    })
    return svg.outerHTML
  } catch {
    return ''
  }
}

function labelHtml(item: BarcodeLabelItem): string {
  const svg = renderBarcodeSvg(item.barcode)
  const copies = Math.max(1, Math.min(item.qty ?? 1, 99))
  const blocks = Array.from({ length: copies }, () => `
    <div class="label">
      <p class="name">${escapeHtml(item.name)}</p>
      ${item.sku ? `<p class="sku">SKU: ${escapeHtml(item.sku)}</p>` : ''}
      <div class="barcode">${svg}</div>
      ${item.price != null ? `<p class="price">${escapeHtml(formatCurrency(item.price))}</p>` : ''}
    </div>
  `).join('')
  return blocks
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function printBarcodeLabels(items: BarcodeLabelItem[]) {
  const valid = items.filter(i => i.barcode?.trim())
  if (!valid.length) return

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Barcode Labels</title>
<style>
  @page { size: 50mm 30mm; margin: 2mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; }
  .label {
    width: 46mm; min-height: 26mm; padding: 2mm;
    page-break-after: always;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center;
  }
  .name { font-size: 7pt; font-weight: 700; line-height: 1.2; max-height: 2.4em; overflow: hidden; }
  .sku { font-size: 6pt; color: #444; margin-top: 1mm; }
  .barcode { margin: 1mm 0; }
  .barcode svg { max-width: 100%; height: auto; }
  .price { font-size: 7pt; font-weight: 600; margin-top: 1mm; }
  @media print { .label:last-child { page-break-after: auto; } }
</style></head><body>
${valid.map(labelHtml).join('')}
<script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); };</script>
</body></html>`

  const w = window.open('', '_blank', 'width=480,height=640')
  if (!w) return
  w.document.write(html)
  w.document.close()
}

export function toBarcodeLabelItem(product: {
  name: string
  barcode?: string | null
  sku?: string
  sellingPrice?: number
  stock?: number
}, qty?: number): BarcodeLabelItem | null {
  const barcode = product.barcode?.trim()
  if (!barcode) return null
  return {
    barcode,
    name: product.name,
    sku: product.sku,
    price: product.sellingPrice,
    qty: qty ?? product.stock ?? 1,
  }
}
