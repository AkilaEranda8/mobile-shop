import { prisma } from '../config/database'

export async function generateInvoiceNumber(tenantId: string): Promise<string> {
  const today = new Date()
  const prefix = `INV-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
  const count = await prisma.sale.count({ where: { tenantId } })
  return `${prefix}-${String(count + 1).padStart(4, '0')}`
}

export async function generateTicketNumber(tenantId: string): Promise<string> {
  const today = new Date()
  const prefix = `TKT-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`
  const count = await prisma.repairTicket.count({ where: { tenantId } })
  return `${prefix}-${String(count + 1).padStart(4, '0')}`
}

export async function generatePONumber(tenantId: string): Promise<string> {
  const today = new Date()
  const prefix = `PO-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`
  const count = await prisma.purchaseOrder.count({ where: { tenantId } })
  return `${prefix}-${String(count + 1).padStart(4, '0')}`
}

export async function generateReturnNumber(tenantId: string): Promise<string> {
  const today = new Date()
  const prefix = `RET-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
  const count = await prisma.saleReturn.count({ where: { tenantId } })
  return `${prefix}-${String(count + 1).padStart(4, '0')}`
}

export function generateWarrantyCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'WR-'
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
