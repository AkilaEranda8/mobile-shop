import { prisma } from '../config/database'

function nextSeq(last: string | undefined, prefix: string): string {
  let seq = 1
  if (last) {
    const tail = last.slice(prefix.length + 1) // strip "PREFIX-"
    const n = parseInt(tail, 10)
    if (!isNaN(n)) seq = n + 1
  }
  return `${prefix}-${String(seq).padStart(4, '0')}`
}

export async function generateInvoiceNumber(tenantId: string): Promise<string> {
  // Use total sale count as a fast starting estimate
  const count = await prisma.sale.count({ where: { tenantId } })
  let next = count + 1
  let candidate = `INV-${String(next).padStart(5, '0')}`

  // Check for collision (handles migrations from old date-based format or deletions)
  const collision = await prisma.sale.findFirst({ where: { tenantId, invoiceNumber: candidate }, select: { id: true } })
  if (collision) {
    // Find the actual max number across ALL invoices for this tenant
    const all = await prisma.sale.findMany({ where: { tenantId }, select: { invoiceNumber: true } })
    let max = count
    for (const s of all) {
      const m = s.invoiceNumber?.match(/(\d+)$/)
      if (m) max = Math.max(max, parseInt(m[1], 10))
    }
    next = max + 1
    candidate = `INV-${String(next).padStart(5, '0')}`
  }

  return candidate
}

export async function generateTicketNumber(tenantId: string): Promise<string> {
  const today = new Date()
  const prefix = `TKT-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`
  const last = await prisma.repairTicket.findFirst({
    where: { tenantId, ticketNumber: { startsWith: prefix } },
    orderBy: { ticketNumber: 'desc' },
    select: { ticketNumber: true },
  })
  return nextSeq(last?.ticketNumber, prefix)
}

export async function generatePONumber(tenantId: string): Promise<string> {
  const today = new Date()
  const prefix = `PO-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`
  const last = await prisma.purchaseOrder.findFirst({
    where: { tenantId, poNumber: { startsWith: prefix } },
    orderBy: { poNumber: 'desc' },
    select: { poNumber: true },
  })
  return nextSeq(last?.poNumber, prefix)
}

export async function generateReturnNumber(tenantId: string): Promise<string> {
  const today = new Date()
  const prefix = `RET-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
  const last = await prisma.saleReturn.findFirst({
    where: { tenantId, returnNumber: { startsWith: prefix } },
    orderBy: { returnNumber: 'desc' },
    select: { returnNumber: true },
  })
  return nextSeq(last?.returnNumber, prefix)
}

export function generateWarrantyCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'WR-'
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
