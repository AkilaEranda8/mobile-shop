/** Parse fault / service detail stored on repair sale notes. */
export function extractRepairFaultFromSale(sale: { notes?: string }): string | undefined {
  if (!sale.notes) return undefined
  const m = sale.notes.match(/\|\s*Fault:\s*(.+)$/i)
  return m?.[1]?.trim() || undefined
}

/** Map a sale line item to invoice title + optional detail lines (fault, SKU, IMEI). */
export function mapSaleItemForInvoice(
  i: {
    productName?: string
    description?: string
    sku?: string
    imei?: string
  },
  ctx?: { sale?: { notes?: string }; index?: number },
): { title: string; details?: string } {
  const title = i.productName || i.description || 'Item'
  const detailParts: string[] = []

  const inlineFault = i.productName && i.description?.trim() && i.description.trim() !== i.productName
    ? i.description.trim()
    : undefined

  if (inlineFault) {
    detailParts.push(`Fault / Service: ${inlineFault}`)
  } else if (ctx?.index === 0 && title.startsWith('Repair Service') && ctx.sale) {
    const fault = extractRepairFaultFromSale(ctx.sale)
    if (fault) detailParts.push(`Fault / Service: ${fault}`)
  }

  if (i.sku) {
    detailParts.push(i.imei ? `SKU: ${i.sku} · IMEI: ${i.imei}` : `SKU: ${i.sku}`)
  } else if (i.imei) {
    detailParts.push(`IMEI: ${i.imei}`)
  }

  return { title, details: detailParts.length ? detailParts.join('\n') : undefined }
}
