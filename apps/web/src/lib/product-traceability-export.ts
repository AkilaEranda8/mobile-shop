import * as XLSX from 'xlsx'

type TraceabilityExportPayload = {
  productName: string
  sku: string
  generatedAt: string
  analytics: Record<string, number>
  purchases: Record<string, unknown>[]
  sales: Record<string, unknown>[]
  movements: Record<string, unknown>[]
  serials: Record<string, unknown>[]
  timeline: Record<string, unknown>[]
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function safeName(name: string) {
  return name.replace(/[^\w\-]+/g, '_').slice(0, 60)
}

export function exportTraceabilityExcel(payload: TraceabilityExportPayload) {
  const wb = XLSX.utils.book_new()

  const summaryRows = [
    ['Product Traceability Report'],
    ['Product', payload.productName],
    ['SKU', payload.sku],
    ['Generated', payload.generatedAt],
    [],
    ['Metric', 'Value'],
    ...Object.entries(payload.analytics).map(([k, v]) => [k, v]),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary')

  if (payload.purchases.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(payload.purchases), 'Purchases')
  }
  if (payload.sales.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(payload.sales), 'Sales')
  }
  if (payload.movements.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(payload.movements), 'Movements')
  }
  if (payload.serials.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(payload.serials), 'Serials')
  }
  if (payload.timeline.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(payload.timeline), 'Timeline')
  }

  XLSX.writeFile(wb, `product-traceability-${safeName(payload.sku)}.xlsx`)
}

export function exportTraceabilityPdf(payload: TraceabilityExportPayload) {
  const analyticsHtml = Object.entries(payload.analytics)
    .map(([k, v]) => `<tr><td>${k}</td><td>${typeof v === 'number' ? v.toLocaleString('en-LK') : v}</td></tr>`)
    .join('')

  const section = (title: string, headers: string[], rows: Record<string, unknown>[]) => {
    if (!rows.length) return `<h2>${title}</h2><p>No records</p>`
    const cols = headers.length ? headers : Object.keys(rows[0])
    return `
      <h2>${title}</h2>
      <table>
        <thead><tr>${cols.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map(r => `<tr>${cols.map(h => `<td>${String(r[h] ?? '—')}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>`
  }

  const html = `<!DOCTYPE html><html><head><title>Product Traceability — ${payload.productName}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #111; font-size: 11px; }
      h1 { font-size: 18px; margin: 0 0 4px; }
      h2 { font-size: 13px; margin: 20px 0 8px; color: #4338ca; }
      .meta { color: #555; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
      th, td { border: 1px solid #ddd; padding: 5px 6px; text-align: left; }
      th { background: #6366f1; color: white; }
      tr:nth-child(even) { background: #f8f9fa; }
    </style></head><body>
    <h1>Product Traceability</h1>
    <div class="meta">${payload.productName} · SKU ${payload.sku} · ${payload.generatedAt}</div>
    <h2>Analytics</h2>
    <table><tbody>${analyticsHtml}</tbody></table>
    ${section('Purchase History', ['purchaseOrderNo', 'supplierName', 'purchaseDate', 'quantityPurchased', 'unitCost', 'totalCost', 'status'], payload.purchases)}
    ${section('Customer Purchase History', ['invoiceNumber', 'customerName', 'invoiceDate', 'quantityPurchased', 'sellingPrice', 'invoiceTotal', 'paymentStatus'], payload.sales)}
    ${section('Inventory Movement', ['dateTime', 'transactionType', 'referenceNumber', 'stockIn', 'stockOut', 'runningBalance', 'performedBy'], payload.movements)}
    ${section('Serial / IMEI', ['serialImei', 'currentStatus', 'salesInvoiceNo', 'customerName', 'warrantyStatus'], payload.serials)}
    ${section('Timeline', ['dateTime', 'title', 'subtitle', 'transactionType'], payload.timeline)}
    </body></html>`

  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  w.print()
}

export function printTraceabilityReport(payload: TraceabilityExportPayload) {
  exportTraceabilityPdf(payload)
}

export type { TraceabilityExportPayload }
