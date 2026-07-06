/** Parse fault / service detail stored on repair sale notes. */
export function extractRepairFaultFromSale(sale: { notes?: string }): string | undefined {
  if (!sale.notes) return undefined
  const m = sale.notes.match(/\|\s*Fault:\s*(.+)$/i)
  return m?.[1]?.trim() || undefined
}

/** Spare part line on a repair invoice (name + qty; price billed in service quote). */
export function isRepairSparePartLine(
  item: { productName?: string; isRepairPart?: boolean },
  sale?: { source?: string },
): boolean {
  if (item.isRepairPart) return true
  return sale?.source === 'REPAIR' && !String(item.productName || '').startsWith('Repair Service')
}

/** Normalize repair sale lines: service billed, spare parts listed by name only. */
export function repairInvoiceSaleItems(sale: { source?: string; items?: any[] }) {
  const items = sale.items ?? []
  if (sale.source !== 'REPAIR') return items
  return items.map((i) => {
    if (String(i.productName || '').startsWith('Repair Service')) return i
    return {
      ...i,
      unitPrice: 0,
      total: 0,
      discount: 0,
      isRepairPart: true,
    }
  })
}

/** Map a sale line item to invoice title + optional detail lines (fault, SKU, IMEI). */
export function mapSaleItemForInvoice(
  i: {
    productName?: string
    description?: string
    warrantyNote?: string
    sku?: string
    imei?: string
    isRepairPart?: boolean
  },
  ctx?: { sale?: { notes?: string; source?: string }; index?: number },
): { title: string; details?: string } {
  const title = i.productName || i.description || 'Item'
  if (isRepairSparePartLine(i, ctx?.sale)) {
    return { title, details: undefined }
  }

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
    detailParts.push(`SKU: ${i.sku}`)
  }
  if (i.imei) {
    detailParts.push(`IMEI: ${i.imei}`)
  }

  return { title, details: detailParts.length ? detailParts.join('\n') : undefined }
}
